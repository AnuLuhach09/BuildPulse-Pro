import { Request, Response } from 'express';
import { pipelinesService } from './pipelines.service';
import { asyncHandler } from '../../shared/middleware/validateRequest';

export const pipelinesController = {
  listRuns: asyncHandler(async (req: Request, res: Response) => {
    const result = await pipelinesService.listRuns(req.user!.sub, req.query as any);
    res.status(200).json(result);
  }),

  getRunById: asyncHandler(async (req: Request, res: Response) => {
    const run = await pipelinesService.getRunById(req.params.id, req.user!.sub);
    res.status(200).json({ success: true, data: run });
  }),

  getQueue: asyncHandler(async (req: Request, res: Response) => {
    const queue = await pipelinesService.getQueue(req.user!.sub);
    res.status(200).json({ success: true, data: queue });
  }),

  getLogs: asyncHandler(async (req: Request, res: Response) => {
    const logs = await pipelinesService.getLogs(req.params.id, req.user!.sub);
    res.status(200).json({ success: true, data: logs });
  }),

  simulateFix: asyncHandler(async (req: Request, res: Response) => {
    const run = await pipelinesService.simulateFix(req.params.id, req.user!.sub);
    res.status(200).json({ success: true, message: 'Simulated self-healing fix triggered', data: run });
  }),
};
