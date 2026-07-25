import { Request, Response } from 'express';
import { adminService } from './admin.service';
import { asyncHandler } from '../../shared/middleware/validateRequest';

export const adminController = {
  listUsers: asyncHandler(async (req: Request, res: Response) => {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const result = await adminService.listUsers(page, limit);
    res.status(200).json(result);
  }),

  updateUserRole: asyncHandler(async (req: Request, res: Response) => {
    const user = await adminService.updateUserRole(req.params.id, req.body.role);
    res.status(200).json({
      success: true,
      message: 'User role updated successfully',
      data: user,
    });
  }),

  updateUserStatus: asyncHandler(async (req: Request, res: Response) => {
    const user = await adminService.updateUserStatus(req.params.id, req.body.isActive);
    res.status(200).json({
      success: true,
      message: 'User status updated successfully',
      data: user,
    });
  }),

  listAuditLogs: asyncHandler(async (req: Request, res: Response) => {
    const result = await adminService.listAuditLogs(req.query as any);
    res.status(200).json(result);
  }),

  exportAuditLogs: asyncHandler(async (req: Request, res: Response) => {
    const format = req.query.format as 'csv' | 'json';
    const data = await adminService.exportAuditLogs(req.query as any);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
      res.status(200).send(data);
      return;
    }

    res.status(200).json({ success: true, data });
  }),

  exportPipelineHistory: asyncHandler(async (req: Request, res: Response) => {
    const format = req.query.format as 'csv' | 'json';
    const data = await adminService.exportPipelineHistory(req.query as any);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=pipeline-history.csv');
      res.status(200).send(data);
      return;
    }

    res.status(200).json({ success: true, data });
  }),
};
