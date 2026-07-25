import { Request, Response } from 'express';
import { analyticsService } from './analytics.service';
import { asyncHandler } from '../../shared/middleware/validateRequest';

export const analyticsController = {
  getOverview: asyncHandler(async (req: Request, res: Response) => {
    const stats = await analyticsService.getOverview(req.user!.sub, req.query as any);
    res.status(200).json({ success: true, data: stats });
  }),

  getSuccessRate: asyncHandler(async (req: Request, res: Response) => {
    const data = await analyticsService.getSuccessRate(req.user!.sub, req.query as any);
    res.status(200).json({ success: true, data });
  }),

  getDurationTrend: asyncHandler(async (req: Request, res: Response) => {
    const data = await analyticsService.getDurationTrend(req.user!.sub, req.query as any);
    res.status(200).json({ success: true, data });
  }),

  getDeployFrequency: asyncHandler(async (req: Request, res: Response) => {
    const data = await analyticsService.getDeployFrequency(req.user!.sub, req.query as any);
    res.status(200).json({ success: true, data });
  }),

  getLeaderboard: asyncHandler(async (req: Request, res: Response) => {
    const data = await analyticsService.getLeaderboard(req.user!.sub, req.query as any);
    res.status(200).json({ success: true, data });
  }),
};
