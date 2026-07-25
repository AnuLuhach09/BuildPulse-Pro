import { Router } from 'express';
import { repositoriesController } from './repositories.controller';
import { authenticate } from '../auth/auth.middleware';
import { validate } from '../../shared/middleware/validateRequest';
import { ConnectRepoSchema, RepoQuerySchema } from './repositories.schemas';

const router = Router();

// All repo routes require authentication
router.use(authenticate);

router.get('/', validate(RepoQuerySchema, 'query'), repositoriesController.list);
router.post('/', validate(ConnectRepoSchema), repositoriesController.connect);
router.get('/:id', repositoriesController.getById);
router.delete('/:id', repositoriesController.disconnect);
router.get('/:id/health', repositoriesController.getHealth);
router.get('/:id/webhook-instructions', repositoriesController.getWebhookInstructions);

export default router;
