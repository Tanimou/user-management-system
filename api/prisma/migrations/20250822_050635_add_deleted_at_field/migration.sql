-- Add deletedAt column to users table
ALTER TABLE "users" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Create index on deletedAt for performance
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- Create composite index on isActive and deletedAt for filtering
CREATE INDEX "users_isActive_deletedAt_idx" ON "users"("isActive", "deletedAt");