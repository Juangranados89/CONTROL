#!/bin/bash
set -e

echo "🚀 Starting Render Build Process..."

# 1. Switch Prisma provider to PostgreSQL for Production
echo "🔄 Switching Prisma provider to PostgreSQL..."
sed -i 's/provider = "sqlite"/provider = "postgresql"/g' prisma/schema.prisma

# 2. Install dependencies
echo "📦 Installing dependencies..."
npm install

# 3. Generate Prisma Client
echo "✨ Generating Prisma Client..."
npx prisma generate

# 4. Push Schema to Database
# We use db push instead of migrate deploy because we are switching providers
# and don't have Postgres-compatible migration files generated.
echo "🗄️ Pushing schema to database..."
npx prisma db push --accept-data-loss

echo "✅ Build completed successfully!"
