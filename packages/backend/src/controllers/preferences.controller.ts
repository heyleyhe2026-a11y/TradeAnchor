import { Request, Response } from 'express';
import { PreferencesService } from '../services/preferences.service';

export const preferencesController = {
  async get(req: Request, res: Response) {
    const prefs = await PreferencesService.get(req.user!.id);
    res.json({ success: true, data: prefs });
  },

  async update(req: Request, res: Response) {
    const prefs = await PreferencesService.update(req.user!.id, req.body);
    res.json({ success: true, data: prefs });
  },

  async reset(req: Request, res: Response) {
    const prefs = await PreferencesService.reset(req.user!.id);
    res.json({ success: true, data: prefs });
  },
};
