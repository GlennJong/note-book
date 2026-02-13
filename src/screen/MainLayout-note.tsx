import { useState, useCallback, useEffect } from 'react';
import { useNotes } from '../hooks/useNotes';
import './MainLayout-note.css'; 

const MainLayoutNote = () => {
    const scriptUrl = localStorage.getItem('vibe_script_url_note');
    const { notes, addNote, updateNote, removeNote, isSyncing, pendingTaskCount } = useNotes(scriptUrl);
    
    // Memoize the selected ID to prevent unnecessary re-renders
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    
    const selectedNote = notes.find(n => n.id === selectedNoteId);
    
    const handleCreateNote = useCallback(() => {
        const newId = addNote({ title: 'New Note', content: '', tags: [] });
        setSelectedNoteId(newId);
    }, [addNote]);

    const handleEditorChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (selectedNoteId) {
            updateNote(selectedNoteId, { content: e.target.value });
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

    return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
        {/* Header / Config Bar */}
        <div style={{ padding: '10px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>NoteBook</h2>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {isSyncing ? 'Syncing...' : (pendingTaskCount > 0 ? `${pendingTaskCount} pending` : 'Synced')}
                </span>
                <button onClick={handleCreateNote}>+ New Note</button>
            </div>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* Sidebar List */}
            <div className="note-sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '10px', borderBottom: '1px solid var(--border-color)' }}>
                    <input 
                        type="search" 
                        placeholder="Search notes..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ 
                            width: '100%', 
                            padding: '8px', 
                            borderRadius: '4px', 
                            border: '1px solid var(--border-color)', 
                            backgroundColor: 'var(--bg-card)', 
                            color: 'var(--text-main)',
                            outline: 'none'
                        }}
                    />
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {filteredNotes.length === 0 && <p style={{ padding: '20px', color: 'var(--text-muted)' }}>No notes found.</p>}
                    {filteredNotes.map(note => (
                        <div 
                            key={note.id} 
                            onClick={() => setSelectedNoteId(note.id)}
                            className="note-list-item"
                            style={{ 
                                backgroundColor: selectedNoteId === note.id ? 'var(--bg-item)' : 'transparent'
                            }}
                        >
                            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{note.title || 'Untitled'}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {note.content?.slice(0, 50) || (<span style={{ fontStyle: 'italic', opacity: 0.7 }}>No content</span>)}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Editor Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-main)', overflow: 'hidden' }}>
                {selectedNote ? (
                    <>
                        <input 
                            className="note-editor-title"
                            value={selectedNote.title} 
                            onChange={(e) => updateNote(selectedNote.id, { title: e.target.value })}
                            placeholder="Note Title"
                        />
                        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '20px' }}> 
                            <textarea
                                className="note-editor-textarea"
                                value={selectedNote.content}
                                onChange={handleEditorChange}
                                placeholder="Start typing..."
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
                                    lineHeight: '1.5'
                                }}
                            />
                        </div>
                        <div style={{ padding: '10px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', backgroundColor: 'var(--bg-main)' }}>
                                <button style={{ color: 'var(--danger)' }} onClick={() => {
                                    if(confirm('Delete this note?')) {
                                        removeNote(selectedNote.id);
                                        setSelectedNoteId(null);
                                    }
                                }}>Delete Note</button>
                        </div>
                    </>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                        Select or create a note
                    </div>
                )}
            </div>
        </div>
    </div>
    );
};

export default MainLayoutNote;
