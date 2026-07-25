import { Request, Response } from 'express';
import { repositoriesService } from './repositories.service';
import { asyncHandler } from '../../shared/middleware/validateRequest';

export const repositoriesController = {
  connect: asyncHandler(async (req: Request, res: Response) => {
    const repo = await repositoriesService.connect(req.body, req.user!.sub);
    res.status(201).json({
      success: true,
      message: 'Repository connected successfully',
      data: repo,
    });
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await repositoriesService.list(req.user!.sub, req.query as any);
    res.status(200).json(result);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const repo = await repositoriesService.getById(req.params.id, req.user!.sub);
    res.status(200).json({ success: true, data: repo });
  }),

  disconnect: asyncHandler(async (req: Request, res: Response) => {
    const result = await repositoriesService.disconnect(req.params.id, req.user!.sub);
    res.status(200).json({ success: true, data: result });
  }),

  getHealth: asyncHandler(async (req: Request, res: Response) => {
    const score = await repositoriesService.computeHealthScore(req.params.id);
    res.status(200).json({ success: true, data: { healthScore: score } });
  }),

  getWebhookInstructions: asyncHandler(async (req: Request, res: Response) => {
    const instructions = await repositoriesService.getWebhookInstructions(
      req.params.id,
      req.user!.sub
    );
    res.status(200).json({ success: true, data: instructions });
  }),
};
