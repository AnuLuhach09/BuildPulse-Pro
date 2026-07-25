import { Request, Response } from 'express';
import { keysService } from './keys.service';
import { asyncHandler } from '../../shared/middleware/validateRequest';

export const keysController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const key = await keysService.create(req.user!.sub, req.body);
    res.status(201).json({
      success: true,
      message: 'API Key generated successfully. Please copy it now as it will not be shown again.',
      data: key,
    });
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const keys = await keysService.list(req.user!.sub);
    res.status(200).json({ success: true, data: keys });
  }),

  revoke: asyncHandler(async (req: Request, res: Response) => {
    const result = await keysService.revoke(req.params.id, req.user!.sub);
    res.status(200).json({ success: true, data: result });
  }),
};
