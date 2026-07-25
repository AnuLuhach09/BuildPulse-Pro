import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/api/analytics.api';
import { repositoriesApi, Repository } from '@/api/repositories.api';
import { BuildSuccessRate } from '@/components/charts/BuildSuccessRate';
import { BuildDurationTrend } from '@/components/charts/BuildDurationTrend';
import { DeploymentFrequency } from '@/components/charts/DeploymentFrequency';
import {
  BarChart3,
  Calendar,
  Filter,
  Activity,
  CheckCircle2,
  Clock,
  Rocket,
  Loader2,
  RefreshCw,
} from 'lucide-react';

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [selectedRepoId, setSelectedRepoId] = useState('');

  // Repositories dropdown query
  const { data: reposData } = useQuery({
    queryKey: ['repos-list-all'],
    queryFn: () => repositoriesApi.list({ limit: 100 }),
  });

  const repos = reposData?.data ?? [];

  // Analytics queries
  const { data: overview, isLoading: isOverviewLoading, refetch: refetchOverview } = useQuery({
    queryKey: ['analytics-overview', selectedRepoId, days],
    queryFn: () => analyticsApi.getOverview({ repositoryId: selectedRepoId || undefined, days }),
  });

  const { data: successRate, isLoading: isSuccessLoading, refetch: refetchSuccess } = useQuery({
    queryKey: ['analytics-success-rate', selectedRepoId, days],
    queryFn: () => analyticsApi.getSuccessRate({ repositoryId: selectedRepoId || undefined, days }),
  });

  const { data: durationTrend, isLoading: isDurationLoading, refetch: refetchDuration } = useQuery({
    queryKey: ['analytics-duration-trend', selectedRepoId, days],
    queryFn: () => analyticsApi.getDurationTrend({ repositoryId: selectedRepoId || undefined, days }),
  });

  const { data: deployFreq, isLoading: isDeployLoading, refetch: refetchDeploy } = useQuery({
    queryKey: ['analytics-deploy-frequency', selectedRepoId, days],
    queryFn: () => analyticsApi.getDeployFrequency({ repositoryId: selectedRepoId || undefined, days }),
  });

  const handleRefresh = () => {
    refetchOverview();
    refetchSuccess();
    refetchDuration();
    refetchDeploy();
  };

  const isAnyLoading = isOverviewLoading || isSuccessLoading || isDurationLoading || isDeployLoading;

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-sm text-dark-300 mt-1">Deep-dive build failure trends, duration limits and deployment stats</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isAnyLoading}
          className="btn-ghost"
        >
          <RefreshCw className={`w-4 h-4 ${isAnyLoading ? 'animate-spin' : ''}`} />
          Refresh Charts
        </button>
      </div>

      {/* Filters Bar */}
      <div className="glass-card p-4 flex flex-col sm:flex-row items-center gap-4 justify-between">
        {/* Repo Filter */}
        <div className="flex items-center gap-2 w-full sm:w-72">
          <Filter className="w-4 h-4 text-dark-300 flex-shrink-0" />
          <select
            value={selectedRepoId}
            onChange={(e) => setSelectedRepoId(e.target.value)}
            className="input-field py-2 text-xs bg-dark-700 border-white/5"
          >
            <option value="">All Repositories</option>
            {repos.map((r: Repository) => (
              <option key={r.id} value={r.id}>
                {r.fullName}
              </option>
            ))}
          </select>
        </div>

        {/* Time Filter */}
        <div className="flex items-center gap-2 w-full sm:w-64">
          <Calendar className="w-4 h-4 text-dark-300 flex-shrink-0" />
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="input-field py-2 text-xs bg-dark-700 border-white/5"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Overview Cards */}
      {overview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Card 1: Total Runs */}
          <div className="glass-card p-5">
            <p className="text-xs text-dark-300 font-medium">Total Runs</p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-bold text-white">{overview.totalRuns.value}</span>
              <span className={`text-xs font-semibold ${overview.totalRuns.change >= 0 ? 'text-success-500' : 'text-danger-500'}`}>
                {overview.totalRuns.change >= 0 ? '+' : ''}{overview.totalRuns.change}%
              </span>
            </div>
            <p className="text-[10px] text-dark-300 mt-2">Activity change vs previous period</p>
          </div>

          {/* Card 2: Success Rate */}
          <div className="glass-card p-5">
            <p className="text-xs text-dark-300 font-medium">Build Success Rate</p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-bold text-white">{overview.successRate.value}%</span>
              <span className={`text-xs font-semibold ${overview.successRate.change >= 0 ? 'text-success-500' : 'text-danger-500'}`}>
                {overview.successRate.change >= 0 ? '+' : ''}{overview.successRate.change}%
              </span>
            </div>
            <p className="text-[10px] text-dark-300 mt-2">Ratio change vs previous period</p>
          </div>

          {/* Card 3: Avg Duration */}
          <div className="glass-card p-5">
            <p className="text-xs text-dark-300 font-medium">Average Run Duration</p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-bold text-white">{formatDuration(overview.avgDuration.value)}</span>
              <span className={`text-xs font-semibold ${overview.avgDuration.change <= 0 ? 'text-success-500' : 'text-danger-500'}`}>
                {overview.avgDuration.change <= 0 ? '' : '+'}{overview.avgDuration.change}%
              </span>
            </div>
            <p className="text-[10px] text-dark-300 mt-2">P95 pipeline average speed change</p>
          </div>

          {/* Card 4: Total Failures */}
          <div className="glass-card p-5">
            <p className="text-xs text-dark-300 font-medium">Total Failures</p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-bold text-white">{overview.failures.value}</span>
              <span className={`text-xs font-semibold ${overview.failures.change <= 0 ? 'text-success-500' : 'text-danger-500'}`}>
                {overview.failures.change <= 0 ? '' : '+'}{overview.failures.change}%
              </span>
            </div>
            <p className="text-[10px] text-dark-300 mt-2">Total failure rate count change</p>
          </div>
        </div>
      )}

      {/* Grid: Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Success Rate Chart */}
        <div className="chart-container h-[280px] flex flex-col">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-brand-400" />
            Build Success Rate Trend (%)
          </h3>
          {isSuccessLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
            </div>
          ) : successRate ? (
            <div className="flex-1 min-h-0">
              <BuildSuccessRate data={successRate} />
            </div>
          ) : null}
        </div>

        {/* Build Duration Chart */}
        <div className="chart-container h-[280px] flex flex-col">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-400" />
            Average Build Duration (sec)
          </h3>
          {isDurationLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
            </div>
          ) : durationTrend ? (
            <div className="flex-1 min-h-0">
              <BuildDurationTrend data={durationTrend} />
            </div>
          ) : null}
        </div>

        {/* Deployment Frequency chart */}
        <div className="chart-container lg:col-span-2 h-[320px] flex flex-col">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Rocket className="w-4 h-4 text-brand-400" />
            Deployment Frequency (environments count)
          </h3>
          {isDeployLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
            </div>
          ) : deployFreq ? (
            <div className="flex-1 min-h-0">
              <DeploymentFrequency data={deployFreq} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
