import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { pipelinesApi, PipelineRun } from '@/api/pipelines.api';
import { Link } from 'react-router-dom';
import { useSocket } from '@/hooks/useSocket';
import {
  GitBranch,
  Search,
  Filter,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function PipelinesPage() {
  const queryClient = useQueryClient();
  const socket = useSocket();

  // Filter States
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [conclusion, setConclusion] = useState('');

  // API query
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['pipelines', page, search, status, conclusion],
    queryFn: () =>
      pipelinesApi.listRuns({
        page,
        limit: 15,
        search,
        status: status || undefined,
        conclusion: conclusion || undefined,
      }),
  });

  // Real-time socket events for runs list
  useEffect(() => {
    // When socket is connected, register listener for updates
    if (socket.isConnected) {
      socket.on('pipeline:update', (updatedRun: any) => {
        // Optimistically update React Query cache for the runs list
        queryClient.setQueryData(
          ['pipelines', page, search, status, conclusion],
          (oldData: any) => {
            if (!oldData) return oldData;
            const updatedList = oldData.data.map((run: PipelineRun) =>
              run.id === updatedRun.id ? { ...run, ...updatedRun } : run
            );

            // If the updated run wasn't in the list and it matches filters,
            // we'd invalidate to fetch the clean list, else just update existing.
            const exists = oldData.data.some((run: PipelineRun) => run.id === updatedRun.id);
            if (!exists && page === 1) {
              // Invalidate to fetch fresh list at start
              queryClient.invalidateQueries({ queryKey: ['pipelines'] });
            }

            return { ...oldData, data: updatedList };
          }
        );
      });
    }

    return () => {
      socket.off('pipeline:update');
    };
  }, [socket.isConnected, page, search, status, conclusion, queryClient]);

  const runs = data?.data ?? [];
  const meta = data?.meta;

  const getStatusIcon = (run: PipelineRun) => {
    if (run.status === 'QUEUED') return <Clock className="w-4 h-4 text-warning-500 animate-pulse" />;
    if (run.status === 'IN_PROGRESS') return <Play className="w-4 h-4 text-brand-400 animate-spin" />;
    
    if (run.conclusion === 'SUCCESS') return <CheckCircle2 className="w-4 h-4 text-success-500" />;
    if (run.conclusion === 'FAILURE') return <XCircle className="w-4 h-4 text-danger-500" />;
    return <Clock className="w-4 h-4 text-dark-300" />;
  };

  const getStatusClass = (run: PipelineRun) => {
    if (run.status === 'QUEUED') return 'status-queued';
    if (run.status === 'IN_PROGRESS') return 'status-running';
    
    if (run.conclusion === 'SUCCESS') return 'status-success';
    if (run.conclusion === 'FAILURE') return 'status-failure';
    return 'status-cancelled';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Pipeline Runs</h1>
          <p className="text-sm text-dark-300 mt-1">Track and monitor your GitHub Actions workflow runs in real time</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="btn-ghost"
        >
          <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters Bar */}
      <div className="glass-card p-4 flex flex-col md:flex-row items-center gap-4 justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-300" />
          <input
            type="text"
            placeholder="Search commits, workflows..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="input-field pl-9 py-2"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 w-1/2 md:w-40">
            <Filter className="w-3.5 h-3.5 text-dark-300 flex-shrink-0" />
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="input-field py-1.5 text-xs bg-dark-700 border-white/5"
            >
              <option value="">All Statuses</option>
              <option value="QUEUED">Queued</option>
              <option value="IN_PROGRESS">Running</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 w-1/2 md:w-40">
            <Filter className="w-3.5 h-3.5 text-dark-300 flex-shrink-0" />
            <select
              value={conclusion}
              onChange={(e) => {
                setConclusion(e.target.value);
                setPage(1);
              }}
              className="input-field py-1.5 text-xs bg-dark-700 border-white/5"
            >
              <option value="">All Conclusions</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILURE">Failure</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="TIMED_OUT">Timed Out</option>
            </select>
          </div>
        </div>
      </div>

      {/* Runs List Table */}
      {isLoading ? (
        <div className="glass-card p-6 space-y-4">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="flex items-center justify-between py-3 border-b border-white/5">
              <div className="flex items-center gap-4">
                <div className="w-5 h-5 skeleton rounded-full" />
                <div className="space-y-1.5">
                  <div className="h-4 w-40 skeleton" />
                  <div className="h-3 w-64 skeleton" />
                </div>
              </div>
              <div className="h-6 w-20 skeleton" />
            </div>
          ))}
        </div>
      ) : runs.length === 0 ? (
        <div className="glass-card p-12 text-center max-w-xl mx-auto space-y-4">
          <GitBranch className="w-12 h-12 text-dark-400 mx-auto" />
          <h3 className="text-lg font-semibold text-white">No Pipeline Runs Found</h3>
          <p className="text-sm text-dark-300">
            No pipeline runs match the current filters. Ensure your GitHub webhooks are active and running.
          </p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.06] text-xs font-semibold uppercase tracking-wider text-dark-300">
                  <th className="px-6 py-4">Pipeline / Repo</th>
                  <th className="px-6 py-4">Commit / Branch</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Duration</th>
                  <th className="px-6 py-4">Triggered</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {runs.map((run: PipelineRun) => (
                  <tr key={run.id} className="hover:bg-white/[0.02] transition-colors group">
                    {/* Pipeline / Repo */}
                    <td className="px-6 py-4">
                      <div className="min-w-0">
                        <Link to={`/pipelines/${run.id}`} className="text-sm font-semibold text-white hover:text-brand-400 truncate block">
                          {run.pipeline.name}
                        </Link>
                        <span className="text-[11px] text-dark-300 block truncate mt-0.5">
                          {run.pipeline.repository.fullName}
                        </span>
                      </div>
                    </td>

                    {/* Commit / Branch */}
                    <td className="px-6 py-4">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-white truncate max-w-xs">{run.commitMessage || 'No commit message'}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center gap-1 bg-dark-600 px-1.5 py-0.5 rounded text-[10px] text-dark-300 font-mono">
                            <GitBranch className="w-2.5 h-2.5" />
                            {run.branch}
                          </span>
                          <span className="text-[10px] text-dark-300 font-mono">
                            {run.commitSha.slice(0, 7)}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Status badge */}
                    <td className="px-6 py-4">
                      <span className={`status-badge ${getStatusClass(run)}`}>
                        {getStatusIcon(run)}
                        {run.conclusion || run.status}
                      </span>
                    </td>

                    {/* Duration */}
                    <td className="px-6 py-4 text-xs text-dark-300">
                      {run.durationMs ? (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-dark-300" />
                          {Math.floor(run.durationMs / 1000 / 60)}m {Math.floor((run.durationMs / 1000) % 60)}s
                        </div>
                      ) : (
                        '--'
                      )}
                    </td>

                    {/* Triggered time */}
                    <td className="px-6 py-4 text-xs text-dark-300">
                      <div className="flex items-center gap-1.5">
                        {run.triggeredBy?.avatarUrl ? (
                          <img src={run.triggeredBy.avatarUrl} className="w-4 h-4 rounded-full" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-dark-300" />
                        )}
                        <span>
                          {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={run.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-dark-300 hover:text-white"
                          title="View on GitHub"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <Link
                          to={`/pipelines/${run.id}`}
                          className="btn-ghost py-1 px-2.5 text-xs rounded-md inline-flex items-center gap-1 group-hover:bg-brand-600 group-hover:text-white group-hover:border-transparent transition-all"
                        >
                          Details
                          <ChevronRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {meta && meta.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-between text-xs text-dark-300">
              <div>
                Showing <strong className="text-white">{(meta.page - 1) * meta.limit + 1}</strong> to{' '}
                <strong className="text-white">{Math.min(meta.page * meta.limit, meta.total)}</strong> of{' '}
                <strong className="text-white">{meta.total}</strong> results
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={!meta.hasPrevPage}
                  className="btn-ghost py-1 px-2.5 text-xs rounded-md"
                >
                  Previous
                </button>
                <span className="text-dark-300 px-2">
                  Page {meta.page} of {meta.totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                  disabled={!meta.hasNextPage}
                  className="btn-ghost py-1 px-2.5 text-xs rounded-md"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
