import { PrismaClient } from '../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env file explicitly from backend directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Debug: Check if DATABASE_URL is loaded
console.log('DATABASE_URL:', process.env.DATABASE_URL);

// Create a connection pool for PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create the adapter using the pool
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ['error'],
});

const TEST_USERS = [
  {
    email: '1213129762@qq.com',
    password: 'Tradewise2026*',
    tier: 'free' as const,
    countryCode: 'CN',
    locale: 'zh',
  },
  {
    email: 'yuercrystal@126.com',
    password: 'Tradewise2026*',
    tier: 'pro' as const,
    countryCode: 'CN',
    locale: 'zh',
  },
  {
    email: 'heyleyhe2026@gmail.com',
    password: 'Tradewise2026*',
    tier: 'prem' as const,
    countryCode: 'US',
    locale: 'en',
  },
];

async function seed() {
  console.log('🌱 Starting database seeding...\n');

  for (const user of TEST_USERS) {
    console.log(`Creating user: ${user.email} (${user.tier} tier)...`);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: user.email },
    });

    if (existingUser) {
      console.log(`  ⚠️  User ${user.email} already exists, updating...`);

      // Update existing user's password and subscription
      const passwordHash = await bcrypt.hash(user.password, 10);

      await prisma.user.update({
        where: { email: user.email },
        data: {
          passwordHash,
          countryCode: user.countryCode,
          locale: user.locale,
          emailVerified: true, // Skip email verification for test accounts
        },
      });

      // Update subscription tier
      await prisma.subscription.updateMany({
        where: { userId: existingUser.id },
        data: {
          tier: user.tier,
          status: 'active',
        },
      });

      console.log(`  ✅ Updated successfully\n`);
    } else {
      // Create new user
      const passwordHash = await bcrypt.hash(user.password, 10);

      const newUser = await prisma.user.create({
        data: {
          email: user.email,
          passwordHash,
          countryCode: user.countryCode,
          locale: user.locale,
          emailVerified: true, // Skip email verification for test accounts
        },
      });

      // Create subscription
      await prisma.subscription.create({
        data: {
          userId: newUser.id,
          tier: user.tier,
          status: 'active',
        },
      });

      // Create user preferences
      await prisma.userPreference.create({
        data: {
          userId: newUser.id,
          locale: user.locale,
        },
      });

      console.log(`  ✅ Created successfully\n`);
    }
  }

  console.log('✨ Seeding completed!');
  console.log('\n📋 Test Accounts:\n');
  console.log('┌─────────────────────────────┬────────────┬──────────────────┐');
  console.log('│ Email                       │ Tier       │ Password         │');
  console.log('├─────────────────────────────┼────────────┼──────────────────┤');
  for (const user of TEST_USERS) {
    const tierName = user.tier === 'free' ? 'Free' : user.tier === 'pro' ? 'Pro' : 'Premium';
    console.log(`│ ${user.email.padEnd(27)} │ ${tierName.padEnd(10)} │ ${user.password.padEnd(16)} │`);
  }
  console.log('└─────────────────────────────┴────────────┴──────────────────┘\n');
}

seed()
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
