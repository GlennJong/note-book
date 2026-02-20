import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNotes } from '../hooks/useNotes';
import './MainLayout-note.css'; 
import SwipeableItem from '../components/SwipeableItem';
import type { Note } from '../types-note';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';

const stripMarkdown = (text: string | undefined) => {
    if (!text) return '';
    return String(text)
        .replace(/<[^>]*>?/gm, ' ') // HTML
        .replace(/^#+\s+/gm, '') // Headers
        .replace(/(\*\*|__)(.*?)\1/g, '$2') // Bold
        .replace(/(\*|_)(.*?)\1/g, '$2') // Italic
        // eslint-disable-next-line no-useless-escape
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Links
        // eslint-disable-next-line no-useless-escape
        .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '') // Images
        .replace(/`([^`]+)`/g, '$1') // Inline code
        .replace(/^\s*[-*+]\s+/gm, '') // List items
        .replace(/^\s*>\s+/gm, '') // Blockquotes
        .replace(/\n+/g, ' ') // Newlines to spaces
        .trim();
};

const MainLayoutNote = () => {
    const scriptUrl = localStorage.getItem('vibe_script_url_note');
    const { notes, addNote, updateNote, removeNote, isSyncing, pendingTaskCount, loading } = useNotes(scriptUrl);
    
    // Memoize the selected ID to prevent unnecessary re-renders
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isListMenuOpen, setIsListMenuOpen] = useState(false);

    const handleClearStorage = useCallback(() => {
        if (confirm('Are you sure you want to delete all data? This defaults storage.')) {
            localStorage.clear();
            window.location.reload();
        }
    }, []);
    const [transitionsEnabled, setTransitionsEnabled] = useState(false); // Initially disabled to prevent slide-in
    
    // Sidebar Resizing
    const [sidebarWidth, setSidebarWidth] = useState(300);
    const [isResizing, setIsResizing] = useState(false);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            let newWidth = e.clientX;
            if (newWidth < 200) newWidth = 200; // Min width
            if (newWidth > 600) newWidth = 600; // Max width
            setSidebarWidth(newWidth);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    // Initialize: Select the last accessed note, or fallback to first
    const hasInitializedRef = useRef(false);
    useEffect(() => {
        if (!loading) {
            if (!hasInitializedRef.current && notes.length > 0) {
                const lastId = localStorage.getItem('notebook_last_selected_id');
                const targetNote = lastId ? notes.find(n => n.id === lastId) : null;

                if (targetNote) {
                    setTimeout(() => setSelectedNoteId(targetNote.id), 0);
                } else {
                    // Determine the correct sort order (same as filteredNotes)
                    // Pinned first, then by updated_at desc
                    const sorted = [...notes].sort((a,b) => {
                        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
                        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
                    });
                    
                    if (sorted.length > 0) {
                        setTimeout(() => setSelectedNoteId(sorted[0].id), 0);
                    }
                }
                hasInitializedRef.current = true;
                // Enable transitions after a short delay so the initial render is instant (no slide)
                setTimeout(() => setTransitionsEnabled(true), 100);
            } else if (notes.length === 0 && !hasInitializedRef.current) {
                // If loaded but empty, enable transitions directly
                hasInitializedRef.current = true;
                setTimeout(() => setTransitionsEnabled(true), 100);
            }
        }
    }, [notes, loading]);

    // Persist selectedNoteId
    useEffect(() => {
        if (selectedNoteId) {
            localStorage.setItem('notebook_last_selected_id', selectedNoteId);
        }
    }, [selectedNoteId]);
    
    const selectedNote = notes.find(n => n.id === selectedNoteId);
    
    const handleCreateNote = useCallback(() => {
        // Only set title, content is empty initially
        const newId = addNote({ title: 'New Note', content: '', tags: [] });
        setSelectedNoteId(newId);
        setIsEditing(true);
        // Tiptap needs a moment to initialize or receive the new ID prop
    }, [addNote]);

    // Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
                e.preventDefault();
                handleCreateNote();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleCreateNote]);

    const filteredNotes = notes
    .filter(n => {
        const term = searchTerm.toLowerCase();
        // Ensure title and content are strings to prevent .toLowerCase() errors on numbers/etc
        const title = String(n.title || '');
        const content = String(n.content || '');
        return title.toLowerCase().includes(term) || content.toLowerCase().includes(term);
    })
    .sort((a,b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    const groups = useMemo(() => {
        const today = new Date();
        today.setHours(0,0,0,0);
        
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const last7Days = new Date(today);
        last7Days.setDate(last7Days.getDate() - 7);
        
        const last30Days = new Date(today);
        last30Days.setDate(last30Days.getDate() - 30);

        const g = {
            pinned: [] as Note[],
            today: [] as Note[],
            yesterday: [] as Note[],
            last7Days: [] as Note[],
            last30Days: [] as Note[],
            older: [] as Note[]
        };

        filteredNotes.forEach(note => {
            if (note.is_pinned) {
                g.pinned.push(note);
                return;
            }

            const d = new Date(note.updated_at);
            // Reset time part for accurate day comparison
            // Or just compare timestamps
            const t = d.getTime();
            
            if (t >= today.getTime()) {
                g.today.push(note);
            } else if (t >= yesterday.getTime()) {
                g.yesterday.push(note);
            } else if (t >= last7Days.getTime()) {
                g.last7Days.push(note);
            } else if (t >= last30Days.getTime()) {
                g.last30Days.push(note);
            } else {
                g.older.push(note);
            }
        });
        
        return g;
    }, [filteredNotes]);
    
    const renderNoteItem = (note: Note) => (
        <SwipeableItem 
            key={note.id} 
            onClick={() => {
                setSelectedNoteId(note.id);
                setIsEditing(false); // Default to view mode
            }}
            onDelete={() => {
                if(confirm('Delete this note?')) {
                    removeNote(note.id);
                    if(selectedNoteId === note.id) setSelectedNoteId(null);
                }
            }}
            className="note-list-item"
            style={{ 
                backgroundColor: selectedNoteId === note.id ? 'var(--primary-bg-subtle)' : 'transparent',
                borderLeft: selectedNoteId === note.id ? '4px solid var(--primary)' : '4px solid transparent',
                borderBottom: '1px solid var(--border-color)',
                padding: 0
            }}
        >
            <div style={{ padding: '12px', paddingLeft: '8px', pointerEvents: 'none' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{note.title || 'Untitled'}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {stripMarkdown(note.content).slice(0, 50) || (<span style={{ fontStyle: 'italic', opacity: 0.7 }}>No content</span>)}
                </div>
            </div>
        </SwipeableItem>
    );

    const renderGroup = (title: string, notes: Note[]) => {
        if (notes.length === 0) return null;
        return (
            <div key={title}>
                <div style={{ 
                    padding: '8px 12px', 
                    fontSize: '0.8rem', 
                    fontWeight: 'bold', 
                    color: 'var(--text-secondary)', 
                    backgroundColor: 'var(--bg-main)',
                    borderBottom: '1px solid var(--border-color)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 2
                }}>
                    {title}
                </div>
                {notes.map(renderNoteItem)}
            </div>
        );
    };

    const handleBack = useCallback(() => {
        setIsEditing(false);
        setSelectedNoteId(null);
        localStorage.removeItem('notebook_last_selected_id');
    }, []);
    
    const isLoadingRef = useRef(false);

    // Tiptap Editor
    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({
                placeholder: 'Start typing...',
            }),
            Markdown.configure({
                html: false,
                transformPastedText: true,
                transformCopiedText: true,
            }),
        ],
        content: '',
        onUpdate: ({ editor }) => {
            if (activeNoteIdRef.current && !isLoadingRef.current) {
                // Get Markdown content
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const markdown = (editor.storage as any).markdown.getMarkdown();

                // For title, we grab the text of the first block/node to simulate "first line title"
                const fullText = editor.getText();
                const firstLineIndex = fullText.indexOf('\n');
                const title = firstLineIndex === -1 ? fullText : fullText.slice(0, firstLineIndex);
                
                // We update title just for the sidebar list.
                // SKIP timestamp update on keystroke to prevent list jumping
                updateNote(activeNoteIdRef.current, { title: title, content: markdown }, { skipTimestampUpdate: true });
            }
        },
        onBlur: () => {
             // Update timestamp only when focus leaves (edit finished)
             // Check if we are actually editing or just navigating away
             if (activeNoteIdRef.current && !isLoadingRef.current) {
                updateNote(activeNoteIdRef.current, {}); 
            }
        },
        editable: false, // Start read-only
        editorProps: {
            attributes: {
                class: 'note-editor-tiptap', 
            },
        },
    });
    
    // Check if we switched notes
    const activeNoteIdRef = useRef<string | null>(null);

    useEffect(() => {
        activeNoteIdRef.current = selectedNoteId;
        if (editor && selectedNote) {
            // Check if content changed externally or initialization
            // Be careful not to reset cursor on every re-render if we triggered the update
            // Ideally compare content? But HTML comparision is hard.
            // For now, only set content if we switched note IDs or if editor is empty
            // This is tricky with React + Tiptap external state.
            // Simple approach: Only set content when selectedNoteId CHANGES.
        }
    }, [selectedNoteId, selectedNote, editor]);
    
    // Sync Editor Content when Note ID changes
    const lastNoteIdRef = useRef<string | null>(null);
    useEffect(() => {
        if (selectedNoteId !== lastNoteIdRef.current) {
            if (editor && selectedNote) {
                isLoadingRef.current = true; // Flag: loading started
                
                const content = selectedNote.content || '';
                
                // Content can be HTML (old) or Markdown (new/legacy text)
                // specific check for HTML to ensure safe loading of legacy HTML
                
                // Set content. Tiptap + Markdown extension handles both usually,  
                // but checking ensures structure.
                editor.commands.setContent(content);
                
                // Clear history so undo doesn't go back to previous note
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if ((editor.commands as any).clearContentHistory) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (editor.commands as any).clearContentHistory();
                }
                
                // Flag: loading ended. Timeout ensures onUpdate from setContent is skipped
                setTimeout(() => {
                    isLoadingRef.current = false;
                }, 0);
            }
            lastNoteIdRef.current = selectedNoteId;
        }
    }, [selectedNoteId, selectedNote, editor]);

    // Update Editable State
    useEffect(() => {
        if (editor) {
            editor.setEditable(isEditing);
        }
    }, [isEditing, editor]);

    // Touch handling for editor wrapper
    const touchStartRef = useRef<{x: number, y: number} | null>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (isEditing) return; 
        touchStartRef.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
        };
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (isEditing) return;
        if (!touchStartRef.current) return;

        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        const deltaX = endX - touchStartRef.current.x;
        const deltaY = endY - touchStartRef.current.y;
        
        const diffX = Math.abs(deltaX);
        const diffY = Math.abs(deltaY);
        const distance = Math.sqrt(diffX*diffX + diffY*diffY);

        if (distance < 40) {
            setIsEditing(true);
            setTimeout(() => {
                 editor?.commands.focus();
            }, 50);
        } else {
            if (diffX > diffY && deltaX > 0 && deltaX > (window.innerWidth * 0.3)) {
                handleBack();
            }
        }
        touchStartRef.current = null;
    };

    return (
    <div className={`main-layout ${!transitionsEnabled ? 'disable-transition' : ''}`} style={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
        {/* Desktop Header */}
        <div className="header-bar desktop-header" style={{ padding: '10px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>NoteBook</h2>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {isSyncing ? 'Syncing...' : (pendingTaskCount > 0 ? `${pendingTaskCount} pending` : 'Synced')}
                </span>
                <button onClick={handleCreateNote} className="icon-btn" title="New Note">
                    <span className="material-symbols-outlined">edit_square</span>
                </button>
                <div style={{ position: 'relative' }}>
                    <button className="icon-btn" onClick={() => setIsListMenuOpen(!isListMenuOpen)} title="Menu">
                        <span className="material-symbols-outlined">more_horiz</span>
                    </button>
                    {isListMenuOpen && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            backgroundColor: 'var(--bg-card)',
                            boxShadow: '0 4px 12px var(--shadow-color)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            zIndex: 100,
                            minWidth: '150px',
                            marginTop: '5px'
                        }}>
                             <button
                                onClick={() => {
                                    handleClearStorage();
                                    setIsListMenuOpen(false);
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    width: '100%',
                                    padding: '12px 16px',
                                    border: 'none',
                                    background: 'transparent',
                                    color: 'var(--danger)',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem',
                                    textAlign: 'left',
                                    whiteSpace: 'nowrap'
                                }}
                             >
                                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>delete_forever</span>
                                Delete Storage
                             </button>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Mobile Header (When viewing list) */}
        {!selectedNoteId && (
            <div className="header-bar mobile-header" style={{ padding: '10px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ width: '40px' }}></div>
                <h2 style={{ margin: 0 }}>NoteBook</h2>
                <div style={{ position: 'relative' }}>
                    <button className="icon-btn" onClick={() => setIsListMenuOpen(!isListMenuOpen)} title="Menu">
                        <span className="material-symbols-outlined">more_horiz</span>
                    </button>
                    {isListMenuOpen && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            backgroundColor: 'var(--bg-card)',
                            boxShadow: '0 4px 12px var(--shadow-color)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            zIndex: 100,
                            minWidth: '150px',
                            marginTop: '5px'
                        }}>
                             <button
                                onClick={() => {
                                    handleClearStorage();
                                    setIsListMenuOpen(false);
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    width: '100%',
                                    padding: '12px 16px',
                                    border: 'none',
                                    background: 'transparent',
                                    color: 'var(--danger)',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem',
                                    textAlign: 'left',
                                    whiteSpace: 'nowrap'
                                }}
                             >
                                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>delete_forever</span>
                                Delete Storage
                             </button>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* Mobile Editor Header (When viewing note) */}
        {selectedNoteId && (
            <div className="header-bar mobile-editor-header" style={{ padding: '10px', borderBottom: '1px solid var(--border-color)', alignItems: 'center', gap: '10px', position: 'relative' }}>
                 <button onClick={handleBack} className="icon-btn">
                    <span className="material-symbols-outlined">arrow_back_ios</span>
                 </button>
                 <div style={{ flex: 1 }}></div>
                 
                 <button className="icon-btn" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                    <span className="material-symbols-outlined">more_horiz</span>
                 </button>

                 {isMenuOpen && (
                    <>
                        <div 
                            style={{ position: 'fixed', inset: 0, zIndex: 99 }} 
                            onClick={() => setIsMenuOpen(false)}
                        ></div>
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            right: '10px',
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px var(--shadow-color)',
                            zIndex: 100,
                            display: 'flex',
                            flexDirection: 'column',
                            minWidth: '160px',
                            overflow: 'hidden'
                        }}>
                             <button style={{
                                 display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', 
                                 background: 'transparent', border: 'none', color: 'var(--text-main)',
                                 fontSize: '1rem', width: '100%', textAlign: 'left',
                                 borderBottom: '1px solid var(--border-color)',
                                 cursor: 'pointer'
                             }} onClick={() => {
                                 if (selectedNoteId) {
                                     updateNote(selectedNoteId, { is_pinned: !selectedNote?.is_pinned });
                                     setIsMenuOpen(false);
                                 }
                             }}>
                                 <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{selectedNote?.is_pinned ? 'keep_off' : 'keep'}</span>
                                 {selectedNote?.is_pinned ? 'Unpin' : 'Pin'}
                             </button>
                             <button style={{
                                 display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', 
                                 background: 'transparent', border: 'none', color: 'var(--danger)',
                                 fontSize: '1rem', width: '100%', textAlign: 'left',
                                 cursor: 'pointer'
                             }} onClick={() => {
                                 if (confirm('Delete this note?')) {
                                     if (selectedNoteId) removeNote(selectedNoteId);
                                     setSelectedNoteId(null);
                                     setIsMenuOpen(false);
                                 }
                             }}>
                                 <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>delete</span>
                                 Delete
                             </button>
                        </div>
                    </>
                 )}
            </div>
        )}

        <div className="main-content" style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
            {/* Sidebar List */}
            <div 
                className={`note-sidebar ${selectedNoteId ? 'hidden-on-mobile' : ''}`} 
                style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    width: sidebarWidth, /* Desktop width controlled by state */
                    flexShrink: 0
                }}
            >
                <div className="note-sidebar-search" style={{ 
                    height: '54px', 
                    boxSizing: 'border-box',
                    padding: '10px', 
                    borderBottom: '1px solid var(--border-color)', 
                    display: 'flex', 
                    gap: '8px', 
                    alignItems: 'center' 
                }}>
                    <input 
                        type="search" 
                        placeholder="Search notes..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ 
                            flex: 1,
                            padding: '8px', 
                            borderRadius: '4px', 
                            border: '1px solid var(--border-color)', 
                            backgroundColor: 'var(--bg-card)', 
                            color: 'var(--text-main)',
                            outline: 'none'
                        }}
                    />
                    <button className="mobile-create-btn icon-btn" onClick={handleCreateNote}>
                        <span className="material-symbols-outlined">edit_square</span>
                    </button>
                </div>

                <div className="note-sidebar-list" style={{ flex: 1, overflowY: 'auto' }}>
                    {filteredNotes.length === 0 && <p style={{ padding: '20px', color: 'var(--text-muted)' }}>No notes found.</p>}
                    
                    {renderGroup('Pinned', groups.pinned)}
                    {renderGroup('Today', groups.today)}
                    {renderGroup('Yesterday', groups.yesterday)}
                    {renderGroup('Previous 7 Days', groups.last7Days)}
                    {renderGroup('Previous 30 Days', groups.last30Days)}
                    {renderGroup('Older', groups.older)}
                </div>
            </div>

            {/* Resizer Handle (Desktop only) */}
            <div
                className="sidebar-resizer hidden-on-mobile"
                onMouseDown={() => setIsResizing(true)}
                style={{
                    width: '4px',
                    cursor: 'col-resize',
                    backgroundColor: isResizing ? 'var(--primary)' : 'transparent',
                    borderRight: '1px solid var(--border-color)',
                    zIndex: 10,
                    flexShrink: 0,
                    transition: 'background-color 0.2s',
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--active-bg, rgba(0,0,0,0.1))'}
                onMouseOut={(e) => !isResizing && (e.currentTarget.style.backgroundColor = 'transparent')}
            ></div>

            {/* Editor Area */}
            <div className={`note-editor ${!selectedNoteId ? 'hidden-on-mobile' : ''} ${selectedNoteId ? 'active-mobile' : ''}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-main)', overflow: 'hidden' }}>
                {selectedNote ? (
                    <>
                        {/* Desktop Toolbar */}
                        <div className="hidden-on-mobile" style={{ 
                             height: '54px',
                             boxSizing: 'border-box',
                             padding: '0 20px', 
                             borderBottom: '1px solid var(--border-color)', 
                             display: 'flex', 
                             justifyContent: 'flex-end',
                             alignItems: 'center',
                             gap: '8px',
                             background: 'var(--bg-main)'
                        }}>
                             <span style={{ marginRight: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                 {new Date(selectedNote.updated_at).toLocaleString()}
                             </span>
                             
                             <button className="icon-btn" title={selectedNote.is_pinned ? "Unpin Note" : "Pin Note"} onClick={() => {
                                 updateNote(selectedNote.id, { is_pinned: !selectedNote.is_pinned }, { skipTimestampUpdate: true });
                             }}>
                                 <span className="material-symbols-outlined" style={{ 
                                     color: selectedNote.is_pinned ? 'var(--primary)' : 'var(--text-secondary)',
                                     fontVariationSettings: selectedNote.is_pinned ? "'FILL' 1" : "'FILL' 0" 
                                 }}>
                                     {selectedNote.is_pinned ? 'keep' : 'keep_off'}
                                 </span>
                             </button>

                             <div style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 4px' }}></div>

                             <button className="icon-btn" style={{ color: 'var(--danger)' }} title="Delete Note" onClick={() => {
                                    if(confirm('Delete this note?')) {
                                        removeNote(selectedNote.id);
                                        setSelectedNoteId(null);
                                    }
                                }}>
                                    <span className="material-symbols-outlined">delete</span>
                             </button>
                        </div>

                        <div 
                            style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '20px', cursor: 'text' }}
                            onTouchStart={handleTouchStart}
                            onTouchEnd={handleTouchEnd}
                            onClick={() => { 
                                if (!isEditing) {
                                    setIsEditing(true);
                                    // Slight delay to allow state update to propagate to Tiptap
                                    setTimeout(() => editor?.commands.focus(), 10);
                                }
                            }}
                        > 
                            <EditorContent editor={editor} style={{ flex: 1, height: '100%', overflowY: 'auto' }} />
                        </div>
                    </>
                ) : (
                    <div className="desktop-placeholder" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                        Select or create a note
                    </div>
                )}
            </div>
        </div>
    </div>
    );
};

export default MainLayoutNote;
