# Database Setup Guide

## Prerequisites

- PostgreSQL 15+ installed and running
- Database created: `tradewise`
- User with appropriate permissions

## Quick Start

### 1. Configure Database Connection

Update `.env` file with your database credentials:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/tradewise?schema=public"
```

### 2. Generate Prisma Client

```bash
pnpm db:generate
```

### 3. Create and Apply Migrations

For development:
```bash
pnpm db:migrate
```

For production:
```bash
pnpm db:migrate:deploy
```

### 4. (Optional) Seed Database

```bash
pnpm db:seed
```

## Available Commands

- `pnpm db:generate` - Generate Prisma Client
- `pnpm db:migrate` - Create and apply migrations (dev)
- `pnpm db:migrate:deploy` - Apply migrations (production)
- `pnpm db:push` - Push schema changes without migrations
- `pnpm db:studio` - Open Prisma Studio (GUI)
- `pnpm db:seed` - Seed database with initial data

## Database Schema

The schema includes the following tables:

### Core Tables
- **users** - User accounts and authentication
- **subscriptions** - Subscription tiers and status
- **user_preferences** - User settings and preferences

### Trading Data
- **trades** - Individual trade records
- **batches** - Trade batch groupings
- **diary_entries** - Trading journal entries

### Marketplace
- **playbooks** - Trading strategies
- **playbook_purchases** - Purchase records

### Mentor System
- **trading_circles** - Mentor-student groups
- **circle_memberships** - Circle membership records
- **mentor_feedback** - Mentor feedback to students

### Financial
- **payments** - Payment transactions
- **credits** - User credit system

### System
- **audit_logs** - System audit trail

## Connection Pool Configuration

Prisma automatically manages connection pooling. Default settings:

- Connection limit: Based on database configuration
- Connection timeout: 10 seconds
- Pool timeout: 10 seconds

To customize, update `prisma.config.ts`:

```typescript
export default defineConfig({
  datasource: {
    url: process.env["DATABASE_URL"],
    // Add connection pool settings if needed
  },
});
```

## Troubleshooting

### Connection Issues

1. Verify PostgreSQL is running:
   ```bash
   psql -U postgres -c "SELECT version();"
   ```

2. Check database exists:
   ```bash
   psql -U postgres -l
   ```

3. Test connection:
   ```bash
   psql -U username -d tradewise
   ```

### Migration Issues

1. Reset database (⚠️ destroys all data):
   ```bash
   pnpm prisma migrate reset
   ```

2. Check migration status:
   ```bash
   pnpm prisma migrate status
   ```

## Production Considerations

1. **Connection Pooling**: Use PgBouncer or similar for production
2. **Backups**: Set up automated daily backups
3. **Monitoring**: Monitor query performance and connection pool
4. **Security**: Use strong passwords and restrict network access
5. **SSL**: Enable SSL for database connections in production

## Schema Updates

When modifying the schema:

1. Update `prisma/schema.prisma`
2. Run `pnpm db:migrate` to create migration
3. Review generated migration in `prisma/migrations/`
4. Commit both schema and migration files
