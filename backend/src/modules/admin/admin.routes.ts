import { Router } from 'express';
import { adminController } from './admin.controller';
import { authenticate, authorize } from '../auth/auth.middleware';
import { validate } from '../../shared/middleware/validateRequest';
import {
  UpdateUserRoleSchema,
  UpdateUserStatusSchema,
  AuditLogQuerySchema,
  ExportQuerySchema,
} from './admin.schemas';

const router = Router();

// Protect all routes — only ADMIN role allowed
router.use(authenticate);
router.use(authorize('ADMIN'));

// User management routes
router.get('/users', adminController.listUsers);
router.put('/users/:id/role', validate(UpdateUserRoleSchema), adminController.updateUserRole);
router.put('/users/:id/status', validate(UpdateUserStatusSchema), adminController.updateUserStatus);

// Audit logs
router.get('/audit-logs', validate(AuditLogQuerySchema, 'query'), adminController.listAuditLogs);

// Export history
router.get('/export/audit-logs', validate(ExportQuerySchema, 'query'), adminController.exportAuditLogs);
router.get('/export/pipelines', validate(ExportQuerySchema, 'query'), adminController.exportPipelineHistory);

export default router;
