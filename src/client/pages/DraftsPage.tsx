import React, { useEffect, useState } from 'react';
import { X, Copy, Trash2, Check, Eye, Edit3 } from 'lucide-react';
import { api, type DraftSummary, type DraftFull } from '../api.js';
import Markdown from '../components/Markdown.js';
import { useToast } from '../components/Toast.js';
import { timeAgo } from '../utils/format.js';

const TYPES = ['all', 'blog_post', 'tweet', 'linkedin', 'newsletter', 'email', 'code', 'prd', 'report'];
const STATUS_OPTIONS = ['all', 'draft', 'approved', 'published'];

const TYPE_EMOJI: Record<string, string> = {
  blog_post: '📝', tweet: '🐦', linkedin: '💼', newsletter: '📧',
  email: '✉️', code: '💻', prd: '📋', report: '📊',
};

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<DraftFull | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const { toast } = useToast();

  const load = () =>
    api.drafts.list({ limit: 50 }).then(setDrafts).catch(console.error);

  useEffect(() => { load(); }, []);

  const filtered = drafts.filter(
    (d) =>
      (typeFilter === 'all' || d.contentType === typeFilter) &&
      (statusFilter === 'all' || d.status === statusFilter),
  );

  const openDraft = async (id: string) => {
    const full = await api.drafts.get(id);
    setSelected(full);
    setEditContent(full.content);
    setEditing(false);
  };

  const saveEdit = async () => {
    if (!selected) return;
    await api.drafts.update(selected.id, { content: editContent });
    setSelected({ ...selected, content: editContent });
    setEditing(false);
    toast('Draft saved');
    load();
  };

  const updateStatus = async (status: string) => {
    if (!selected) return;
    await api.drafts.update(selected.id, { status });
    setSelected({ ...selected, status });
    toast(`Status: ${status}`);
    load();
  };

  const deleteDraft = async (id: string) => {
    await api.drafts.delete(id);
    toast('Draft deleted', 'error');
    if (selected?.id === id) setSelected(null);
    load();
  };

  const copyContent = (content: string) => {
    navigator.clipboard.writeText(content);
    toast('Copied to clipboard');
  };

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Drafts</h1>
          <p className="text-sm text-[#a1a1aa] mt-0.5">{drafts.length} saved by your agents</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <div className="flex gap-1 bg-[#141416] border border-[#2a2a2e] rounded-lg p-1">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors capitalize ${
                typeFilter === t ? 'bg-[#6366f1] text-white' : 'text-[#a1a1aa] hover:text-white'
              }`}
            >
              {t === 'all' ? 'All types' : t.replace('_', ' ')}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-[#141416] border border-[#2a2a2e] rounded-lg p-1">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors capitalize ${
                statusFilter === s ? 'bg-[#6366f1] text-white' : 'text-[#a1a1aa] hover:text-white'
              }`}
            >
              {s === 'all' ? 'All status' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Draft list */}
      {filtered.length === 0 ? (
        <div className="card p-8 text-center text-[#52525b] text-sm">
          No drafts yet. Agents save drafts automatically when they create content.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => (
            <div key={d.id} className="card p-5 hover:border-[#3f3f46] transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="text-2xl mt-0.5 flex-shrink-0">
                    {TYPE_EMOJI[d.contentType] ?? '📄'}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{d.title}</div>
                    <div className="flex items-center gap-2 mt-0.5 mb-2">
                      <span className="text-xs text-[#a1a1aa] capitalize">{d.contentType.replace('_', ' ')}</span>
                      <span className="text-[#2a2a2e]">·</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${
                        d.status === 'approved' ? 'bg-green-500/10 text-green-400' :
                        d.status === 'published' ? 'bg-blue-500/10 text-blue-400' :
                        'bg-[#1c1c20] text-[#a1a1aa]'
                      }`}>{d.status}</span>
                      <span className="text-[#2a2a2e]">·</span>
                      <span className="text-xs text-[#52525b]">{timeAgo(d.createdAt ?? '')}</span>
                    </div>
                    <p className="text-sm text-[#a1a1aa] line-clamp-2">{d.preview}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => openDraft(d.id)} className="btn-ghost p-2">
                    <Eye size={15} />
                  </button>
                  <button onClick={() => deleteDraft(d.id)} className="btn-ghost p-2 hover:text-red-400">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-end p-4" onClick={() => setSelected(null)}>
          <div
            className="bg-[#141416] border border-[#2a2a2e] rounded-xl w-full max-w-2xl h-full max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between p-5 border-b border-[#2a2a2e]">
              <div>
                <div className="text-sm font-semibold text-white">{selected.title}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-[#a1a1aa] capitalize">{selected.contentType.replace('_', ' ')}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${
                    selected.status === 'approved' ? 'bg-green-500/10 text-green-400' :
                    selected.status === 'published' ? 'bg-blue-500/10 text-blue-400' :
                    'bg-[#1c1c20] text-[#a1a1aa]'
                  }`}>{selected.status}</span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="btn-ghost p-2">
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {editing ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="input h-full min-h-64 font-mono text-xs"
                />
              ) : (
                <Markdown content={selected.content} />
              )}
            </div>

            {/* Actions */}
            <div className="border-t border-[#2a2a2e] p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {editing ? (
                  <>
                    <button onClick={saveEdit} className="btn-primary flex items-center gap-1.5 text-xs">
                      <Check size={13} /> Save
                    </button>
                    <button onClick={() => setEditing(false)} className="btn-ghost text-xs">Cancel</button>
                  </>
                ) : (
                  <button onClick={() => setEditing(true)} className="btn-ghost flex items-center gap-1.5 text-xs">
                    <Edit3 size={13} /> Edit
                  </button>
                )}
                <button onClick={() => copyContent(selected.content)} className="btn-ghost flex items-center gap-1.5 text-xs">
                  <Copy size={13} /> Copy
                </button>
              </div>
              <div className="flex items-center gap-2">
                {selected.status === 'draft' && (
                  <button onClick={() => updateStatus('approved')} className="text-xs px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-lg transition-colors">
                    ✅ Approve
                  </button>
                )}
                {selected.status === 'approved' && (
                  <button onClick={() => updateStatus('published')} className="text-xs px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors">
                    🚀 Publish
                  </button>
                )}
                <button onClick={() => deleteDraft(selected.id)} className="btn-danger text-xs">
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
