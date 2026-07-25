import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repositoriesApi, Repository } from '@/api/repositories.api';
import { BookOpen, Plus, Trash2, HelpCircle, Link2, Shield, Info, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function RepositoriesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [connectName, setConnectName] = useState('');
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [selectedInstructionsRepo, setSelectedInstructionsRepo] = useState<string | null>(null);

  // Queries
  const { data: reposData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['repos', search],
    queryFn: () => repositoriesApi.list({ search }),
  });

  const { data: webhookInstructions, isLoading: isLoadingInstructions } = useQuery({
    queryKey: ['webhook-instructions', selectedInstructionsRepo],
    queryFn: () => repositoriesApi.getWebhookInstructions(selectedInstructionsRepo!),
    enabled: !!selectedInstructionsRepo,
  });

  // Mutations
  const connectMutation = useMutation({
    mutationFn: (fullName: string) => repositoriesApi.connect(fullName),
    onSuccess: (newRepo) => {
      toast.success(`Successfully connected ${newRepo.fullName}!`);
      setIsConnectOpen(false);
      setConnectName('');
      queryClient.invalidateQueries({ queryKey: ['repos'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error?.message ?? 'Failed to connect repository';
      toast.error(msg);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => repositoriesApi.disconnect(id),
    onSuccess: () => {
      toast.success('Repository disconnected');
      queryClient.invalidateQueries({ queryKey: ['repos'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message ?? 'Failed to disconnect');
    },
  });

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectName.includes('/')) {
      toast.error('Format must be owner/repository (e.g. facebook/react)');
      return;
    }
    connectMutation.mutate(connectName.trim());
  };

  const handleDisconnect = (id: string, name: string) => {
    if (confirm(`Are you sure you want to disconnect ${name}? All historic pipeline runs will be deleted.`)) {
      disconnectMutation.mutate(id);
    }
  };

  const repos = reposData?.data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Repositories</h1>
          <p className="text-sm text-dark-300 mt-1">Connect and configure GitHub repositories for CI/CD tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="btn-ghost p-2.5 rounded-lg flex items-center justify-center"
            title="Refresh repositories"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsConnectOpen(true)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            Connect Repository
          </button>
        </div>
      </div>

      {/* Main List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="glass-card p-6 h-48 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="h-4 w-32 skeleton" />
                <div className="h-3 w-48 skeleton" />
              </div>
              <div className="h-8 w-24 skeleton" />
            </div>
          ))}
        </div>
      ) : repos.length === 0 ? (
        <div className="glass-card p-12 text-center max-w-xl mx-auto space-y-4">
          <BookOpen className="w-12 h-12 text-dark-400 mx-auto" />
          <h3 className="text-lg font-semibold text-white">No Connected Repositories</h3>
          <p className="text-sm text-dark-300">
            Connect a GitHub repository using the "Connect Repository" button to start receiving and analyzing workflow runs.
          </p>
          <button
            onClick={() => setIsConnectOpen(true)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            Connect Your First Repo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {repos.map((repo: Repository) => (
            <div key={repo.id} className="glass-card-hover p-6 flex flex-col justify-between h-56 relative group">
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-white truncate flex items-center gap-1.5" title={repo.fullName}>
                      {repo.name}
                      {repo.isPrivate ? (
                        <Shield className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
                      ) : (
                        <Link2 className="w-3.5 h-3.5 text-dark-300 flex-shrink-0" />
                      )}
                    </h3>
                    <p className="text-xs text-dark-300 truncate mt-0.5">{repo.fullName}</p>
                  </div>

                  {/* Health Score Gauge */}
                  <div className="flex flex-col items-center">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${
                      repo.healthScore >= 80 ? 'bg-success-500/10 text-success-500 border border-success-500/20 shadow-glow-success' :
                      repo.healthScore >= 50 ? 'bg-warning-500/10 text-warning-500 border border-warning-500/20' :
                      'bg-danger-500/10 text-danger-500 border border-danger-500/20 shadow-glow-danger'
                    }`}>
                      {repo.healthScore}
                    </div>
                    <span className="text-[9px] text-dark-300 font-medium mt-1">Health</span>
                  </div>
                </div>

                <p className="text-xs text-dark-300 line-clamp-2 mt-3 mb-2 min-h-[32px]">{repo.description || 'No description provided.'}</p>
              </div>

              <div className="flex items-center justify-between border-t border-white/[0.06] pt-4 mt-auto">
                <div className="flex items-center gap-4">
                  <span className="text-xs text-dark-300">
                    Pipelines: <strong className="text-white">{repo._count?.pipelines ?? 0}</strong>
                  </span>
                  {repo.language && (
                    <span className="text-xs bg-dark-600 px-2 py-0.5 rounded text-dark-300 font-mono">
                      {repo.language}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSelectedInstructionsRepo(repo.id)}
                    className="p-1.5 rounded text-dark-300 hover:text-white hover:bg-white/5 transition-colors"
                    title="Webhook setup instructions"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDisconnect(repo.id, repo.fullName)}
                    disabled={disconnectMutation.isPending}
                    className="p-1.5 rounded text-danger-500 hover:text-red-400 hover:bg-danger-500/10 transition-colors"
                    title="Disconnect repository"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Connect Modal */}
      {isConnectOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md p-6 border-white/10 animate-fade-in">
            <h2 className="text-lg font-bold text-white mb-2">Connect GitHub Repository</h2>
            <p className="text-xs text-dark-300 mb-4">
              Enter the full name of the public repository (or private, if a token is configured) in the "owner/repository" format.
            </p>

            <form onSubmit={handleConnect} className="space-y-4">
              <div>
                <label className="block text-xs text-dark-300 mb-1.5">Repository Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. facebook/react"
                  value={connectName}
                  onChange={(e) => setConnectName(e.target.value)}
                  className="input-field"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsConnectOpen(false)}
                  className="btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connectMutation.isPending}
                  className="btn-primary"
                >
                  {connectMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Connecting...</>
                  ) : (
                    'Connect'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Instructions Modal */}
      {selectedInstructionsRepo && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-lg p-6 border-white/10 max-h-[85vh] overflow-y-auto animate-fade-in">
            <h2 className="text-lg font-bold text-white mb-2">Webhook Configuration Instructions</h2>
            
            {isLoadingInstructions ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
                <span className="text-xs text-dark-300">Generating webhook secret...</span>
              </div>
            ) : webhookInstructions ? (
              <div className="space-y-4">
                <div className="bg-brand-600/10 border border-brand-500/20 p-4 rounded-lg flex items-start gap-3">
                  <Info className="w-5 h-5 text-brand-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs leading-relaxed text-dark-300">
                    To receive real-time build and deployment updates, configure this webhook in your GitHub repository settings.
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-dark-300 mb-1">Payload URL</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={webhookInstructions.webhookUrl}
                        className="input-field py-1.5 font-mono text-xs bg-dark-800 text-dark-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-dark-300 mb-1">Secret</label>
                    <input
                      type="text"
                      readOnly
                      value={webhookInstructions.secret}
                      className="input-field py-1.5 font-mono text-xs bg-dark-800 text-dark-300"
                    />
                  </div>
                </div>

                <div className="border-t border-white/[0.06] pt-4">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-dark-300 mb-2">Step-by-step Setup</label>
                  <ol className="list-decimal list-inside space-y-2 text-xs text-dark-300 leading-relaxed pl-1">
                    {webhookInstructions.instructions.map((step, idx) => (
                      <li key={idx} className="marker:text-brand-400 marker:font-bold">
                        {idx === 0 ? (
                          <a
                            href={step.match(/https?:\/\/[^\s]+/)?.[0]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-400 hover:underline inline-flex items-center gap-0.5"
                          >
                            Open GitHub Settings <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : step}
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="flex justify-end pt-2 border-t border-white/[0.06]">
                  <button
                    onClick={() => setSelectedInstructionsRepo(null)}
                    className="btn-primary"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
