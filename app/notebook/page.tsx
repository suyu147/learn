'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  FileText,
  Clock,
  Trash2,
  Edit3,
  Save,
  Loader2,
  BookOpen,
  Search,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Notebook {
  id: string;
  title: string;
  description: string;
  noteCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Notebook Page
// ---------------------------------------------------------------------------

export default function NotebookPage() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [selectedNotebook, setSelectedNotebook] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [notesLoading, setNotesLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotebooks = async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ notebooks: Notebook[] }>('/api/v1/notebook');
      setNotebooks(data.notebooks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载笔记本失败');
      setNotebooks([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch notebooks on mount
  useEffect(() => {
    fetchNotebooks();
  }, []);

  // Fetch notes for selected notebook
  const fetchNotes = async (notebookId: string) => {
    setNotesLoading(true);
    try {
      const data = await apiGet<{ notes: Note[] }>(
        `/api/v1/notebook/${notebookId}`,
      );
      setNotes(data.notes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载笔记列表失败');
      setNotes([]);
    } finally {
      setNotesLoading(false);
    }
  };

  // Create notebook
  const handleCreateNotebook = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const data = await apiPost<{ notebook: Notebook }>('/api/v1/notebook', {
        title: newTitle.trim(),
        description: newDesc.trim(),
      });
      setNotebooks((prev) => [...prev, data.notebook]);
      setNewTitle('');
      setNewDesc('');
      setShowCreateForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建笔记本失败');
    } finally {
      setCreating(false);
    }
  };

  // Delete notebook
  const handleDeleteNotebook = async (id: string) => {
    if (!confirm('Delete this notebook and all its notes?')) return;
    try {
      await apiDelete(`/api/v1/notebook/${id}`);
      setNotebooks((prev) => prev.filter((n) => n.id !== id));
      if (selectedNotebook === id) {
        setSelectedNotebook(null);
        setNotes([]);
        setSelectedNote(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除笔记本失败');
    }
  };

  // Select notebook
  const handleSelectNotebook = (id: string) => {
    setSelectedNotebook(id);
    fetchNotes(id);
    setSelectedNote(null);
  };

  // Save note
  const handleSaveNote = async () => {
    if (!selectedNote || !selectedNotebook) return;
    try {
      await apiPut(`/api/v1/notebook/${selectedNotebook}`, {
        noteId: selectedNote.id,
        title: editTitle,
        content: editContent,
      });
      setNotes((prev) =>
        prev.map((n) =>
          n.id === selectedNote.id
            ? { ...n, title: editTitle, content: editContent }
            : n,
        ),
      );
      setSelectedNote((prev) =>
        prev ? { ...prev, title: editTitle, content: editContent } : null,
      );
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存笔记失败');
    }
  };

  // Filter notebooks by search
  const filteredNotebooks = notebooks.filter(
    (nb) =>
      nb.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      nb.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="flex h-full bg-[var(--background)]">
      {/* Error Banner */}
      {error && (
        <div className="fixed top-4 right-4 z-50 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2.5 flex items-center gap-2 shadow-sm">
          <span className="text-[12px] text-red-700 dark:text-red-300">{error}</span>
          <button
            onClick={() => setError(null)}
            className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
          >
            <X className="h-3.5 w-3.5 text-red-500" />
          </button>
        </div>
      )}

      {/* Left Panel — Notebook List */}
      <div className="w-72 border-r border-[var(--border)] bg-[var(--card)] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[var(--border)]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-semibold text-[var(--foreground)]">
              Notebooks
            </h2>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="p-1.5 rounded-lg hover:bg-[var(--muted)] transition-colors"
            >
              <Plus className="h-4 w-4 text-[var(--muted-foreground)]" />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted-foreground)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg pl-8 pr-3 py-1.5 text-[12px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
              placeholder="Search notebooks..."
            />
          </div>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div className="p-3 border-b border-[var(--border)] space-y-2">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-[12px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
              placeholder="Notebook title"
              autoFocus
            />
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-[12px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
              placeholder="Description (optional)"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreateNotebook}
                disabled={creating || !newTitle.trim()}
                className="px-2.5 py-1 rounded text-[11px] font-medium bg-[var(--primary)] text-[var(--primary-foreground)] disabled:opacity-50"
              >
                {creating ? '...' : 'Create'}
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setNewTitle('');
                  setNewDesc('');
                }}
                className="px-2.5 py-1 rounded text-[11px] font-medium bg-[var(--muted)] text-[var(--foreground)]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Notebook List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 text-[var(--primary)] animate-spin" />
            </div>
          ) : filteredNotebooks.length === 0 ? (
            <div className="p-4 text-center">
              <BookOpen className="h-8 w-8 text-[var(--muted-foreground)] mx-auto mb-2 opacity-40" />
              <p className="text-[12px] text-[var(--muted-foreground)]">
                {searchQuery ? 'No matches found' : 'No notebooks yet'}
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredNotebooks.map((nb) => (
                <div
                  key={nb.id}
                  onClick={() => handleSelectNotebook(nb.id)}
                  className={cn(
                    'p-3 rounded-lg cursor-pointer transition-colors group',
                    selectedNotebook === nb.id
                      ? 'bg-[var(--primary)]/10 border border-[var(--primary)]/30'
                      : 'hover:bg-[var(--muted)] border border-transparent',
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-[var(--foreground)] truncate">
                        {nb.title}
                      </p>
                      {nb.description && (
                        <p className="text-[11px] text-[var(--muted-foreground)] truncate mt-0.5">
                          {nb.description}
                        </p>
                      )}
                      <p className="text-[10px] text-[var(--muted-foreground)] mt-1">
                        {nb.noteCount} notes
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNotebook(nb.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[var(--destructive)]/10"
                    >
                      <Trash2 className="h-3 w-3 text-[var(--muted-foreground)]" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Middle Panel — Notes List */}
      <div className="w-64 border-r border-[var(--border)] bg-[var(--background)] flex flex-col">
        <div className="p-4 border-b border-[var(--border)]">
          <h3 className="text-[13px] font-semibold text-[var(--foreground)]">
            {selectedNotebook
              ? notebooks.find((nb) => nb.id === selectedNotebook)?.title ?? 'Notes'
              : 'Select a notebook'}
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!selectedNotebook ? (
            <div className="p-4 text-center">
              <p className="text-[12px] text-[var(--muted-foreground)]">
                Select a notebook to view its notes
              </p>
            </div>
          ) : notesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 text-[var(--primary)] animate-spin" />
            </div>
          ) : notes.length === 0 ? (
            <div className="p-4 text-center">
              <FileText className="h-8 w-8 text-[var(--muted-foreground)] mx-auto mb-2 opacity-40" />
              <p className="text-[12px] text-[var(--muted-foreground)]">
                No notes in this notebook
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {notes.map((note) => (
                <div
                  key={note.id}
                  onClick={() => {
                    setSelectedNote(note);
                    setEditTitle(note.title);
                    setEditContent(note.content);
                    setEditing(false);
                  }}
                  className={cn(
                    'p-3 rounded-lg cursor-pointer transition-colors',
                    selectedNote?.id === note.id
                      ? 'bg-[var(--card)] border border-[var(--primary)]/30'
                      : 'hover:bg-[var(--card)] border border-transparent',
                  )}
                >
                  <p className="text-[12px] font-medium text-[var(--foreground)] truncate">
                    {note.title}
                  </p>
                  <p className="text-[11px] text-[var(--muted-foreground)] line-clamp-2 mt-1">
                    {note.content}
                  </p>
                  <p className="text-[10px] text-[var(--muted-foreground)] mt-1 flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {new Date(note.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel — Note Editor */}
      <div className="flex-1 flex flex-col bg-[var(--background)]">
        {selectedNote ? (
          <>
            {/* Editor Header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-3">
              {editing ? (
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-lg font-semibold text-[var(--foreground)] bg-transparent outline-none flex-1 border-b border-[var(--primary)]"
                />
              ) : (
                <h1 className="text-lg font-semibold text-[var(--foreground)]">
                  {selectedNote.title}
                </h1>
              )}
              <div className="flex items-center gap-2">
                {editing ? (
                  <>
                    <button
                      onClick={handleSaveNote}
                      className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 flex items-center gap-1.5"
                    >
                      <Save className="h-3.5 w-3.5" />
                      Save
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      className="p-1.5 rounded-lg hover:bg-[var(--muted)] transition-colors"
                    >
                      <X className="h-4 w-4 text-[var(--muted-foreground)]" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setEditing(true)}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent)] transition-colors flex items-center gap-1.5"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit
                  </button>
                )}
              </div>
            </div>

            {/* Editor Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {editing ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full h-full bg-transparent text-[14px] text-[var(--foreground)] leading-relaxed outline-none resize-none"
                  placeholder="Write your note..."
                />
              ) : (
                <div className="prose prose-sm max-w-none text-[var(--foreground)]">
                  <div className="text-[14px] leading-relaxed whitespace-pre-wrap">
                    {selectedNote.content}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-[var(--border)] px-6 py-2 flex items-center justify-between">
              <span className="text-[11px] text-[var(--muted-foreground)]">
                Created: {new Date(selectedNote.createdAt).toLocaleString()}
              </span>
              <span className="text-[11px] text-[var(--muted-foreground)]">
                Updated: {new Date(selectedNote.updatedAt).toLocaleString()}
              </span>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileText className="h-12 w-12 text-[var(--muted-foreground)] mx-auto mb-4 opacity-30" />
              <p className="text-[14px] text-[var(--muted-foreground)]">
                {selectedNotebook
                  ? 'Select a note to view or edit'
                  : 'Select a notebook from the left panel'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
