import { Router } from 'express';
import { analyticsController } from './analytics.controller';
import { authenticate } from '../auth/auth.middleware';
import { validate } from '../../shared/middleware/validateRequest';
import { AnalyticsQuerySchema } from './analytics.schemas';

const router = Router();

// Secure all analytics routes
router.use(authenticate);

// Validate filter query parameters for all requests
router.use(validate(AnalyticsQuerySchema, 'query'));

router.get('/overview', analyticsController.getOverview);
router.get('/success-rate', analyticsController.getSuccessRate);
router.get('/duration-trend', analyticsController.getDurationTrend);
router.get('/deploy-frequency', analyticsController.getDeployFrequency);
router.get('/leaderboard', analyticsController.getLeaderboard);

export default router;
