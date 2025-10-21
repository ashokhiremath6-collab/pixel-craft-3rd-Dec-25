#!/bin/bash
# Script to copy catalogue_items from development to production database

echo "🔄 Copying catalogue items from development to production..."

# Get the production DATABASE_URL (you'll need to get this from production env)
# For now, this script will run in dev and connect to production

# First, export the data from dev database
echo "📤 Exporting from development database..."
psql $DATABASE_URL -c "\COPY (SELECT * FROM catalogue_items) TO '/tmp/catalogue_export.csv' WITH CSV HEADER;"

echo "✅ Exported $(wc -l < /tmp/catalogue_export.csv) rows"
echo ""
echo "📋 To import to production, you need to:"
echo "1. Download this file: /tmp/catalogue_export.csv"
echo "2. Go to Database pane → Production Database → SQL console"
echo "3. Run this command:"
echo ""
echo "   \COPY catalogue_items FROM '/path/to/catalogue_export.csv' WITH CSV HEADER;"
echo ""
echo "Or use the Database Studio 'Import CSV' feature."
