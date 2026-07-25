import prisma from '../../config/database';
import { NotFoundError } from '../../shared/errors/AppError';
import {
  parsePagination,
  getPrismaSkipTake,
  paginate,
} from '../../shared/utils/paginate';
import type { AuditLogQueryDTO, ExportQueryDTO } from './admin.schemas';

export class AdminService {
  /**
   * List all users (admin-only).
   */
  async listUsers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { repositories: true },
          },
        },
      }),
      prisma.user.count(),
    ]);

    // Sanitize password hashes
    const sanitized = users.map(({ passwordHash: _, ...user }) => user);
    return paginate(sanitized, total, { page, limit });
  }

  /**
   * Update user role.
   */
  async updateUserRole(id: string, role: 'ADMIN' | 'DEVELOPER') {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw NotFoundError('User');

    return prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    });
  }

  /**
   * Toggle user active status.
   */
  async updateUserStatus(id: string, isActive: boolean) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw NotFoundError('User');

    return prisma.user.update({
      where: { id },
      data: { isActive },
      select: { id: true, name: true, email: true, isActive: true },
    });
  }

  /**
   * List audit logs with pagination and filtering.
   */
  async listAuditLogs(query: AuditLogQueryDTO) {
    const pagination = parsePagination(query);

    const where: any = {
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.entity ? { entity: query.entity } : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        ...getPrismaSkipTake(pagination),
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          repository: {
            select: { id: true, name: true, fullName: true },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return paginate(logs, total, pagination);
  }

  /**
   * Export audit logs as CSV or JSON.
   */
  async exportAuditLogs(query: ExportQueryDTO) {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { email: true } },
      },
    });

    if (query.format === 'csv') {
      const headers = ['id', 'user', 'action', 'entity', 'metadata', 'ipAddress', 'createdAt'];
      const rows = logs.map((l) => [
        l.id,
        l.user?.email ?? 'System',
        l.action,
        l.entity,
        JSON.stringify(l.metadata).replace(/"/g, '""'), // escape quotes for CSV
        l.ipAddress ?? '',
        l.createdAt.toISOString(),
      ]);

      return this.convertToCSV(headers, rows);
    }

    return logs;
  }

  /**
   * Export pipeline runs history.
   */
  async exportPipelineHistory(query: ExportQueryDTO) {
    const where = query.repositoryId ? { pipeline: { repositoryId: query.repositoryId } } : {};

    const runs = await prisma.pipelineRun.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        pipeline: {
          select: { name: true, repository: { select: { fullName: true } } },
        },
      },
    });

    if (query.format === 'csv') {
      const headers = ['id', 'githubRunId', 'pipeline', 'repository', 'branch', 'status', 'conclusion', 'durationSec', 'createdAt'];
      const rows = runs.map((r) => [
        r.id,
        r.githubRunId.toString(),
        r.pipeline.name,
        r.pipeline.repository.fullName,
        r.branch,
        r.status,
        r.conclusion ?? 'PENDING',
        r.durationMs ? Math.round(r.durationMs / 1000) : 0,
        r.createdAt.toISOString(),
      ]);

      return this.convertToCSV(headers, rows);
    }

    // Convert BigInt for JSON safety
    return runs.map((r) => ({
      ...r,
      githubRunId: r.githubRunId.toString(),
    }));
  }

  // Convert array rows to CSV formatted string
  private convertToCSV(headers: string[], rows: any[][]): string {
    const csvRows = [];
    csvRows.push(headers.join(','));

    for (const row of rows) {
      const escaped = row.map((val) => {
        const str = String(val);
        // If string contains comma, quotes, or newlines, wrap in double quotes
        if (/[",\n]/.test(str)) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      csvRows.push(escaped.join(','));
    }

    return csvRows.join('\n');
  }
}

export const adminService = new AdminService();
