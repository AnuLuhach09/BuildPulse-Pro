import { Router } from 'express';
import { pipelinesController } from './pipelines.controller';
import { authenticate } from '../auth/auth.middleware';
import { validate } from '../../shared/middleware/validateRequest';
import { PipelineQuerySchema } from './pipelines.schemas';

const router = Router();

router.use(authenticate);

router.get('/', validate(PipelineQuerySchema, 'query'), pipelinesController.listRuns);
router.get('/queue', pipelinesController.getQueue);
router.get('/:id', pipelinesController.getRunById);
router.get('/:id/logs', pipelinesController.getLogs);
router.post('/:id/simulate-fix', pipelinesController.simulateFix);

export default router;
