import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { TaskService } from './task.service';

export const createDiarySchema = z.object({
  title: z.string().min(1).max(200).trim(),
  content: z.string().min(1),
  tradeIds: z.array(z.string().uuid()).optional(),
});

export type CreateDiaryDto = z.infer<typeof createDiarySchema>;

export class DiaryService {
  async createEntry(userId:string, data:CreateDiaryDto){
    const entry = await prisma.diaryEntry.create({
      data:{userId,title:data.title,content:data.content,
        tradeIds:data.tradeIds||[]},
    });

    // Record task events for diary entries — capture credit awards for frontend toast
    let creditsAwarded = 0;
    try {
      console.log(`[DiaryService] About to record task events for userId=${userId}`);
      const r1 = await TaskService.recordEvent(userId, 'first_diary_entry', 1);
      console.log(`[DiaryService] first_diary_entry result:`, JSON.stringify(r1));
      const r2 = await TaskService.recordEvent(userId, 'diary_entries_7', 1);
      console.log(`[DiaryService] diary_entries_7 result:`, JSON.stringify(r2));
      creditsAwarded = (r1.creditsAwarded || 0) + (r2.creditsAwarded || 0);
    } catch (err) {
      console.error(`[DiaryService] ERROR recording task events:`, err);
    }

    return { ...entry, creditsAwarded };
  }

  async listEntries(userId:string,page=1,limit=20){
    const p = Number(page) || 1;
    const l = Number(limit) || 20;
    const skip=(p-1)*l;
    const [entries,total]=await Promise.all([
      prisma.diaryEntry.findMany({where:{userId},orderBy:{createdAt:'desc'},skip,take:l}),
      prisma.diaryEntry.count({where:{userId}}),
    ]);
    return{entries,page:p,limit:l,total,totalPages:Math.ceil(total/l)};
  }

  async getById(userId:string, id:string){
    const entry=await prisma.diaryEntry.findFirst({where:{id,userId}});
    if(!entry) throw new Error('Diary entry not found');
    return entry;
  }

  async updateEntry(userId:string,id:string,data:Partial<Pick<CreateDiaryDto,'title'|'content'|'tradeIds'>>){
    await this.getById(userId,id); // verify
    return prisma.diaryEntry.update({where:{id},data:{
      ...(data.title!==undefined&&{title:data.title}),
      ...(data.content!==undefined&&{content:data.content}),
      ...(data.tradeIds!==undefined&&{tradeIds:data.tradeIds}),
    }});
  }

  async deleteEntry(userId:string,id:string){
    await this.getById(userId,id);
    return prisma.diaryEntry.delete({where:{id}});
  }
}

export const diaryService=new DiaryService();
