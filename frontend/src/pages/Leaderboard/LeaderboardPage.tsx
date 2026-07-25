import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi, LeaderboardUser } from '@/api/analytics.api';
import { repositoriesApi, Repository } from '@/api/repositories.api';
import {
  Trophy,
  Calendar,
  Filter,
  User,
  CheckCircle2,
  XCircle,
  Activity,
  Loader2,
  RefreshCw,
  Award,
} from 'lucide-react';

export default function LeaderboardPage() {
  const [days, setDays] = useState(30);
  const [selectedRepoId, setSelectedRepoId] = useState('');

  // Repos dropdown query
  const { data: reposData } = useQuery({
    queryKey: ['repos-list-leaderboard'],
    queryFn: () => repositoriesApi.list({ limit: 100 }),
  });

  const repos = reposData?.data ?? [];

  // Leaderboard data query
  const { data: leaderboard, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['leaderboard', selectedRepoId, days],
    queryFn: () => analyticsApi.getLeaderboard({ repositoryId: selectedRepoId || undefined, days }),
  });

  const getRankBadge = (rank: number) => {
    if (rank === 0) return <Award className="w-5 h-5 text-yellow-500 fill-yellow-500/20" />;
    if (rank === 1) return <Award className="w-5 h-5 text-slate-300 fill-slate-300/20" />;
    if (rank === 2) return <Award className="w-5 h-5 text-amber-600 fill-amber-600/20" />;
    return <span className="text-xs font-mono text-dark-300 pl-1.5">{rank + 1}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Developer Leaderboard</h1>
          <p className="text-sm text-dark-300 mt-1">Ranking team members by total pipeline runs and build success rates</p>
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
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Leaderboard Table */}
      {isLoading ? (
        <div className="glass-card p-6 flex justify-center py-20 flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          <span className="text-xs text-dark-300">Calculating rank list...</span>
        </div>
      ) : !leaderboard || leaderboard.length === 0 ? (
        <div className="glass-card p-12 text-center max-w-xl mx-auto space-y-4">
          <Trophy className="w-12 h-12 text-dark-400 mx-auto" />
          <h3 className="text-lg font-semibold text-white">No Activity Found</h3>
          <p className="text-sm text-dark-300">
            No pipeline activity recorded for the current time frame. Set up webhooks to track developer commits.
          </p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.06] text-xs font-semibold uppercase tracking-wider text-dark-300">
                  <th className="px-6 py-4 w-16">Rank</th>
                  <th className="px-6 py-4">Developer</th>
                  <th className="px-6 py-4 text-center">Total Runs</th>
                  <th className="px-6 py-4 text-center">Success Builds</th>
                  <th className="px-6 py-4 text-center">Failures</th>
                  <th className="px-6 py-4 text-right">Success Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {leaderboard.map((dev: LeaderboardUser, idx: number) => {
                  const successRate = dev.totalRuns > 0 ? (dev.successRuns / dev.totalRuns) * 100 : 0;
                  return (
                    <tr key={dev.id} className="hover:bg-white/[0.01] transition-colors">
                      {/* Rank Medal */}
                      <td className="px-6 py-4 font-bold">{getRankBadge(idx)}</td>

                      {/* User Info */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {dev.avatarUrl ? (
                            <img src={dev.avatarUrl} className="w-8 h-8 rounded-full border border-white/5" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-dark-600 flex items-center justify-center text-xs font-semibold text-white border border-white/5">
                              {dev.name[0].toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-semibold text-white">{dev.name}</p>
                            <p className="text-xs text-dark-300 mt-0.5">{dev.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Total Runs */}
                      <td className="px-6 py-4 text-center text-sm font-semibold text-white">
                        <span className="inline-flex items-center gap-1.5 justify-center">
                          <Activity className="w-3.5 h-3.5 text-brand-400" />
                          {dev.totalRuns}
                        </span>
                      </td>

                      {/* Success Runs */}
                      <td className="px-6 py-4 text-center text-sm">
                        <span className="inline-flex items-center gap-1 text-success-500">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {dev.successRuns}
                        </span>
                      </td>

                      {/* Failures */}
                      <td className="px-6 py-4 text-center text-sm">
                        <span className="inline-flex items-center gap-1 text-danger-500">
                          <XCircle className="w-3.5 h-3.5" />
                          {dev.failedRuns}
                        </span>
                      </td>

                      {/* Success Rate Progress Bar */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-3">
                          <div className="w-24 bg-dark-600 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                successRate >= 80 ? 'bg-success-500 shadow-glow-success' :
                                successRate >= 50 ? 'bg-warning-500' :
                                'bg-danger-500 shadow-glow-danger'
                              }`}
                              style={{ width: `${successRate}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-white font-mono min-w-[40px] text-right">
                            {successRate.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
