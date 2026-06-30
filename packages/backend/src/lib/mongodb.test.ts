import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import {
  getMongoClient,
  getMongoDb,
  getCollection,
  checkMongoHealth,
  disconnectMongo,
  initializeMongoIndexes,
  MongoCollections,
  AIReportDocument,
  AIQuestionDocument,
} from './mongodb';
import { v4 as uuidv4 } from 'uuid';

describe('MongoDB Client', () => {
  beforeAll(async () => {
    // Connect to MongoDB
    await getMongoClient();
    await initializeMongoIndexes();
  });

  afterAll(async () => {
    // Clean up test data and disconnect
    const db = await getMongoDb();
    await db.collection(MongoCollections.AI_REPORTS).deleteMany({ reportId: /^test-/ });
    await db.collection(MongoCollections.AI_QUESTIONS).deleteMany({ questionId: /^test-/ });
    await disconnectMongo();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    const db = await getMongoDb();
    await db.collection(MongoCollections.AI_REPORTS).deleteMany({ reportId: /^test-/ });
    await db.collection(MongoCollections.AI_QUESTIONS).deleteMany({ questionId: /^test-/ });
  });

  describe('Connection', () => {
    it('should connect to MongoDB successfully', async () => {
      const client = await getMongoClient();
      expect(client).toBeDefined();
      expect(client.topology?.isConnected()).toBe(true);
    });

    it('should get MongoDB database instance', async () => {
      const db = await getMongoDb();
      expect(db).toBeDefined();
      expect(db.databaseName).toBe('tradewise');
    });

    it('should get a specific collection', async () => {
      const collection = await getCollection(MongoCollections.AI_REPORTS);
      expect(collection).toBeDefined();
      expect(collection.collectionName).toBe(MongoCollections.AI_REPORTS);
    });
  });

  describe('Health Check', () => {
    it('should return true when MongoDB is healthy', async () => {
      const isHealthy = await checkMongoHealth();
      expect(isHealthy).toBe(true);
    });

    it('should handle health check errors gracefully', async () => {
      // Temporarily disconnect
      await disconnectMongo();
      
      const isHealthy = await checkMongoHealth();
      
      // Reconnect for other tests
      await getMongoClient();
      
      // Health check should handle disconnection
      expect(typeof isHealthy).toBe('boolean');
    });
  });

  describe('AI Reports Collection', () => {
    it('should insert an AI report document', async () => {
      const collection = await getCollection<AIReportDocument>(MongoCollections.AI_REPORTS);
      
      const report: AIReportDocument = {
        reportId: `test-${uuidv4()}`,
        userId: 'user-123',
        batchIds: ['batch-1', 'batch-2'],
        locale: 'en',
        aiModel: 'gpt-4',
        generatedAt: new Date(),
        content: {
          summary: 'Your trading shows strong performance in tech stocks.',
          tradingPatterns: [
            {
              pattern: 'Morning trading bias',
              frequency: 15,
              impact: 'positive',
              examples: ['trade-1', 'trade-2'],
            },
          ],
          strengths: ['Good risk management', 'Consistent profit taking'],
          weaknesses: ['Overtrading on Fridays', 'Large position sizes'],
          improvementSuggestions: [
            {
              priority: 'high',
              suggestion: 'Reduce position size by 20%',
              expectedImpact: 'Lower drawdown risk',
            },
          ],
          statistics: {
            totalTrades: 45,
            winRate: 0.67,
            avgPnL: 125.50,
            maxDrawdown: -1250.00,
            bestPerformingSymbol: 'AAPL',
            worstPerformingSymbol: 'TSLA',
            timeAnalysis: {
              bestDay: 'Tuesday',
              worstDay: 'Friday',
            },
          },
        },
        metadata: {
          generationTimeMs: 25000,
          tokensUsed: 3500,
          dataPointsAnalyzed: 45,
        },
      };

      const result = await collection.insertOne(report);
      expect(result.insertedId).toBeDefined();
      expect(result.acknowledged).toBe(true);
    });

    it('should find an AI report by reportId', async () => {
      const collection = await getCollection<AIReportDocument>(MongoCollections.AI_REPORTS);
      const reportId = `test-${uuidv4()}`;
      
      const report: AIReportDocument = {
        reportId,
        userId: 'user-123',
        batchIds: ['batch-1'],
        locale: 'en',
        aiModel: 'gpt-4',
        generatedAt: new Date(),
        content: {
          summary: 'Test report',
          tradingPatterns: [],
          strengths: [],
          weaknesses: [],
          improvementSuggestions: [],
          statistics: {
            totalTrades: 10,
            winRate: 0.6,
            avgPnL: 100,
            maxDrawdown: -500,
            bestPerformingSymbol: 'AAPL',
            worstPerformingSymbol: 'TSLA',
            timeAnalysis: {},
          },
        },
        metadata: {
          generationTimeMs: 20000,
          tokensUsed: 2000,
          dataPointsAnalyzed: 10,
        },
      };

      await collection.insertOne(report);

      const found = await collection.findOne({ reportId });
      expect(found).toBeDefined();
      expect(found?.reportId).toBe(reportId);
      expect(found?.userId).toBe('user-123');
    });

    it('should find all reports for a user', async () => {
      const collection = await getCollection<AIReportDocument>(MongoCollections.AI_REPORTS);
      const userId = 'user-456';
      
      // Insert multiple reports
      const reports: AIReportDocument[] = [
        {
          reportId: `test-${uuidv4()}`,
          userId,
          batchIds: ['batch-1'],
          locale: 'en',
          aiModel: 'gpt-4',
          generatedAt: new Date(),
          content: {
            summary: 'Report 1',
            tradingPatterns: [],
            strengths: [],
            weaknesses: [],
            improvementSuggestions: [],
            statistics: {
              totalTrades: 10,
              winRate: 0.6,
              avgPnL: 100,
              maxDrawdown: -500,
              bestPerformingSymbol: 'AAPL',
              worstPerformingSymbol: 'TSLA',
              timeAnalysis: {},
            },
          },
          metadata: {
            generationTimeMs: 20000,
            tokensUsed: 2000,
            dataPointsAnalyzed: 10,
          },
        },
        {
          reportId: `test-${uuidv4()}`,
          userId,
          batchIds: ['batch-2'],
          locale: 'en',
          aiModel: 'claude-3',
          generatedAt: new Date(),
          content: {
            summary: 'Report 2',
            tradingPatterns: [],
            strengths: [],
            weaknesses: [],
            improvementSuggestions: [],
            statistics: {
              totalTrades: 20,
              winRate: 0.7,
              avgPnL: 150,
              maxDrawdown: -600,
              bestPerformingSymbol: 'GOOGL',
              worstPerformingSymbol: 'AMZN',
              timeAnalysis: {},
            },
          },
          metadata: {
            generationTimeMs: 22000,
            tokensUsed: 2500,
            dataPointsAnalyzed: 20,
          },
        },
      ];

      await collection.insertMany(reports);

      const found = await collection.find({ userId }).toArray();
      expect(found.length).toBe(2);
      expect(found.every(r => r.userId === userId)).toBe(true);
    });

    it('should update an AI report', async () => {
      const collection = await getCollection<AIReportDocument>(MongoCollections.AI_REPORTS);
      const reportId = `test-${uuidv4()}`;
      
      const report: AIReportDocument = {
        reportId,
        userId: 'user-123',
        batchIds: ['batch-1'],
        locale: 'en',
        aiModel: 'gpt-4',
        generatedAt: new Date(),
        content: {
          summary: 'Original summary',
          tradingPatterns: [],
          strengths: [],
          weaknesses: [],
          improvementSuggestions: [],
          statistics: {
            totalTrades: 10,
            winRate: 0.6,
            avgPnL: 100,
            maxDrawdown: -500,
            bestPerformingSymbol: 'AAPL',
            worstPerformingSymbol: 'TSLA',
            timeAnalysis: {},
          },
        },
        metadata: {
          generationTimeMs: 20000,
          tokensUsed: 2000,
          dataPointsAnalyzed: 10,
        },
      };

      await collection.insertOne(report);

      const updateResult = await collection.updateOne(
        { reportId },
        { $set: { 'content.summary': 'Updated summary' } }
      );

      expect(updateResult.modifiedCount).toBe(1);

      const updated = await collection.findOne({ reportId });
      expect(updated?.content.summary).toBe('Updated summary');
    });

    it('should delete an AI report', async () => {
      const collection = await getCollection<AIReportDocument>(MongoCollections.AI_REPORTS);
      const reportId = `test-${uuidv4()}`;
      
      const report: AIReportDocument = {
        reportId,
        userId: 'user-123',
        batchIds: ['batch-1'],
        locale: 'en',
        aiModel: 'gpt-4',
        generatedAt: new Date(),
        content: {
          summary: 'Test report',
          tradingPatterns: [],
          strengths: [],
          weaknesses: [],
          improvementSuggestions: [],
          statistics: {
            totalTrades: 10,
            winRate: 0.6,
            avgPnL: 100,
            maxDrawdown: -500,
            bestPerformingSymbol: 'AAPL',
            worstPerformingSymbol: 'TSLA',
            timeAnalysis: {},
          },
        },
        metadata: {
          generationTimeMs: 20000,
          tokensUsed: 2000,
          dataPointsAnalyzed: 10,
        },
      };

      await collection.insertOne(report);

      const deleteResult = await collection.deleteOne({ reportId });
      expect(deleteResult.deletedCount).toBe(1);

      const found = await collection.findOne({ reportId });
      expect(found).toBeNull();
    });
  });

  describe('AI Questions Collection', () => {
    it('should insert an AI question document', async () => {
      const collection = await getCollection<AIQuestionDocument>(MongoCollections.AI_QUESTIONS);
      
      const question: AIQuestionDocument = {
        questionId: `test-${uuidv4()}`,
        userId: 'user-123',
        reportId: 'report-123',
        question: 'Why do I lose more on Fridays?',
        answer: 'Based on your trading data, you tend to overtrade on Fridays...',
        aiModel: 'gpt-4',
        locale: 'en',
        askedAt: new Date(),
        answeredAt: new Date(),
        responseTimeMs: 6500,
        contextData: {
          batchIds: ['batch-1', 'batch-2'],
          tradeCount: 45,
          dateRange: {
            start: new Date('2024-01-01'),
            end: new Date('2024-01-31'),
          },
        },
      };

      const result = await collection.insertOne(question);
      expect(result.insertedId).toBeDefined();
      expect(result.acknowledged).toBe(true);
    });

    it('should find questions by reportId', async () => {
      const collection = await getCollection<AIQuestionDocument>(MongoCollections.AI_QUESTIONS);
      const reportId = 'report-789';
      
      const questions: AIQuestionDocument[] = [
        {
          questionId: `test-${uuidv4()}`,
          userId: 'user-123',
          reportId,
          question: 'Question 1',
          answer: 'Answer 1',
          aiModel: 'gpt-4',
          locale: 'en',
          askedAt: new Date(),
          answeredAt: new Date(),
          responseTimeMs: 5000,
          contextData: {
            batchIds: ['batch-1'],
            tradeCount: 10,
            dateRange: {
              start: new Date('2024-01-01'),
              end: new Date('2024-01-31'),
            },
          },
        },
        {
          questionId: `test-${uuidv4()}`,
          userId: 'user-123',
          reportId,
          question: 'Question 2',
          answer: 'Answer 2',
          aiModel: 'gpt-4',
          locale: 'en',
          askedAt: new Date(),
          answeredAt: new Date(),
          responseTimeMs: 6000,
          contextData: {
            batchIds: ['batch-1'],
            tradeCount: 10,
            dateRange: {
              start: new Date('2024-01-01'),
              end: new Date('2024-01-31'),
            },
          },
        },
      ];

      await collection.insertMany(questions);

      const found = await collection.find({ reportId }).toArray();
      expect(found.length).toBe(2);
      expect(found.every(q => q.reportId === reportId)).toBe(true);
    });

    it('should find questions by userId', async () => {
      const collection = await getCollection<AIQuestionDocument>(MongoCollections.AI_QUESTIONS);
      const userId = 'user-999';
      
      const question: AIQuestionDocument = {
        questionId: `test-${uuidv4()}`,
        userId,
        reportId: 'report-123',
        question: 'Test question',
        answer: 'Test answer',
        aiModel: 'gpt-4',
        locale: 'en',
        askedAt: new Date(),
        answeredAt: new Date(),
        responseTimeMs: 5000,
        contextData: {
          batchIds: ['batch-1'],
          tradeCount: 10,
          dateRange: {
            start: new Date('2024-01-01'),
            end: new Date('2024-01-31'),
          },
        },
      };

      await collection.insertOne(question);

      const found = await collection.find({ userId }).toArray();
      expect(found.length).toBeGreaterThanOrEqual(1);
      expect(found.every(q => q.userId === userId)).toBe(true);
    });

    it('should sort questions by askedAt date', async () => {
      const collection = await getCollection<AIQuestionDocument>(MongoCollections.AI_QUESTIONS);
      const userId = 'user-sort-test';
      
      const questions: AIQuestionDocument[] = [
        {
          questionId: `test-${uuidv4()}`,
          userId,
          reportId: 'report-1',
          question: 'Question 1',
          answer: 'Answer 1',
          aiModel: 'gpt-4',
          locale: 'en',
          askedAt: new Date('2024-01-01'),
          answeredAt: new Date('2024-01-01'),
          responseTimeMs: 5000,
          contextData: {
            batchIds: ['batch-1'],
            tradeCount: 10,
            dateRange: {
              start: new Date('2024-01-01'),
              end: new Date('2024-01-31'),
            },
          },
        },
        {
          questionId: `test-${uuidv4()}`,
          userId,
          reportId: 'report-1',
          question: 'Question 2',
          answer: 'Answer 2',
          aiModel: 'gpt-4',
          locale: 'en',
          askedAt: new Date('2024-01-15'),
          answeredAt: new Date('2024-01-15'),
          responseTimeMs: 6000,
          contextData: {
            batchIds: ['batch-1'],
            tradeCount: 10,
            dateRange: {
              start: new Date('2024-01-01'),
              end: new Date('2024-01-31'),
            },
          },
        },
      ];

      await collection.insertMany(questions);

      const found = await collection.find({ userId }).sort({ askedAt: -1 }).toArray();
      expect(found.length).toBe(2);
      expect(found[0].askedAt.getTime()).toBeGreaterThan(found[1].askedAt.getTime());
    });
  });

  describe('Indexes', () => {
    it('should have unique index on reportId', async () => {
      const collection = await getCollection<AIReportDocument>(MongoCollections.AI_REPORTS);
      const reportId = `test-${uuidv4()}`;
      
      const report: AIReportDocument = {
        reportId,
        userId: 'user-123',
        batchIds: ['batch-1'],
        locale: 'en',
        aiModel: 'gpt-4',
        generatedAt: new Date(),
        content: {
          summary: 'Test',
          tradingPatterns: [],
          strengths: [],
          weaknesses: [],
          improvementSuggestions: [],
          statistics: {
            totalTrades: 10,
            winRate: 0.6,
            avgPnL: 100,
            maxDrawdown: -500,
            bestPerformingSymbol: 'AAPL',
            worstPerformingSymbol: 'TSLA',
            timeAnalysis: {},
          },
        },
        metadata: {
          generationTimeMs: 20000,
          tokensUsed: 2000,
          dataPointsAnalyzed: 10,
        },
      };

      await collection.insertOne(report);

      // Try to insert duplicate reportId
      await expect(collection.insertOne(report)).rejects.toThrow();
    });

    it('should have unique index on questionId', async () => {
      const collection = await getCollection<AIQuestionDocument>(MongoCollections.AI_QUESTIONS);
      const questionId = `test-${uuidv4()}`;
      
      const question: AIQuestionDocument = {
        questionId,
        userId: 'user-123',
        reportId: 'report-123',
        question: 'Test',
        answer: 'Test',
        aiModel: 'gpt-4',
        locale: 'en',
        askedAt: new Date(),
        answeredAt: new Date(),
        responseTimeMs: 5000,
        contextData: {
          batchIds: ['batch-1'],
          tradeCount: 10,
          dateRange: {
            start: new Date('2024-01-01'),
            end: new Date('2024-01-31'),
          },
        },
      };

      await collection.insertOne(question);

      // Try to insert duplicate questionId
      await expect(collection.insertOne(question)).rejects.toThrow();
    });
  });

  describe('Collection Names', () => {
    it('should have correct collection names', () => {
      expect(MongoCollections.AI_REPORTS).toBe('ai_reports');
      expect(MongoCollections.AI_QUESTIONS).toBe('ai_questions');
    });
  });
});
