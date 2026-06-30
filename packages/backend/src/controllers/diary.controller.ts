import { Request, Response, NextFunction } from 'express';
import { diaryService } from '../services/diary.service';

export class DiaryController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { res.status(201).json({success:true,data:await diaryService.createEntry(req.user!.id,req.body)}); }
    catch (e) { next(e); }
  }
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { const page=parseInt(String(req.query.page)||'1',10),limit=parseInt(String(req.query.limit)||'20',10); res.json({success:true,...await diaryService.listEntries(req.user!.id,page,limit)}); }
    catch(e){next(e);}
  }
  async getById(req:Request,res:Response,next:NextFunction):Promise<void>{
    try{res.json({success:true,data:await diaryService.getById(req.user!.id,req.params.id)});}catch(e){next(e);}
  }
  async update(req:Request,res:Response,next:NextFunction):Promise<void>{
    try{res.json({success:true,data:await diaryService.updateEntry(req.user!.id,req.params.id,req.body)});}catch(e){next(e);}
  }
  async del(req:Request,res:Response,next:NextFunction):Promise<void>{
    try{await diaryService.deleteEntry(req.user!.id,req.params.id);res.json({success:true,message:'Deleted'});}catch(e){next(e);}
  }}
export const diaryController=new DiaryController();
