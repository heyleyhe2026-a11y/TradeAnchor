import 'dotenv/config';
import app from './app';
import { connectDatabase, disconnectDatabase } from './lib/db-health';
import { getRedisClient, disconnectRedis } from './lib/redis';
import { getMongoClient, disconnectMongo, initializeMongoIndexes } from './lib/mongodb';
import logger from './lib/logger';

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    // Connect to databases
    logger.info('🚀 Starting TradeAnchor API Server...');
    
    // Connect to PostgreSQL
    await connectDatabase();
    logger.info('✅ PostgreSQL connected');
    
    // Connect to Redis
    getRedisClient();
    logger.info('✅ Redis connected');
    
    // Connect to MongoDB and initialize indexes
    await getMongoClient();
    await initializeMongoIndexes();
    logger.info('✅ MongoDB connected');

    // Start Express server
    const server = app.listen(PORT, () => {
      logger.info(`✅ Server is running on port ${PORT}`);
      logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
      logger.info(`🔗 API endpoint: http://localhost:${PORT}/api/v1`);
      logger.info(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        try {
          await disconnectDatabase();
          await disconnectRedis();
          await disconnectMongo();
          logger.info('✅ All connections closed');
          process.exit(0);
        } catch (error) {
          logger.error('❌ Error during shutdown:', error);
          process.exit(1);
        }
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('⚠️  Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
