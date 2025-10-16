# Database Migration Guide

## Overview

This project uses **Drizzle ORM** with automatic migrations for production deployments. The migration system runs automatically when the server starts, ensuring your production database stays in sync with your schema.

## Prerequisites

- **Development**: DATABASE_URL environment variable (optional - server will skip migrations if not set)
- **Production**: DATABASE_URL environment variable (required for auto-migrations)

## How It Works

### Development Workflow

When developing locally and making schema changes:

1. **Update your schema** in `shared/schema.ts`
2. **Sync the development database** by running:
   ```bash
   npm run db:push
   ```
   This directly updates your development database to match your schema.

> **Note**: If DATABASE_URL is not set, the server will start normally but skip migrations. This allows local development without a database.

### Production Deployment Workflow

For production deployments, migrations run **automatically** when the server starts:

1. The server checks for DATABASE_URL environment variable
2. If set, it looks for migration files in the `./migrations` folder
3. If migrations exist, they are applied to the production database
4. If no migrations exist or they're already applied, the server starts normally
5. If migrations fail, the server will not start

You can see migration status in the server logs:
- `ℹ️  DATABASE_URL not set - skipping migrations` - No database configured
- `ℹ️  No migrations folder found - skipping migrations` - No migrations to run
- `ℹ️  No migration files found - skipping migrations` - Migrations folder is empty
- `Running database migrations...` - Migrations are being applied
- `✅ Migrations completed successfully` - Migrations applied successfully
- `❌ Migration failed` - Migration error (server will not start)

## Generating Migrations for Production

If you need to generate migration files for production:

1. **Ensure your development database is up to date:**
   ```bash
   npm run db:push
   ```

2. **Generate migration files using Drizzle Kit:**
   ```bash
   npx drizzle-kit generate
   ```
   This creates timestamped migration directories in `./migrations` folder

3. **Review the generated migration files** in `./migrations/NNNN_<name>/`
   - Each migration is in its own numbered directory
   - Contains SQL statements to apply schema changes

4. **Commit the migration files** to your repository

5. **On next deployment**, migrations will run automatically

## Migration File Structure

Drizzle Kit generates migrations in this format:
```
migrations/
├── 0000_initial/
│   ├── migration.sql
│   └── snapshot.json
├── 0001_add_gantt_link/
│   ├── migration.sql
│   └── snapshot.json
└── meta/
    └── _journal.json
```

The migration runner automatically finds and applies these in order.

## Current Status

✅ **Automatic migration system is active**
- Migration runner: `server/migrate.ts`
- Runs on every server startup (if DATABASE_URL is set)
- Gracefully handles missing DATABASE_URL
- Gracefully handles missing or empty migrations folder

## Troubleshooting

### Server won't start after deployment
- Check the server logs for migration errors
- Ensure DATABASE_URL is set in production environment
- Ensure all required columns and tables exist in production
- You may need to manually add missing columns via the Database pane

### Schema changes not reflecting in production
1. Make sure you've run `npm run db:push` in development
2. Generate migrations using `npx drizzle-kit generate`
3. Commit and deploy the new migration files
4. Redeploy your application

### Development and production databases out of sync
- Development: Use `npm run db:push` to sync (faster, no migration files)
- Production: Migrations run automatically on deployment
- Manual fix: Add missing columns via Database pane in Replit

### DATABASE_URL not set error
- **Development**: This is normal - server will skip migrations and start anyway
- **Production**: Set DATABASE_URL in your environment secrets
- The app can run without DATABASE_URL, but migrations won't execute

## Best Practices

1. **Always test schema changes in development first**
2. **Run `npm run db:push` after schema changes** to sync your dev database
3. **For production**, use `drizzle-kit generate` to create migrations before deploying
4. **Never manually edit production database** - use migrations or the Database pane
5. **Commit migration files** to version control before deploying
6. **Never change primary key ID types** - This breaks existing data and migrations

## Key Commands

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run db:push` | Sync dev DB directly | After schema changes in development |
| `npm run db:push --force` | Force sync dev DB | When normal push fails |
| `npx drizzle-kit generate` | Create migration files | Before production deployment |
| `npx drizzle-kit studio` | View database in browser | Inspect schema and data |

## Important Notes

- **Development uses `db:push`** - Fast, direct database updates (no migration files)
- **Production uses migrations** - Generated files applied automatically on deployment
- **Migration runner is non-blocking** - Server starts even if DATABASE_URL is missing
- **Drizzle handles migration order** - Migrations are applied in numerical order automatically
