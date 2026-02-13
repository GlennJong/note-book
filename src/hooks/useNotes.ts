import { useState, useEffect, useCallback, useRef } from 'react';
import { get, set } from 'idb-keyval';
import { fetchScript } from '../common/fetch';
import type { Note } from '../types-note';

type SyncAction = 'add' | 'edit' | 'delete';

type SyncTask = {
  id: string; // Task ID
  action: SyncAction;
  targetId: string; // The note ID
  data?: any;
  timestamp: number;
  readyAt: number; // For debounce: only process after this time
};

export const useNotes = (scriptUrl: string | null) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [pendingTasks, setPendingTasks] = useState<SyncTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const processingRef = useRef(false);

  // Load from IDB on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const savedNotes = await get('notebook_notes');
        if (savedNotes) setNotes(savedNotes);
        
        const savedTasks = await get('notebook_pending_tasks');
        if (savedTasks) setPendingTasks(savedTasks);
      } catch (e) {
        console.error("Failed to load notes from IDB", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Fetch from Server
  useEffect(() => {
    if (!scriptUrl) return;

    const fetchRemote = async () => {
      setIsSyncing(true);
      try {
        const data = await fetchScript(scriptUrl);
        // The fetchScript returns objects that match Note structure (except maybe dates are strings)
        // We cast it to Note[]
        setNotes(data as unknown as Note[]);
      } catch (e) {
        console.error("Failed to fetch remote notes", e);
      } finally {
        setIsSyncing(false);
      }
    };

    fetchRemote();
  }, [scriptUrl]);

  // Persistence (Save on Change)
  useEffect(() => {
    if (!loading) {
      set('notebook_notes', notes);
    }
  }, [notes, loading]);

  useEffect(() => {
    if (!loading) {
      set('notebook_pending_tasks', pendingTasks);
    }
  }, [pendingTasks, loading]);

  // Sync Logic
  const processQueue = useCallback(async () => {
    if (!scriptUrl || pendingTasks.length === 0 || processingRef.current) return;

    const now = Date.now();
    // Filter tasks that are ready (debounce check)
    const readyTasks = pendingTasks.filter(t => t.readyAt <= now);
    if (readyTasks.length === 0) return;

    processingRef.current = true;
    setIsSyncing(true);

    const completedTaskIds: string[] = [];

    try {
      // We process only one action per note to avoid race conditions in this simple implementation
      // or just process them in order. 
      // Simplified: Just take ready tasks.
      const addTasks = readyTasks.filter(t => t.action === 'add');
      const editTasks = readyTasks.filter(t => t.action === 'edit');
      const deleteTasks = readyTasks.filter(t => t.action === 'delete');

       // 1. Batch Add
       if (addTasks.length > 0) {
        try {
          const payload = addTasks.map(t => escapeData(t.data));
           await fetchScript(scriptUrl, 'POST', payload);
          completedTaskIds.push(...addTasks.map(t => t.id));
        } catch (e) {
          console.error("Batch add failed", e);
        }
      }

      // 2. Individual Edits (Note: Google Scripts usually handles 'UPDATE' via POST)
      if (editTasks.length > 0) {
        await Promise.all(editTasks.map(async (task) => {
          try {
            if (!task.data) return;
            const url = scriptUrl.includes('?') ? `${scriptUrl}&method=UPDATE` : `${scriptUrl}?method=UPDATE`;
            await fetchScript(url, 'POST', escapeData(task.data));
            completedTaskIds.push(task.id);
          } catch (e) {
            console.error(`Edit failed for task ${task.id}`, e);
          }
        }));
      }

      // 3. Individual Deletes
      if (deleteTasks.length > 0) {
        await Promise.all(deleteTasks.map(async (task) => {
          try {
            const url = scriptUrl.includes('?') ? `${scriptUrl}&method=DELETE` : `${scriptUrl}?method=DELETE`;
            await fetchScript(url, 'POST', { id: task.targetId });
            completedTaskIds.push(task.id);
          } catch (e) {
            console.error(`Delete failed for task ${task.id}`, e);
          }
        }));
      }
      
      // Update state: remove completed tasks
      if (completedTaskIds.length > 0) {
        setPendingTasks(prev => prev.filter(t => !completedTaskIds.includes(t.id)));
      }

    } catch (e) {
       console.error("Sync process error", e);
    } finally {
      processingRef.current = false;
      setIsSyncing(false);
    }
  }, [scriptUrl, pendingTasks]);

  // Periodic Sync Trigger
  useEffect(() => {
    const interval = setInterval(() => {
        if (pendingTasks.length > 0 && !processingRef.current) {
            processQueue();
        }
    }, 5000); // Check every 5s if there is something ready
    return () => clearInterval(interval);
  }, [pendingTasks, processQueue]);


  // Helpers
  const escapeData = (data: any) => {
    // Prefix strings starting with =, +, -, @ with '
    const escaped = { ...data };
    for (const key in escaped) {
        if (typeof escaped[key] === 'string') {
            const val = escaped[key];
            if (val.startsWith('=') || val.startsWith('+') || val.startsWith('-') || val.startsWith('@')) {
                escaped[key] = "'" + val;
            }
        }
    }
    return escaped;
  }

  // Actions
  const addNote = useCallback((note: Omit<Note, 'id' | 'updated_at'>) => {
    const newNote: Note = {
        ...note,
        id: crypto.randomUUID(),
        updated_at: new Date().toISOString()
    };
    
    setNotes(prev => [newNote, ...prev]);

    // Queue creation immediately (no debounce needed for creation usually, but consistent)
    const task: SyncTask = {
        id: crypto.randomUUID(),
        action: 'add',
        targetId: newNote.id,
        data: newNote,
        timestamp: Date.now(),
        readyAt: Date.now() // Send immediately
    };
    setPendingTasks(prev => [...prev, task]);
    return newNote.id;
  }, []);

  const updateNote = useCallback((id: string, patches: Partial<Omit<Note, 'id' | 'updated_at'>>) => {
     setNotes(prevNotes => {
        const index = prevNotes.findIndex(n => n.id === id);
        if (index === -1) return prevNotes;
        
        const oldNote = prevNotes[index];
        const newNote = { ...oldNote, ...patches, updated_at: new Date().toISOString() };
        
        const newNotes = [...prevNotes];
        newNotes[index] = newNote;
        
        // Debounce Sync Logic:
        // Update pending tasks. If there's already an edit task for this ID, update it and push back `readyAt`.
        setPendingTasks(prevTasks => {
            const existingTaskIndex = prevTasks.findIndex(t => t.targetId === id && t.action === 'edit');
            const readyTime = Date.now() + 2000; // 2 seconds debounce

            const newTask: SyncTask = {
                id: existingTaskIndex >= 0 ? prevTasks[existingTaskIndex].id : crypto.randomUUID(),
                action: 'edit',
                targetId: id,
                data: newNote,
                timestamp: Date.now(),
                readyAt: readyTime
            };

            if (existingTaskIndex >= 0) {
                 const newQueue = [...prevTasks];
                 newQueue[existingTaskIndex] = newTask;
                 return newQueue;
            } else {
                return [...prevTasks, newTask];
            }
        });

        return newNotes;
     });
  }, []);

  const removeNote = useCallback((id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    
    // Remove any pending add/edits for this note to save bandwidth
    setPendingTasks(prev => {
        const filtered = prev.filter(t => t.targetId !== id);
        return [...filtered, {
            id: crypto.randomUUID(),
            action: 'delete',
            targetId: id,
            timestamp: Date.now(),
            readyAt: Date.now()
        }];
    });
  }, []);

  return {
    notes,
    loading,
    addNote,
    updateNote,
    removeNote,
    isSyncing,
    pendingTaskCount: pendingTasks.length
  };
};
