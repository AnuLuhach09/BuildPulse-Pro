import { Request, Response } from 'express';
import { usersService } from './users.service';
import { asyncHandler } from '../../shared/middleware/validateRequest';

export const usersController = {
  getNotificationPrefs: asyncHandler(async (req: Request, res: Response) => {
    const prefs = await usersService.getNotificationPrefs(req.user!.sub);
    res.status(200).json({ success: true, data: prefs });
  }),

  updateNotificationPrefs: asyncHandler(async (req: Request, res: Response) => {
    const prefs = await usersService.updateNotificationPrefs(req.user!.sub, req.body);
    res.status(200).json({
      success: true,
      message: 'Notification preferences updated successfully',
      data: prefs,
    });
  }),
};
