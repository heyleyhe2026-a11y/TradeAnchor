import { Router } from 'express';
import { aiQuestionController } from '../controllers/ai-question.controller';
import { authenticate } from '../middleware/auth.middleware';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const router: any = Router();
router.use(authenticate);
router.post('/questions', aiQuestionController.askQuestion.bind(aiQuestionController));
router.get('/questions', aiQuestionController.listQuestions.bind(aiQuestionController));
router.get('/questions/quota', aiQuestionController.checkQuota.bind(aiQuestionController));
export default router;
