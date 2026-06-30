import { Request, Response } from 'express';
import { PlaybookService } from '../services/playbook.service';
import { ratingService } from '../services/rating.service';
import { CommentService } from '../services/comment.service';
import { CreditService } from '../services/credit.service';
import { resolveRequestLocale, toApiLocale } from '../utils/locale.util';
import fs from 'fs';
import { decodeFilenames } from '../middleware/upload.middleware';

// Extend Request to include multer files
interface MulterRequest extends Request {
  files?: Express.Multer.File[];
}

export const playbookController = {
  async create(req: Request, res: Response, next: any) {
    try {
      const mreq = req as MulterRequest;
      decodeFilenames(mreq.files);
      const attachments = mreq.files?.map(f => ({
        originalName: f.originalname,
        filename: f.filename,
        path: f.path,
        size: f.size,
        mimetype: f.mimetype,
      })) || [];
      const playbook = await PlaybookService.create(req.user!.id, req.body, attachments);
      console.log(`[PlaybookController] Create result → creditsAwarded:`, (playbook as any).creditsAwarded);
      res.status(201).json({ success: true, data: playbook });
    } catch (err) {
      next(err);
    }
  },

  async getAll(req: Request, res: Response) {
    const locale = toApiLocale(await resolveRequestLocale(req));
    const result = await PlaybookService.findAll({ ...(req.query as any), locale });
    res.json({ success: true, ...result });
  },

  async getMarketplace(req: Request, res: Response) {
    const locale = toApiLocale(await resolveRequestLocale(req));
    const result = await PlaybookService.findMarketplace({ ...(req.query as any), locale });
    res.json({ success: true, ...result });
  },

  async getById(req: Request, res: Response) {
    const locale = toApiLocale(await resolveRequestLocale(req));
    const result = await PlaybookService.getWithBrowseCredit(
      req.params.id,
      req.user?.id || '',
      (req.user as any)?.tier || 'free',
      locale,
    );
    if (!result) return res.status(404).json({ success: false, error: 'Playbook not found' });

    res.json({ success: true, data: result });
  },

  async update(req: Request, res: Response) {
    const playbook = await PlaybookService.update(req.params.id, req.user!.id, req.body);
    res.json({ success: true, data: playbook });
  },

  async delete(req: Request, res: Response) {
    await PlaybookService.delete(req.params.id, req.user!.id);
    res.json({ success: true, message: 'Playbook deleted' });
  },

  async purchase(req: Request, res: Response) {
    try {
      const result = await PlaybookService.purchase(req.params.id, req.user!.id);
      res.status(201).json({ success: true, ...result });
    } catch (err: any) {
      const code = err.statusCode || err.status || 500;
      res.status(code).json({ success: false, error: err.message || 'Purchase failed' });
    }
  },

  async getPurchases(req: Request, res: Response) {
    const locale = toApiLocale(await resolveRequestLocale(req));
    const result = await PlaybookService.getUserPurchases(req.user!.id, { ...(req.query as any), locale });
    res.json({ success: true, ...result });
  },

  async getAuthorStats(req: Request, res: Response) {
    const stats = await PlaybookService.getAuthorStats(req.user!.id);
    res.json({ success: true, data: stats });
  },

  async uploadAttachments(req: Request, res: Response) {
    const mreq = req as MulterRequest;
    decodeFilenames(mreq.files);
    const attachments = mreq.files?.map(f => ({
      originalName: f.originalname,
      filename: f.filename,
      path: f.path,
      size: f.size,
      mimetype: f.mimetype,
    })) || [];
    const result = await PlaybookService.addAttachments(req.params.id, req.user!.id, attachments);
    res.status(201).json({ success: true, data: result });
  },

  async downloadAttachment(req: Request, res: Response) {
    try {
      const { id, filename } = req.params;
      const filePath = await PlaybookService.getAttachmentPath(id, req.user!.id, filename, (req.user as any)?.tier || 'free');
      if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, error: 'File not found' });
      res.download(filePath, filename);
    } catch (err: any) {
      const code = err.statusCode || err.status || 403;
      // Map AppError 402 to proper JSON response for frontend handling
      res.status(code).json({ success: false, error: err.message || 'Download failed' });
    }
  },

  async uploadImage(req: Request, res: Response) {
    try {
      const mreq = req as MulterRequest & { file?: Express.Multer.File };
      if (!mreq.file) return res.status(400).json({ success: false, error: 'No image file provided' });
      const url = `/uploads/attachments/${mreq.file.filename}`;
      res.json({ success: true, url });
    } catch (err: any) {
      const code = err.statusCode || err.status || 500;
      res.status(code).json({ success: false, error: err.message || 'Image upload failed' });
    }
  },

  // ===== Rating & Review =====

  async ratePlaybook(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const playbookId = req.params.id;
      const rating = await ratingService.ratePlaybook(userId, playbookId, req.body);
      res.status(201).json({ success: true, data: rating });
    } catch (err: any) {
      const code = err.statusCode || err.status || 400;
      res.status(code).json({ success: false, error: err.message || 'Rating failed' });
    }
  },

  async getRatings(req: Request, res: Response) {
    try {
      const playbookId = req.params.id;
      const result = await ratingService.getRatings(playbookId, Number(req.query.page), Number(req.query.limit));
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to get ratings' });
    }
  },

  async getUserRating(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const playbookId = req.params.id;
      const rating = await ratingService.getUserRating(userId, playbookId);
      res.json({ success: true, data: rating });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to get user rating' });
    }
  },

  async deleteRating(req: Request, res: Response) {
    try {
      await ratingService.deleteRating(req.user!.id, req.params.id);
      res.json({ success: true, message: 'Rating deleted' });
    } catch (err: any) {
      res.status(404).json({ success: false, error: err.message || 'Rating not found' });
    }
  },

  // ===== Comments (评论/回复) =====

  async createComment(req: Request, res: Response) {
    try {
      const comment = await CommentService.createComment({
        playbookId: req.params.id,
        userId: req.user!.id,
        content: req.body.content,
        parentId: req.body.parentId,
      });
      res.status(201).json({ success: true, data: comment });
    } catch (err: any) {
      const code = err.statusCode || err.status || 400;
      res.status(code).json({ success: false, error: err.message || 'Failed to post comment' });
    }
  },

  async getComments(req: Request, res: Response) {
    try {
      const locale = toApiLocale(await resolveRequestLocale(req));
      const result = await CommentService.getPlaybookComments(
        req.params.id,
        Number(req.query.page) || 1,
        Number(req.query.limit) || 50,
        locale,
      );
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to get comments' });
    }
  },

  async deleteComment(req: Request, res: Response) {
    try {
      const result = await CommentService.deleteComment(
        req.params.id,
        req.params.commentId,
        req.user!.id,
      );
      if (!result) return res.status(404).json({ success: false, error: 'Comment not found' });
      res.json({ success: true, message: 'Comment deleted', data: result });
    } catch (err: any) {
      const code = err.statusCode || err.status || 403;
      res.status(code).json({ success: false, error: err.message || 'Failed to delete comment' });
    }
  },

  async getMyBrowsed(req: Request, res: Response) {
    const locale = toApiLocale(await resolveRequestLocale(req));
    const result = await PlaybookService.getMyBrowsed(req.user!.id, { ...(req.query as any), locale });
    res.json({ success: true, ...result });
  },

  // ===== Favorites (收藏) =====

  async toggleFavorite(req: Request, res: Response) {
    try {
      const result = await PlaybookService.toggleFavorite(req.user!.id, req.params.id);
      res.json({ success: true, ...result });
    } catch (err: any) {
      const code = err.statusCode || err.status || 400;
      res.status(code).json({ success: false, error: err.message || 'Toggle favorite failed' });
    }
  },

  async getMyFavorites(req: Request, res: Response) {
    const locale = toApiLocale(await resolveRequestLocale(req));
    const result = await PlaybookService.getMyFavorites(req.user!.id, { ...(req.query as any), locale });
    res.json({ success: true, ...result });
  },

  // ===== Likes (点赞) =====

  async toggleLike(req: Request, res: Response) {
    try {
      const result = await PlaybookService.toggleLike(req.user!.id, req.params.id);
      res.json({ success: true, ...result });
    } catch (err: any) {
      const code = err.statusCode || err.status || 400;
      res.status(code).json({ success: false, error: err.message || 'Toggle like failed' });
    }
  },

  async getMyLikes(req: Request, res: Response) {
    const playbookIds = await PlaybookService.getMyLikeIds(req.user!.id);
    res.json({ success: true, playbookIds });
  },
};
