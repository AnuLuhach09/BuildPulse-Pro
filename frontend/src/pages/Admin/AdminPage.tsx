import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, AdminUser, AdminAuditLog } from '@/api/admin.api';
import {
  Users,
  Shield,
  Activity,
  UserCheck,
  UserX,
  FileSpreadsheet,
  Download,
  Calendar,
  Layers,
  Search,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'users' | 'audit'>('users');

  // Pagination states
  const [userPage, setUserPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);

  // Expanded log meta states
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Queries
  const { data: usersData, isLoading: isUsersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ['admin-users', userPage],
    queryFn: () => adminApi.listUsers({ page: userPage, limit: 15 }),
    enabled: activeTab === 'users',
  });

  const { data: auditData, isLoading: isAuditLoading, refetch: refetchAudit } = useQuery({
    queryKey: ['admin-audit-logs', auditPage],
    queryFn: () => adminApi.listAuditLogs({ page: auditPage, limit: 15 }),
    enabled: activeTab === 'audit',
  });

  // Mutations
  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'ADMIN' | 'DEVELOPER' }) =>
      adminApi.updateUserRole(id, role),
    onSuccess: (updated) => {
      toast.success(`Role updated for ${updated.email}`);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message ?? 'Failed to update role');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminApi.updateUserStatus(id, isActive),
    onSuccess: (updated) => {
      toast.success(`Status updated for ${updated.email}`);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message ?? 'Failed to toggle status');
    },
  });

  const handleRoleChange = (id: string, role: 'ADMIN' | 'DEVELOPER') => {
    updateRoleMutation.mutate({ id, role });
  };

  const handleStatusToggle = (id: string, currentStatus: boolean) => {
    updateStatusMutation.mutate({ id, isActive: !currentStatus });
  };

  const triggerExport = (endpoint: 'audit-logs' | 'pipelines', format: 'csv' | 'json') => {
    adminApi.triggerExport(endpoint, format);
    toast.success(`Downloading ${endpoint} in ${format.toUpperCase()} format...`);
  };

  const users = usersData?.data ?? [];
  const userMeta = usersData?.meta;

  const logs = auditData?.data ?? [];
  const auditMeta = auditData?.meta;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Administration</h1>
          <p className="text-sm text-dark-300 mt-1">Operational user management, system audit trails, and data exports</p>
        </div>

        {/* Operational Exports Card */}
        <div className="flex items-center gap-2 bg-dark-800/40 p-2 border border-white/[0.06] rounded-lg">
          <span className="text-xs text-dark-300 font-semibold px-2 flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5 text-success-500" />
            Exports:
          </span>
          <button
            onClick={() => triggerExport('pipelines', 'csv')}
            className="btn-ghost py-1 px-2.5 text-[10px] rounded-md inline-flex items-center gap-1 hover:bg-success-500/10 hover:text-success-500"
          >
            <Download className="w-3 h-3" />
            Pipelines CSV
          </button>
          <button
            onClick={() => triggerExport('audit-logs', 'csv')}
            className="btn-ghost py-1 px-2.5 text-[10px] rounded-md inline-flex items-center gap-1 hover:bg-success-500/10 hover:text-success-500"
          >
            <Download className="w-3 h-3" />
            Audit Logs CSV
          </button>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-white/[0.06] gap-6 text-sm">
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 font-semibold transition-all ${
            activeTab === 'users'
              ? 'text-brand-400 border-b-2 border-brand-400'
              : 'text-dark-300 hover:text-white'
          }`}
        >
          User Accounts
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 font-semibold transition-all ${
            activeTab === 'audit'
              ? 'text-brand-400 border-b-2 border-brand-400'
              : 'text-dark-300 hover:text-white'
          }`}
        >
          System Audit Trail
        </button>
      </div>

      {/* Tab 1: User Accounts */}
      {activeTab === 'users' && (
        isUsersLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
          </div>
        ) : (
          <div className="glass-card overflow-hidden animate-fade-in">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.06] text-xs font-semibold uppercase tracking-wider text-dark-300">
                    <th className="px-6 py-4">Name / Email</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">GitHub Account</th>
                    <th className="px-6 py-4 text-center">Connected Repos</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] text-xs">
                  {users.map((u: AdminUser) => (
                    <tr key={u.id} className="hover:bg-white/[0.01]">
                      {/* Name / Email */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {u.avatarUrl ? (
                            <img src={u.avatarUrl} className="w-7 h-7 rounded-full" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-dark-600 flex items-center justify-center font-bold text-white text-[10px]">
                              {u.name[0].toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-white">{u.name}</p>
                            <p className="text-dark-300 mt-0.5">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Role Dropdown */}
                      <td className="px-6 py-4">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as any)}
                          className="input-field w-32 py-1 text-xs bg-dark-700 border-white/5 font-medium text-white"
                        >
                          <option value="DEVELOPER">Developer</option>
                          <option value="ADMIN">Administrator</option>
                        </select>
                      </td>

                      {/* GitHub connection info */}
                      <td className="px-6 py-4 text-dark-300">
                        {u.githubLogin ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-white bg-dark-600 px-1.5 py-0.5 rounded">
                            {u.githubLogin}
                          </span>
                        ) : (
                          'Not Linked'
                        )}
                      </td>

                      {/* Connected Repos Count */}
                      <td className="px-6 py-4 text-center font-semibold text-white">
                        {u._count?.members ?? 0}
                      </td>

                      {/* Status Active Badge */}
                      <td className="px-6 py-4 text-center">
                        <span className={`status-badge text-[10px] py-0.5 px-2 ${u.isActive ? 'status-success' : 'status-cancelled'}`}>
                          {u.isActive ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                          {u.isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </td>

                      {/* Deactivate/Activate Toggle */}
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleStatusToggle(u.id, u.isActive)}
                          disabled={updateStatusMutation.isPending}
                          className={`btn-ghost py-1 px-2 text-[10px] rounded-md transition-all ${
                            u.isActive
                              ? 'text-danger-500 hover:bg-danger-500/10 hover:text-red-400'
                              : 'text-success-500 hover:bg-success-500/10 hover:text-green-400'
                          }`}
                        >
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* User Pagination */}
            {userMeta && userMeta.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-between text-xs text-dark-300">
                <div>Page {userMeta.page} of {userMeta.totalPages}</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                    disabled={!userMeta.hasPrevPage}
                    className="btn-ghost"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setUserPage((p) => Math.min(userMeta.totalPages, p + 1))}
                    disabled={!userMeta.hasNextPage}
                    className="btn-ghost"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* Tab 2: System Audit Trail */}
      {activeTab === 'audit' && (
        isAuditLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
          </div>
        ) : (
          <div className="glass-card overflow-hidden animate-fade-in">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.06] text-xs font-semibold uppercase tracking-wider text-dark-300">
                    <th className="px-6 py-4 w-12" />
                    <th className="px-6 py-4">Action</th>
                    <th className="px-6 py-4">Entity</th>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">IP Address</th>
                    <th className="px-6 py-4 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] text-xs">
                  {logs.map((log: AdminAuditLog) => {
                    const isExpanded = expandedLogId === log.id;
                    return (
                      <>
                        <tr key={log.id} className="hover:bg-white/[0.01]">
                          {/* Toggle metadata button */}
                          <td className="px-6 py-4">
                            <button
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="text-dark-300 hover:text-white"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </td>

                          {/* Action */}
                          <td className="px-6 py-4">
                            <span className="font-mono text-white font-bold">{log.action}</span>
                          </td>

                          {/* Entity */}
                          <td className="px-6 py-4">
                            <span className="text-dark-300 font-medium">{log.entity}</span>
                            {log.repository && (
                              <span className="text-[10px] text-dark-400 block mt-0.5">{log.repository.fullName}</span>
                            )}
                          </td>

                          {/* User Email */}
                          <td className="px-6 py-4 text-dark-300">
                            {log.user?.email ?? 'System Process'}
                          </td>

                          {/* IP Address */}
                          <td className="px-6 py-4 text-dark-300 font-mono text-[10px]">
                            {log.ipAddress || '--'}
                          </td>

                          {/* Timestamp */}
                          <td className="px-6 py-4 text-right text-dark-300 whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                        </tr>

                        {/* Metadata JSON Expand */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={6} className="bg-dark-900/40 p-4 border-b border-white/[0.06]">
                              <div className="space-y-1.5">
                                <span className="text-[9px] uppercase tracking-wider font-semibold text-brand-400">Payload Metadata</span>
                                <pre className="text-[10px] text-dark-300 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed max-w-3xl">
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Audit Pagination */}
            {auditMeta && auditMeta.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-between text-xs text-dark-300">
                <div>Page {auditMeta.page} of {auditMeta.totalPages}</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                    disabled={!auditMeta.hasPrevPage}
                    className="btn-ghost"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setAuditPage((p) => Math.min(auditMeta.totalPages, p + 1))}
                    disabled={!auditMeta.hasNextPage}
                    className="btn-ghost"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
