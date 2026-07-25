import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/api/users.api';
import { keysApi, ApiKey } from '@/api/keys.api';
import {
  Bell,
  Mail,
  Slack,
  Save,
  ShieldAlert,
  Loader2,
  Key,
  Plus,
  Trash2,
  Calendar,
  Copy,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'notifications' | 'keys'>('notifications');

  // Form states for notification preferences
  const [notifForm, setNotifForm] = useState({
    emailEnabled: true,
    slackEnabled: false,
    slackWebhook: '',
    onFailure: true,
    onSuccess: false,
    onDeploy: true,
    onRecovery: true,
  });

  // API Key creation states
  const [keyName, setKeyName] = useState('');
  const [keyExpiry, setKeyExpiry] = useState<number | ''>('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Queries
  const { data: prefs, isLoading: isPrefsLoading } = useQuery({
    queryKey: ['notification-prefs'],
    queryFn: () => usersApi.getNotifications(),
    enabled: activeTab === 'notifications',
  });

  const { data: apiKeys, isLoading: isKeysLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => keysApi.list(),
    enabled: activeTab === 'keys',
  });

  // Sync prefs query to state
  useEffect(() => {
    if (prefs) {
      setNotifForm({
        emailEnabled: prefs.emailEnabled,
        slackEnabled: prefs.slackEnabled,
        slackWebhook: prefs.slackWebhook || '',
        onFailure: prefs.onFailure,
        onSuccess: prefs.onSuccess,
        onDeploy: prefs.onDeploy,
        onRecovery: prefs.onRecovery,
      });
    }
  }, [prefs]);

  // Mutations
  const saveNotifMutation = useMutation({
    mutationFn: (data: typeof notifForm) => usersApi.updateNotifications(data),
    onSuccess: () => {
      toast.success('Notification settings saved successfully!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message ?? 'Failed to save settings');
    },
  });

  const createKeyMutation = useMutation({
    mutationFn: (data: { name: string; expiresInDays?: number }) => keysApi.create(data),
    onSuccess: (newKey) => {
      toast.success('Programmatic API Key generated!');
      setGeneratedKey(newKey.rawKey || null);
      setKeyName('');
      setKeyExpiry('');
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message ?? 'Failed to generate key');
    },
  });

  const revokeKeyMutation = useMutation({
    mutationFn: (id: string) => keysApi.revoke(id),
    onSuccess: () => {
      toast.success('API Key successfully revoked');
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message ?? 'Failed to revoke key');
    },
  });

  const handleNotifSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (notifForm.slackEnabled && !notifForm.slackWebhook) {
      toast.error('Slack Webhook URL is required.');
      return;
    }
    saveNotifMutation.mutate(notifForm);
  };

  const handleCreateKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) return;
    createKeyMutation.mutate({
      name: keyName.trim(),
      expiresInDays: keyExpiry ? Number(keyExpiry) : undefined,
    });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    toast.success('API Key copied to clipboard!');
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleRevokeKey = (id: string, name: string) => {
    if (confirm(`Are you sure you want to revoke key "${name}"? Programmatic requests using this key will fail immediately.`)) {
      revokeKeyMutation.mutate(id);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-dark-300 mt-1">Configure your alert preferences and developer tokens</p>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-white/[0.06] gap-6 text-sm">
        <button
          onClick={() => {
            setActiveTab('notifications');
            setGeneratedKey(null);
          }}
          className={`pb-3 font-semibold transition-all ${
            activeTab === 'notifications'
              ? 'text-brand-400 border-b-2 border-brand-400'
              : 'text-dark-300 hover:text-white'
          }`}
        >
          Alerts & Notifications
        </button>
        <button
          onClick={() => setActiveTab('keys')}
          className={`pb-3 font-semibold transition-all ${
            activeTab === 'keys'
              ? 'text-brand-400 border-b-2 border-brand-400'
              : 'text-dark-300 hover:text-white'
          }`}
        >
          Programmatic API Keys
        </button>
      </div>

      {/* Tab 1 Content: Notifications */}
      {activeTab === 'notifications' && (
        isPrefsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleNotifSubmit} className="space-y-6 animate-fade-in">
            {/* Alert Channels */}
            <div className="glass-card p-6 space-y-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/[0.06] pb-3">
                <Bell className="w-4.5 h-4.5 text-brand-400" />
                Alert Channels
              </h2>

              <div className="space-y-4">
                {/* Email Channel */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <Mail className="w-5 h-5 text-dark-300 mt-0.5" />
                    <div>
                      <h3 className="text-xs font-semibold text-white">Email Alerts</h3>
                      <p className="text-[11px] text-dark-300 leading-relaxed mt-0.5">
                        Receive HTML digest reports with Groq failure summaries directly in your mailbox.
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifForm.emailEnabled}
                      onChange={(e) => setNotifForm((f) => ({ ...f, emailEnabled: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-dark-600 rounded-full peer peer-focus:ring-1 peer-focus:ring-brand-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-600" />
                  </label>
                </div>

                {/* Slack Channel */}
                <div className="flex items-start justify-between gap-4 border-t border-white/[0.04] pt-4">
                  <div className="flex gap-3">
                    <Slack className="w-5 h-5 text-[#4a154b] mt-0.5" />
                    <div>
                      <h3 className="text-xs font-semibold text-white">Slack Notifications</h3>
                      <p className="text-[11px] text-dark-300 leading-relaxed mt-0.5">
                        Stream interactive message cards containing build timelines and AI fixes to a Slack channel.
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifForm.slackEnabled}
                      onChange={(e) => setNotifForm((f) => ({ ...f, slackEnabled: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-dark-600 rounded-full peer peer-focus:ring-1 peer-focus:ring-brand-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-600" />
                  </label>
                </div>

                {/* Slack Webhook Input */}
                {notifForm.slackEnabled && (
                  <div className="pl-8 pt-2 animate-fade-in">
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-dark-300 mb-1.5">
                      Incoming Slack Webhook URL
                    </label>
                    <input
                      type="url"
                      required
                      placeholder="https://hooks.slack.com/services/..."
                      value={notifForm.slackWebhook}
                      onChange={(e) => setNotifForm((f) => ({ ...f, slackWebhook: e.target.value }))}
                      className="input-field py-2 text-xs font-mono"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Triggers */}
            <div className="glass-card p-6 space-y-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/[0.06] pb-3">
                <ShieldAlert className="w-4.5 h-4.5 text-danger-500" />
                Alert Event Triggers
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Trigger 1: Failure */}
                <label className="flex items-center justify-between p-3 rounded-lg border border-white/[0.05] bg-dark-800/40 cursor-pointer hover:bg-white/[0.01]">
                  <div>
                    <p className="text-xs font-semibold text-white">On Failure</p>
                    <p className="text-[9px] text-dark-300 mt-0.5">Alert immediately when builds fail</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifForm.onFailure}
                    onChange={(e) => setNotifForm((f) => ({ ...f, onFailure: e.target.checked }))}
                    className="rounded border-white/10 text-brand-600 focus:ring-brand-500 bg-dark-700"
                  />
                </label>

                {/* Trigger 2: Recovery */}
                <label className="flex items-center justify-between p-3 rounded-lg border border-white/[0.05] bg-dark-800/40 cursor-pointer hover:bg-white/[0.01]">
                  <div>
                    <p className="text-xs font-semibold text-white">On Recovery</p>
                    <p className="text-[9px] text-dark-300 mt-0.5">Alert when a failing pipeline returns to success</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifForm.onRecovery}
                    onChange={(e) => setNotifForm((f) => ({ ...f, onRecovery: e.target.checked }))}
                    className="rounded border-white/10 text-brand-600 focus:ring-brand-500 bg-dark-700"
                  />
                </label>

                {/* Trigger 3: Success */}
                <label className="flex items-center justify-between p-3 rounded-lg border border-white/[0.05] bg-dark-800/40 cursor-pointer hover:bg-white/[0.01]">
                  <div>
                    <p className="text-xs font-semibold text-white">On Success</p>
                    <p className="text-[9px] text-dark-300 mt-0.5">Receive reports for all successful builds</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifForm.onSuccess}
                    onChange={(e) => setNotifForm((f) => ({ ...f, onSuccess: e.target.checked }))}
                    className="rounded border-white/10 text-brand-600 focus:ring-brand-500 bg-dark-700"
                  />
                </label>

                {/* Trigger 4: Deploy */}
                <label className="flex items-center justify-between p-3 rounded-lg border border-white/[0.05] bg-dark-800/40 cursor-pointer hover:bg-white/[0.01]">
                  <div>
                    <p className="text-xs font-semibold text-white">On Deploy</p>
                    <p className="text-[9px] text-dark-300 mt-0.5">Receive alerts on all production/staging deploys</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifForm.onDeploy}
                    onChange={(e) => setNotifForm((f) => ({ ...f, onDeploy: e.target.checked }))}
                    className="rounded border-white/10 text-brand-600 focus:ring-brand-500 bg-dark-700"
                  />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <button
                type="submit"
                disabled={saveNotifMutation.isPending}
                className="btn-primary px-6"
              >
                {saveNotifMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Saving...</>
                ) : (
                  <><Save className="w-4 h-4" />Save Preferences</>
                )}
              </button>
            </div>
          </form>
        )
      )}

      {/* Tab 2 Content: API Keys */}
      {activeTab === 'keys' && (
        <div className="space-y-6 animate-fade-in">
          {/* Create Key Form */}
          <div className="glass-card p-6">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/[0.06] pb-3 mb-4">
              <Key className="w-4.5 h-4.5 text-brand-400" />
              Generate programmatic API Key
            </h2>

            {generatedKey ? (
              <div className="bg-brand-600/10 border border-brand-500/20 p-4 rounded-lg space-y-3">
                <p className="text-xs text-brand-400 font-semibold">⚠️ Copy your API Key now!</p>
                <p className="text-[11px] text-dark-300">
                  For security, we cannot show this key again. Save it securely to trigger builds programmatically.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedKey}
                    className="input-field font-mono text-xs py-2 bg-dark-800 text-brand-400 select-all"
                  />
                  <button
                    onClick={() => handleCopy(generatedKey)}
                    className="btn-primary p-2.5 rounded-lg flex items-center justify-center flex-shrink-0"
                  >
                    {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  onClick={() => setGeneratedKey(null)}
                  className="btn-ghost text-[10px] uppercase font-bold tracking-wider pt-1 hover:text-white"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateKey} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-semibold text-dark-300 mb-1.5">Key Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Jenkins Trigger Key"
                      value={keyName}
                      onChange={(e) => setKeyName(e.target.value)}
                      className="input-field py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-semibold text-dark-300 mb-1.5">Expiration (Days)</label>
                    <input
                      type="number"
                      placeholder="Never expires"
                      value={keyExpiry}
                      onChange={(e) => setKeyExpiry(e.target.value ? Number(e.target.value) : '')}
                      className="input-field py-2 text-xs"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end pt-2">
                  <button
                    type="submit"
                    disabled={createKeyMutation.isPending}
                    className="btn-primary"
                  >
                    <Plus className="w-4 h-4" />
                    Generate Key
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Keys List */}
          <div className="glass-card p-6">
            <h2 className="text-sm font-bold text-white border-b border-white/[0.06] pb-3 mb-4">
              Your Active API Keys
            </h2>

            {isKeysLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
              </div>
            ) : !apiKeys || apiKeys.length === 0 ? (
              <p className="text-xs text-dark-300 py-6 text-center">No active API keys found.</p>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {apiKeys.map((key: ApiKey) => (
                  <div key={key.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                    <div className="space-y-1">
                      <h3 className="text-xs font-semibold text-white">{key.name}</h3>
                      <div className="flex items-center gap-2 text-[10px] text-dark-300 font-mono">
                        <span>{key.maskedKey}</span>
                        <span>•</span>
                        {key.expiresAt ? (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Expires {new Date(key.expiresAt).toLocaleDateString()}
                          </span>
                        ) : (
                          <span>Never expires</span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleRevokeKey(key.id, key.name)}
                      disabled={revokeKeyMutation.isPending}
                      className="p-1.5 rounded text-danger-500 hover:text-red-400 hover:bg-danger-500/10 transition-colors"
                      title="Revoke API Key"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
