# Database Migration Guide

## Overview

This project uses **Drizzle ORM** with automatic migrations for production deployments. The migration system runs automatically when the server starts, ensuring your production database stays in sync with your schema.

## How It Works

### Development Workflow

When developing locally and making schema changes:

1. **Update your schema** in `shared/schema.ts`
2. **Sync the development database** by running:
   ```bash
   npm run db:push
   ```
   This directly updates your development database to match your schema.

### Production Deployment Workflow

For production deployments, migrations run **automatically** when the server starts:

1. The server checks for migration files in the `./migrations` folder
2. If migrations exist, they are applied to the production database
3. If no migrations exist or they're already applied, the server starts normally

You can see migration status in the server logs:
- `ℹ️  No migration files found - skipping migrations` - No migrations to run
- `Running database migrations...` - Migrations are being applied
- `✅ Migrations completed successfully` - Migrations applied successfully
- `❌ Migration failed` - Migration error (server will not start)

## Manual Migration Generation (Advanced)

If you need to generate migration files manually for production:

1. Ensure your development database is up to date:
   ```bash
   npm run db:push
   ```

2. Generate migration files:
   ```bash
   npx drizzle-kit generate
   ```

3. Review the generated SQL files in `./migrations`

4. Commit the migration files to your repository

5. On next deployment, migrations will run automatically

## Current Status

✅ **Automatic migration system is active**
- Migration runner: `server/migrate.ts`
- Runs on every server startup
- Gracefully handles missing or empty migrations folder

## Troubleshooting

### Server won't start after deployment
- Check the server logs for migration errors
- Ensure all required columns and tables exist in production
- You may need to manually add missing columns via the Database pane

### Schema changes not reflecting in production
1. Make sure you've run `npm run db:push` in development
2. Generate migrations using `npx drizzle-kit generate`
3. Commit and deploy the new migration files
4. Redeploy your application

### Development and production databases out of sync
- Development: Use `npm run db:push` to sync
- Production: Migrations run automatically on deployment
- Manual fix: Add missing columns via Database pane in Replit

## Best Practices

1. **Always test schema changes in development first**
2. **Run `npm run db:push` after schema changes** to sync your dev database
3. **For production**, the migration system handles everything automatically
4. **Never manually edit production database** - use migrations or the Database pane
5. **Commit migration files** to version control before deploying
