import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireEmailVerification } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { createPlaybookValidator, updatePlaybookValidator } from '../validators/playbook.validator';
import { createRatingSchema, updateRatingSchema } from '../validators/rating.validator';
import { playbookController } from '../controllers/playbook.controller';
import { uploadMiddleware } from '../middleware/upload.middleware';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const router: any = Router();

router.use(authenticate);

// Image upload for markdown content (must be before /:id routes)
const imageUpload = uploadMiddleware.single('image');
router.post('/upload-image', (req: Request, res: Response, next: NextFunction) => { imageUpload(req, res, next); }, playbookController.uploadImage);
router.post('/', requireEmailVerification, uploadMiddleware.array('attachments', 10), validate(createPlaybookValidator), playbookController.create);
router.get('/marketplace', playbookController.getMarketplace);
router.get('/', playbookController.getAll);

// User-specific routes MUST come before /:id parametric route
router.get('/my/purchases', playbookController.getPurchases);
router.get('/my/browsed', playbookController.getMyBrowsed);
router.get('/my/favorites', playbookController.getMyFavorites);
router.get('/my/likes', playbookController.getMyLikes);
router.get('/my/author-stats', playbookController.getAuthorStats);

// Parametric routes last (to avoid shadowing literal paths like /my/*)
router.get('/:id', playbookController.getById);
router.put('/:id', requireEmailVerification, validate(updatePlaybookValidator), playbookController.update);
router.delete('/:id', requireEmailVerification, playbookController.delete);
router.post('/:id/purchase', requireEmailVerification, playbookController.purchase);

// Favorite toggle
router.post('/:id/favorite', playbookController.toggleFavorite);

// Like toggle
router.post('/:id/like', playbookController.toggleLike);

// Rating & Review endpoints
router.post('/:id/rate', validate(createRatingSchema), playbookController.ratePlaybook);
router.put('/:id/rate', validate(updateRatingSchema), playbookController.ratePlaybook);
router.get('/:id/rates', playbookController.getRatings);
router.get('/:id/my-rating', playbookController.getUserRating);
router.delete('/:id/rate', playbookController.deleteRating);

// Comment endpoints (independent from rating)
router.post('/:id/comments', playbookController.createComment);
router.get('/:id/comments', playbookController.getComments);
router.delete('/:id/comments/:commentId', playbookController.deleteComment);

router.get('/:id/attachments/:filename', playbookController.downloadAttachment);
router.post('/:id/attachments', uploadMiddleware.array('attachments', 10), playbookController.uploadAttachments);

export default router;
