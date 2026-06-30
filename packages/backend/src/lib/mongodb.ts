import { MongoClient, Db, Collection, Document } from 'mongodb';

// MongoDB client instance
let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;

/**
 * Get or create MongoDB client instance
 */
export async function getMongoClient(): Promise<MongoClient> {
  if (!mongoClient) {
    const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017/tradewise';
    
    mongoClient = new MongoClient(mongoUrl, {
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    await mongoClient.connect();
    console.log('✅ MongoDB connected successfully');
  }

  return mongoClient;
}

/**
 * Get MongoDB database instance
 */
export async function getMongoDb(): Promise<Db> {
  if (!mongoDb) {
    const client = await getMongoClient();
    const dbName = process.env.MONGODB_DB_NAME || 'tradewise';
    mongoDb = client.db(dbName);
  }

  return mongoDb;
}

/**
 * Get a specific collection
 */
export async function getCollection<T extends Document = any>(collectionName: string): Promise<Collection<T>> {
  const db = await getMongoDb();
  return db.collection<T>(collectionName);
}

/**
 * Check MongoDB connection health
 */
export async function checkMongoHealth(): Promise<boolean> {
  try {
    const client = await getMongoClient();
    await client.db().admin().ping();
    return true;
  } catch (error) {
    console.error('MongoDB health check failed:', error);
    return false;
  }
}

/**
 * Disconnect from MongoDB
 */
export async function disconnectMongo(): Promise<void> {
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
    mongoDb = null;
    console.log('MongoDB disconnected');
  }
}

/**
 * MongoDB collection names
 */
export const MongoCollections = {
  AI_REPORTS: 'ai_reports',
  AI_QUESTIONS: 'ai_questions',
  NOTIFICATIONS: 'notifications',
} as const;

/**
 * Asset category type for AI report differentiation
 */
export type AssetCategory = 'us_stocks' | 'forex' | 'crypto' | 'futures' | 'mixed';

/**
 * AI Report document interface (v2 - supports differentiated analysis)
 */
export interface AIReportDocument {
  _id?: any;
  reportId: string;
  userId: string;
  batchIds: string[];
  locale: string;
  aiModel: string;
  generatedAt: Date;
  content: {
    // === V2 New fields for differentiated analysis ===
    /** Report output format */
    reportType?: 'quick' | 'deep';
    /** Auto-detected or user-selected asset category */
    assetCategory?: AssetCategory;

    /** Module 1: Quick Snapshot (for quick reports) */
    quickSnapshot?: {
      sentiment: 'bullish' | 'bearish' | 'neutral';
      keySupport: string;
      keyResistance: string;
      shortTermBias: string;
      stopLossHint: string;
      coreRisk: string;
    };

    /** Module 2: Asset Overview & Market Context (for deep reports) */
    assetOverview?: {
      basicInfo: { name: string; code: string; market: string };
      pricePerformance: { dailyRange: string; weeklyChange: string; volatility: string };
      marketCorrelation: string;
      trendQualification: string;
    };

    /** Module 3: Multi-timeframe Technical Analysis */
    technicalAnalysis?: {
      timeframeConvergence: string;
      coreIndicators: { ma: string; macd: string; rsi: string; boll: string; kdj: string };
      keyLevels: { strongSupport: string; weakSupport: string; strongResistance: string; weakResistance: string };
      patternAnalysis: string;
    };

    /** Module 4: Fund Flow & Market Sentiment */
    fundSentiment?: {
      capitalFlow: string;
      longShortRatio: string;
      positionData?: string;
    };

    /** Module 5: Drivers & Event Calendar */
    driversEvents?: {
      currentFactors: Array<{ type: 'positive' | 'negative'; factor: string }>;
      upcomingEvents: Array<{ date: string; event: string; impact: string }>;
    };

    /** Module 6: Risk Assessment (Core Risk Control) */
    riskAssessment?: {
      level: 'high' | 'medium' | 'low';
      riskFactors: string[];
      explanation: string;
    };

    /** Module 7: Multi-period Trading Suggestions */
    tradingSuggestions?: {
      intraday?: { entryZone: string; stopLoss: string; takeProfit: string; positionSize: string; overnight: boolean };
      swing?: { logic: string; targetPrice: string; stopLoss: string; addReduceRules: string };
      midterm?: { trendBias: string; holdCycle: string; positionLimit: string };
      unifiedCommand: string;
    };

    /** Module 8: Category-Specific Analysis (Differentiated by Asset Type) */
    categorySpecific?: {
      usStocks?: {
        fundamentals?: string;
        institutionalRating?: string;
        industrySector?: string;
        optionsData?: string;
        macroDriver?: string;
        specificRisks?: string[];
      };
      forex?: {
        macroComparison?: string;
        currencyAttributes?: string;
        sessionCharacteristics?: string;
        capitalFlow?: string;
        specificRisks?: string[];
      };
      crypto?: {
        chainData?: string;
        derivativesData?: string;
        regulatorySentiment?: string;
        crossMarketLinkage?: string;
        specificRisks?: string[];
      };
    };

    // === V1 Legacy fields (backward compatible) ===
    summary: string;
    tradingPatterns: Array<{
      pattern: string;
      frequency: number;
      impact: string;
      examples: string[]; // trade IDs
    }>;
    strengths: string[];
    weaknesses: string[];
    improvementSuggestions: Array<{
      priority: 'high' | 'medium' | 'low';
      suggestion: string;
      expectedImpact: string;
    }>;
    statistics: {
      totalTrades: number;
      winRate: number;
      avgPnL: number;
      maxDrawdown: number;
      bestPerformingSymbol: string;
      worstPerformingSymbol: string;
      timeAnalysis: Record<string, any>;
    };
  };
  metadata: {
    generationTimeMs: number;
    tokensUsed: number;
    dataPointsAnalyzed: number;
  };
  creditsAwarded?: number;
}

/**
 * AI Question document interface
 */
export interface AIQuestionDocument {
  _id?: any;
  questionId: string;
  userId: string;
  reportId: string;
  question: string;
  answer: string;
  aiModel: string;
  locale: string;
  askedAt: Date;
  answeredAt: Date;
  responseTimeMs: number;
  contextData: {
    batchIds: string[];
    tradeCount: number;
    dateRange: {
      start: Date;
      end: Date;
    };
  };
  metadata?: {
    tokensUsed: number;
  };
  creditsAwarded?: number;
}

/**
 * Initialize MongoDB indexes
 */
export async function initializeMongoIndexes(): Promise<void> {
  try {
    const db = await getMongoDb();

    // AI Reports indexes
    const reportsCollection = db.collection(MongoCollections.AI_REPORTS);
    await reportsCollection.createIndex({ reportId: 1 }, { unique: true });
    await reportsCollection.createIndex({ userId: 1 });
    await reportsCollection.createIndex({ generatedAt: -1 });
    await reportsCollection.createIndex({ 'content.statistics.winRate': 1 });

    // AI Questions indexes
    const questionsCollection = db.collection(MongoCollections.AI_QUESTIONS);
    await questionsCollection.createIndex({ questionId: 1 }, { unique: true });
    await questionsCollection.createIndex({ userId: 1 });
    await questionsCollection.createIndex({ reportId: 1 });
    await questionsCollection.createIndex({ askedAt: -1 });

    // Notifications indexes
    const notifCollection = db.collection(MongoCollections.NOTIFICATIONS);
    await notifCollection.createIndex({ notificationId: 1 }, { unique: true });
    await notifCollection.createIndex({ userId: 1 });
    await notifCollection.createIndex({ createdAt: -1 });
    await notifCollection.createIndex({ userId: 1, isRead: 1 });

    console.log('✅ MongoDB indexes initialized');
  } catch (error) {
    console.error('❌ Failed to initialize MongoDB indexes:', error);
    throw error;
  }
}

export default getMongoDb;
