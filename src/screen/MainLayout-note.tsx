import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNotes } from '../hooks/useNotes';
import './MainLayout-note.css'; 
import SwipeableItem from '../components/SwipeableItem';
import type { Note } from '../types-note';

const MainLayoutNote = () => {
    const scriptUrl = localStorage.getItem('vibe_script_url_note');
    const { notes, addNote, updateNote, removeNote, isSyncing, pendingTaskCount } = useNotes(scriptUrl);
    
    // Memoize the selected ID to prevent unnecessary re-renders
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    
    const selectedNote = notes.find(n => n.id === selectedNoteId);
    
    const handleCreateNote = useCallback(() => {
        // Only set title, content is empty initially
        const newId = addNote({ title: 'New Note', content: '', tags: [] });
        setSelectedNoteId(newId);
        setIsEditing(true);
    }, [addNote]);

    const handleEditorChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (selectedNoteId) {
             const text = e.target.value;
             // Split only on the first newline to separate Title and Content
             const firstLineIndex = text.indexOf('\n');
             let newTitle = '';
             let newContent = '';

             if (firstLineIndex === -1) {
                 // No newline => Everything is title
                 newTitle = text;
                 newContent = '';
             } else {
                 newTitle = text.slice(0, firstLineIndex);
                 // Include the newline in the content to preserve it
                 newContent = text.slice(firstLineIndex);
             }

            updateNote(selectedNoteId, { title: newTitle, content: newContent });
        }
    }, [selectedNoteId, updateNote]);

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
        return (n.title || '').toLowerCase().includes(term) || (n.content || '').toLowerCase().includes(term);
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
            today: [] as Note[],
            yesterday: [] as Note[],
            last7Days: [] as Note[],
            last30Days: [] as Note[],
            older: [] as Note[]
        };

        filteredNotes.forEach(note => {
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
                backgroundColor: selectedNoteId === note.id ? 'var(--bg-item)' : 'transparent',
                borderBottom: '1px solid var(--border-color)',
                padding: 0
            }}
        >
            <div style={{ padding: '12px', pointerEvents: 'none' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{note.title || 'Untitled'}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {note.content?.trim().slice(0, 50) || (<span style={{ fontStyle: 'italic', opacity: 0.7 }}>No content</span>)}
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
    }, []);
    
    // Touch handling for editor
    const touchStartRef = useRef<{x: number, y: number} | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (isEditing) return; // If already editing, let native behavior happen
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

        // Calculate total movement distance
        const distance = Math.sqrt(diffX*diffX + diffY*diffY);

        if (distance < 40) {
            // It's a tap
            setIsEditing(true);
            setTimeout(() => {
                textareaRef.current?.focus();
            }, 50);
        } else {
            // It's a swipe or scroll
            // Check for Swipe Back (Left-to-Right)
            // Condition: Horizontal dominant, rightwards positive delta, > 30% viewport width
            if (diffX > diffY && deltaX > 0 && deltaX > (window.innerWidth * 0.3)) {
                handleBack();
            }
        }
        
        touchStartRef.current = null;
    };

    return (
    <div className="main-layout" style={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
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
            </div>
        </div>

        {/* Mobile Header (When viewing list) */}
        {!selectedNoteId && (
            <div className="header-bar mobile-header" style={{ padding: '10px', borderBottom: '1px solid var(--border-color)', justifyContent: 'center', alignItems: 'center' }}>
                <h2 style={{ margin: 0 }}>NoteBook</h2>
            </div>
        )}

        {/* Mobile Editor Header (When viewing note) */}
        {selectedNoteId && (
            <div className="header-bar mobile-editor-header" style={{ padding: '10px', borderBottom: '1px solid var(--border-color)', alignItems: 'center', gap: '10px' }}>
                 <button onClick={handleBack} className="icon-btn">
                    <span className="material-symbols-outlined">arrow_back_ios</span>
                 </button>
                 <div style={{ flex: 1 }}></div>
                 {/* Edit button removed as per request, rely on tap/interaction */}
            </div>
        )}

        <div className="main-content" style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
            {/* Sidebar List */}
            <div className={`note-sidebar ${selectedNoteId ? 'hidden-on-mobile' : ''}`} style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="note-sidebar-search" style={{ padding: '10px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '8px' }}>
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
                    
                    {renderGroup('Today', groups.today)}
                    {renderGroup('Yesterday', groups.yesterday)}
                    {renderGroup('Previous 7 Days', groups.last7Days)}
                    {renderGroup('Previous 30 Days', groups.last30Days)}
                    {renderGroup('Older', groups.older)}
                </div>
            </div>

            {/* Editor Area */}
            <div className={`note-editor ${!selectedNoteId ? 'hidden-on-mobile' : ''} ${selectedNoteId ? 'active-mobile' : ''}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-main)', overflow: 'hidden' }}>
                {selectedNote ? (
                    <>
                        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '20px' }}> 
                            <textarea
                                ref={textareaRef}
                                className="note-editor-textarea"
                                // Combine title and content for the view
                                // If content exists but doesn't start with newline (legacy data), add one.
                                // If content starts with newline (new data structure), use as is.
                                value={selectedNote.title + (selectedNote.content ? (selectedNote.content.startsWith('\n') ? selectedNote.content : `\n${selectedNote.content}`) : '')}
                                onChange={handleEditorChange}
                                placeholder="Start typing..."
                                readOnly={!isEditing}
                                onTouchStart={handleTouchStart}
                                onTouchEnd={handleTouchEnd}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    resize: 'none',
                                    border: 'none',
                                    outline: 'none',
                                    backgroundColor: 'transparent',
                                    color: 'var(--text-main)',
                                    fontFamily: 'inherit',
                                    fontSize: '1rem',
                                    lineHeight: '1.5',
                                    // When not editing, allow touch events but maybe pointer can be different
                                    cursor: isEditing ? 'text' : 'default'
                                }}
                            />
                        </div>
                        <div style={{ padding: '10px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', backgroundColor: 'var(--bg-main)' }}>
                                <button className="icon-btn" style={{ color: 'var(--danger)' }} title="Delete Note" onClick={() => {
                                    if(confirm('Delete this note?')) {
                                        removeNote(selectedNote.id);
                                        setSelectedNoteId(null);
                                    }
                                }}>
                                    <span className="material-symbols-outlined">delete</span>
                                </button>
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
