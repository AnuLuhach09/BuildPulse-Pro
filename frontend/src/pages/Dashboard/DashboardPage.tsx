import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { analyticsApi } from '@/api/analytics.api';
import { pipelinesApi, PipelineRun } from '@/api/pipelines.api';
import { healthApi } from '@/api/health.api';
import { useSocket } from '@/hooks/useSocket';
import { BuildSuccessRate } from '@/components/charts/BuildSuccessRate';
import { BuildDurationTrend } from '@/components/charts/BuildDurationTrend';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import {
  Activity,
  CheckCircle2,
  Clock,
  XCircle,
  TrendingUp,
  TrendingDown,
  GitBranch,
  ArrowRight,
  User,
  Play,
  ExternalLink,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const socket = useSocket();

  const [days, setDays] = useState(30);

  // System health status query (polls every 10s)
  const { data: health } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => healthApi.getSystemHealth(),
    refetchInterval: 10000,
  });

  // Overview stats query
  const { data: overview, isLoading: isOverviewLoading } = useQuery({
    queryKey: ['analytics-overview', days],
    queryFn: () => analyticsApi.getOverview({ days }),
  });

  // Success rate time series query
  const { data: successRateData, isLoading: isSuccessRateLoading } = useQuery({
    queryKey: ['analytics-success-rate', days],
    queryFn: () => analyticsApi.getSuccessRate({ days }),
  });

  // Duration trend query
  const { data: durationTrendData, isLoading: isDurationLoading } = useQuery({
    queryKey: ['analytics-duration-trend', days],
    queryFn: () => analyticsApi.getDurationTrend({ days }),
  });

  // Recent pipeline runs query
  const { data: recentRunsData, isLoading: isRecentLoading } = useQuery({
    queryKey: ['recent-runs'],
    queryFn: () => pipelinesApi.listRuns({ page: 1, limit: 5 }),
  });

  // Real-time updates handler
  useEffect(() => {
    if (socket.isConnected) {
      socket.on('pipeline:update', (updatedRun: any) => {
        // Invalidate recent runs list to fetch latest updates
        queryClient.invalidateQueries({ queryKey: ['recent-runs'] });
        // Invalidate overview stats to recompute KPI values
        queryClient.invalidateQueries({ queryKey: ['analytics-overview'] });
        
        // If status completed, also update time series charts
        if (updatedRun.status === 'COMPLETED') {
          queryClient.invalidateQueries({ queryKey: ['analytics-success-rate'] });
          queryClient.invalidateQueries({ queryKey: ['analytics-duration-trend'] });
        }
      });
    }

    return () => {
      socket.off('pipeline:update');
    };
  }, [socket.isConnected, queryClient]);

  const recentRuns = recentRunsData?.data ?? [];

  const getStatusIcon = (run: PipelineRun) => {
    if (run.status === 'QUEUED') return <Clock className="w-3.5 h-3.5 text-warning-500 animate-pulse" />;
    if (run.status === 'IN_PROGRESS') return <Play className="w-3.5 h-3.5 text-brand-400 animate-spin" />;
    if (run.conclusion === 'SUCCESS') return <CheckCircle2 className="w-3.5 h-3.5 text-success-500" />;
    if (run.conclusion === 'FAILURE') return <XCircle className="w-3.5 h-3.5 text-danger-500" />;
    return <Clock className="w-3.5 h-3.5 text-dark-300" />;
  };

  const getStatusClass = (run: PipelineRun) => {
    if (run.status === 'QUEUED') return 'status-queued';
    if (run.status === 'IN_PROGRESS') return 'status-running';
    if (run.conclusion === 'SUCCESS') return 'status-success';
    if (run.conclusion === 'FAILURE') return 'status-failure';
    return 'status-cancelled';
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-dark-300 mt-1">Real-time CI/CD status and performance analytics overview</p>
        </div>

        {/* Date Range Selector */}
        <div className="flex items-center gap-1 bg-dark-800/80 p-1 border border-white/[0.06] rounded-lg self-start md:self-auto">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={clsx(
                'px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150',
                days === d
                  ? 'bg-brand-600 text-white shadow-glow'
                  : 'text-dark-300 hover:text-white hover:bg-white/5'
              )}
            >
              {d}D
            </button>
          ))}
        </div>
      </div>

      {/* System Health CommandCenter Indicators */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-dark-800/40 p-4 border border-white/[0.04] rounded-xl">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-dark-700/30 border border-white/[0.04]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success-500"></span>
          </span>
          <div className="min-w-0">
            <p className="text-[10px] text-dark-300 font-semibold uppercase tracking-wider leading-none">API Gateway</p>
            <p className="text-[11px] text-white font-medium mt-1">Operational</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-dark-700/30 border border-white/[0.04]">
          <span className="relative flex h-2 w-2">
            <span className={clsx(
              "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
              health?.services?.database === 'connected' ? 'bg-success-500' : 'bg-danger-500'
            )}></span>
            <span className={clsx(
              "relative inline-flex rounded-full h-2 w-2",
              health?.services?.database === 'connected' ? 'bg-success-500' : 'bg-danger-500'
            )}></span>
          </span>
          <div className="min-w-0">
            <p className="text-[10px] text-dark-300 font-semibold uppercase tracking-wider leading-none">Database</p>
            <p className="text-[11px] text-white font-medium mt-1">
              {health?.services?.database === 'connected' ? 'Connected' : 'Offline'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-dark-700/30 border border-white/[0.04]">
          <span className="relative flex h-2 w-2">
            <span className={clsx(
              "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
              health?.services?.redis === 'connected' ? 'bg-success-500' : 'bg-danger-500'
            )}></span>
            <span className={clsx(
              "relative inline-flex rounded-full h-2 w-2",
              health?.services?.redis === 'connected' ? 'bg-success-500' : 'bg-danger-500'
            )}></span>
          </span>
          <div className="min-w-0">
            <p className="text-[10px] text-dark-300 font-semibold uppercase tracking-wider leading-none">BullMQ / Redis</p>
            <p className="text-[11px] text-white font-medium mt-1">
              {health?.services?.redis === 'connected' ? 'Ready' : 'Offline'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-dark-700/30 border border-white/[0.04]">
          <span className="relative flex h-2 w-2">
            <span className={clsx(
              "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
              health?.services?.ai === 'configured' ? 'bg-success-500' : 'bg-warning-500'
            )}></span>
            <span className={clsx(
              "relative inline-flex rounded-full h-2 w-2",
              health?.services?.ai === 'configured' ? 'bg-success-500' : 'bg-warning-500'
            )}></span>
          </span>
          <div className="min-w-0">
            <p className="text-[10px] text-dark-300 font-semibold uppercase tracking-wider leading-none">AI Diagnostics</p>
            <p className="text-[11px] text-white font-medium mt-1">
              {health?.services?.ai === 'configured' ? 'Active' : 'Missing Key'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-dark-700/30 border border-white/[0.04]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success-500"></span>
          </span>
          <div className="min-w-0">
            <p className="text-[10px] text-dark-300 font-semibold uppercase tracking-wider leading-none">GitHub webhook</p>
            <p className="text-[11px] text-white font-medium mt-1">Listening</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {isOverviewLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="glass-card p-5 h-28 flex flex-col justify-between">
              <div className="h-3 w-24 skeleton" />
              <div className="h-6 w-16 skeleton" />
              <div className="h-3 w-32 skeleton" />
            </div>
          ))}
        </div>
      ) : overview ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Card 1: Total Runs */}
          <div className="glass-card p-5">
            <div className="flex items-start justify-between">
              <p className="text-xs text-dark-300 font-medium">Total Runs ({days}d)</p>
              <Activity className="w-4 h-4 text-brand-400" />
            </div>
            <p className="text-2xl font-bold text-white mt-2">{overview.totalRuns.value}</p>
            <div className="flex items-center gap-1.5 mt-2 text-xs">
              {overview.totalRuns.change >= 0 ? (
                <span className="text-success-500 flex items-center gap-0.5 font-medium">
                  <TrendingUp className="w-3.5 h-3.5" />
                  +{overview.totalRuns.change}%
                </span>
              ) : (
                <span className="text-danger-500 flex items-center gap-0.5 font-medium">
                  <TrendingDown className="w-3.5 h-3.5" />
                  {overview.totalRuns.change}%
                </span>
              )}
              <span className="text-dark-300">from prev period</span>
            </div>
          </div>

          {/* Card 2: Success Rate */}
          <div className="glass-card p-5">
            <div className="flex items-start justify-between">
              <p className="text-xs text-dark-300 font-medium">Success Rate ({days}d)</p>
              <CheckCircle2 className="w-4 h-4 text-success-500" />
            </div>
            <p className="text-2xl font-bold text-white mt-2">{overview.successRate.value}%</p>
            <div className="flex items-center gap-1.5 mt-2 text-xs">
              {overview.successRate.change >= 0 ? (
                <span className="text-success-500 flex items-center gap-0.5 font-medium">
                  <TrendingUp className="w-3.5 h-3.5" />
                  +{overview.successRate.change}%
                </span>
              ) : (
                <span className="text-danger-500 flex items-center gap-0.5 font-medium">
                  <TrendingDown className="w-3.5 h-3.5" />
                  {overview.successRate.change}%
                </span>
              )}
              <span className="text-dark-300">from prev period</span>
            </div>
          </div>

          {/* Card 3: Avg Duration */}
          <div className="glass-card p-5">
            <div className="flex items-start justify-between">
              <p className="text-xs text-dark-300 font-medium">Avg Duration ({days}d)</p>
              <Clock className="w-4 h-4 text-warning-500" />
            </div>
            <p className="text-2xl font-bold text-white mt-2">{formatDuration(overview.avgDuration.value)}</p>
            <div className="flex items-center gap-1.5 mt-2 text-xs">
              {overview.avgDuration.change <= 0 ? (
                <span className="text-success-500 flex items-center gap-0.5 font-medium">
                  <TrendingDown className="w-3.5 h-3.5" />
                  {overview.avgDuration.change}%
                </span>
              ) : (
                <span className="text-danger-500 flex items-center gap-0.5 font-medium">
                  <TrendingUp className="w-3.5 h-3.5" />
                  +{overview.avgDuration.change}%
                </span>
              )}
              <span className="text-dark-300">duration improvement</span>
            </div>
          </div>

          {/* Card 4: Failures */}
          <div className="glass-card p-5">
            <div className="flex items-start justify-between">
              <p className="text-xs text-dark-300 font-medium">Failures ({days}d)</p>
              <XCircle className="w-4 h-4 text-danger-500" />
            </div>
            <p className="text-2xl font-bold text-white mt-2">{overview.failures.value}</p>
            <div className="flex items-center gap-1.5 mt-2 text-xs">
              {overview.failures.change <= 0 ? (
                <span className="text-success-500 flex items-center gap-0.5 font-medium">
                  <TrendingDown className="w-3.5 h-3.5" />
                  {overview.failures.change}%
                </span>
              ) : (
                <span className="text-danger-500 flex items-center gap-0.5 font-medium">
                  <TrendingUp className="w-3.5 h-3.5" />
                  +{overview.failures.change}%
                </span>
              )}
              <span className="text-dark-300">failure rate change</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Grid: Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Success Rate Chart */}
        <div className="chart-container h-[280px] flex flex-col">
          <h3 className="text-sm font-bold text-white mb-4">Pipeline Success Rate Trend</h3>
          {isSuccessRateLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
            </div>
          ) : successRateData ? (
            <div className="flex-1 min-h-0">
              <BuildSuccessRate data={successRateData} />
            </div>
          ) : null}
        </div>

        {/* Build Duration Chart */}
        <div className="chart-container h-[280px] flex flex-col">
          <h3 className="text-sm font-bold text-white mb-4">Average Build Duration (sec)</h3>
          {isDurationLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
            </div>
          ) : durationTrendData ? (
            <div className="flex-1 min-h-0">
              <BuildDurationTrend data={durationTrendData} />
            </div>
          ) : null}
        </div>
      </div>

      {/* Grid: Recent Runs Table */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-brand-400" />
            Recent Pipeline Runs
          </h3>
          <Link to="/pipelines" className="text-xs font-semibold text-brand-400 hover:text-brand-300 inline-flex items-center gap-1">
            View All Runs
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {isRecentLoading ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex items-center justify-between py-2 border-b border-white/5">
                <div className="h-4 w-48 skeleton" />
                <div className="h-5 w-16 skeleton" />
              </div>
            ))}
          </div>
        ) : recentRuns.length === 0 ? (
          <p className="text-xs text-dark-300 py-6 text-center">No recent pipeline runs recorded.</p>
        ) : (
          <div className="divide-y divide-white/[0.04] overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <tbody>
                {recentRuns.map((run: PipelineRun) => (
                  <tr key={run.id} className="hover:bg-white/[0.01] transition-colors group">
                    {/* Pipeline Info */}
                    <td className="py-3.5 pr-4">
                      <div className="min-w-0">
                        <Link to={`/pipelines/${run.id}`} className="text-xs font-semibold text-white hover:text-brand-400 truncate block">
                          {run.pipeline.name}
                        </Link>
                        <span className="text-[10px] text-dark-300 block truncate mt-0.5">
                          {run.pipeline.repository.fullName}
                        </span>
                      </div>
                    </td>

                    {/* Commit Info */}
                    <td className="py-3.5 px-4 text-xs">
                      <span className="text-dark-300 font-medium line-clamp-1 max-w-[200px]" title={run.commitMessage}>
                        {run.commitMessage || 'No commit message'}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[9px] text-dark-400">
                        <span className="bg-dark-600 px-1 rounded font-mono">{run.branch}</span>
                        <span className="font-mono">{run.commitSha.slice(0, 7)}</span>
                      </div>
                    </td>

                    {/* Badge */}
                    <td className="py-3.5 px-4">
                      <span className={`status-badge text-[10px] py-0.5 px-2 ${getStatusClass(run)}`}>
                        {getStatusIcon(run)}
                        {run.conclusion || run.status}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-4 text-[11px] text-dark-300 whitespace-nowrap">
                      {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
                    </td>

                    {/* Details Link */}
                    <td className="py-3.5 pl-4 text-right">
                      <Link to={`/pipelines/${run.id}`} className="btn-ghost py-1 px-2.5 text-[10px] rounded-md inline-flex items-center gap-0.5">
                        Details
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
