import React, { useEffect, useState } from 'react';
import { Save, AlertTriangle } from 'lucide-react';
import { api, type Settings } from '../api.js';
import { useToast } from '../components/Toast.js';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState<Partial<Settings>>({});
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | string>(null);
  const { toast } = useToast();

  useEffect(() => {
    api.settings.get().then((s) => {
      setSettings(s);
      setForm(s);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    await api.settings.update(form);
    setSettings({ ...(settings!), ...form });
    toast('Settings saved');
    setSaving(false);
  };

  const dangerAction = async (action: string) => {
    try {
      if (action === 'clear-conversations') await api.settings.clearConversations();
      if (action === 'clear-drafts') await api.settings.clearDrafts();
      if (action === 'reset-spend') await api.settings.resetSpend();
      toast(`Done: ${action.replace('-', ' ')}`);
    } catch {
      toast('Action failed', 'error');
    }
    setConfirmAction(null);
  };

  if (!settings) {
    return (
      <div className="p-8">
        <div className="h-8 w-32 bg-[#1c1c20] rounded animate-pulse mb-6" />
        <div className="space-y-4">
          {[0, 1, 2].map((i) => <div key={i} className="card h-40 animate-pulse bg-[#1c1c20]" />)}
        </div>
      </div>
    );
  }

  const budgetPct = settings.todaySpend / (form.dailyBudget ?? settings.dailyBudget) * 100;

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-[#a1a1aa] mt-0.5">Business context and system configuration</p>
      </div>

      {/* Business profile */}
      <div className="card p-6 mb-4">
        <h2 className="text-sm font-semibold text-white mb-4">Business Profile</h2>
        <div className="space-y-4">
          <div>
            <label className="label">Business Name</label>
            <input
              className="input"
              value={form.businessName ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
              placeholder="My SaaS Product"
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input h-20 resize-none"
              value={form.businessDesc ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, businessDesc: e.target.value }))}
              placeholder="We help freelancers automate their invoicing..."
            />
          </div>
          <div>
            <label className="label">Target Audience</label>
            <input
              className="input"
              value={form.targetAudience ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, targetAudience: e.target.value }))}
              placeholder="Freelancers and small agencies"
            />
          </div>
          <div>
            <label className="label">Product URL</label>
            <input
              className="input"
              value={form.productUrl ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, productUrl: e.target.value }))}
              placeholder="https://myproduct.com"
            />
          </div>
          <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
            <Save size={14} />
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Budget */}
      <div className="card p-6 mb-4">
        <h2 className="text-sm font-semibold text-white mb-4">Daily Budget</h2>
        <div className="space-y-4">
          <div>
            <label className="label">Daily Limit ($)</label>
            <input
              type="number"
              step="0.5"
              min="0"
              className="input"
              value={form.dailyBudget ?? settings.dailyBudget}
              onChange={(e) => setForm((f) => ({ ...f, dailyBudget: parseFloat(e.target.value) }))}
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-[#a1a1aa] mb-2">
              <span>Today's spend: ${settings.todaySpend.toFixed(4)}</span>
              <span>{Math.min(100, budgetPct).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-[#1c1c20] rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  budgetPct >= 100 ? 'bg-red-500' : budgetPct >= 80 ? 'bg-yellow-500' : 'bg-[#6366f1]'
                }`}
                style={{ width: `${Math.min(100, budgetPct)}%` }}
              />
            </div>
          </div>

          <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
            <Save size={14} />
            {saving ? 'Saving…' : 'Save Budget'}
          </button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="card p-6 border-red-500/20">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={16} className="text-red-400" />
          <h2 className="text-sm font-semibold text-red-400">Danger Zone</h2>
        </div>
        <div className="space-y-3">
          {[
            { action: 'clear-conversations', label: 'Clear All Conversations', desc: 'Reset all agent memory' },
            { action: 'clear-drafts', label: 'Delete All Drafts', desc: 'Permanently delete all saved drafts' },
            { action: 'reset-spend', label: 'Reset Spend Tracking', desc: 'Clear all daily spend records' },
          ].map(({ action, label, desc }) => (
            <div key={action} className="flex items-center justify-between py-2 border-b border-[#2a2a2e] last:border-0">
              <div>
                <div className="text-sm text-white">{label}</div>
                <div className="text-xs text-[#52525b]">{desc}</div>
              </div>
              {confirmAction === action ? (
                <div className="flex items-center gap-2">
                  <button onClick={() => dangerAction(action)} className="btn-danger text-xs px-3 py-1.5">
                    Confirm
                  </button>
                  <button onClick={() => setConfirmAction(null)} className="btn-ghost text-xs">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setConfirmAction(action)} className="btn-danger text-xs">
                  {label.split(' ')[0]}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
