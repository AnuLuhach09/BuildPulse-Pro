import { Router } from 'express';
import { keysController } from './keys.controller';
import { authenticate } from '../auth/auth.middleware';
import { validate } from '../../shared/middleware/validateRequest';
import { CreateApiKeySchema } from './keys.schemas';

const router = Router();

router.use(authenticate);

router.get('/', keysController.list);
router.post('/', validate(CreateApiKeySchema), keysController.create);
router.delete('/:id', keysController.revoke);

export default router;
