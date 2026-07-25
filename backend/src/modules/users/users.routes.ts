import { Router } from 'express';
import { usersController } from './users.controller';
import { authenticate } from '../auth/auth.middleware';
import { validate } from '../../shared/middleware/validateRequest';
import { UpdateNotificationPrefsSchema } from './users.schemas';

const router = Router();

router.use(authenticate);

router.get('/notifications', usersController.getNotificationPrefs);
router.put('/notifications', validate(UpdateNotificationPrefsSchema), usersController.updateNotificationPrefs);

export default router;
