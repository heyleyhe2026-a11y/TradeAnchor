import {Router}from 'express';
import{diaryController}from'../controllers/diary.controller';
import{authenticate}from'../middleware/auth.middleware';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const router:any=Router();router.use(authenticate);
router.post('/',diaryController.create.bind(diaryController));
router.get('/',diaryController.list.bind(diaryController));
router.get('/:id',diaryController.getById.bind(diaryController));
router.put('/:id',diaryController.update.bind(diaryController));
router.delete('/:id',diaryController.del.bind(diaryController));
export default router;
