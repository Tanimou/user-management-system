-- Drop foreign keys first
ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_actorId_fkey";

-- Drop indexes
DROP INDEX IF EXISTS "audit_logs_createdAt_idx";
DROP INDEX IF EXISTS "audit_logs_entity_entityId_idx";
DROP INDEX IF EXISTS "audit_logs_actorId_idx";
DROP INDEX IF EXISTS "users_createdAt_idx";
DROP INDEX IF EXISTS "users_isActive_idx";
DROP INDEX IF EXISTS "users_email_idx";
DROP INDEX IF EXISTS "users_email_key";

-- Drop tables
DROP TABLE IF EXISTS "audit_logs";
DROP TABLE IF EXISTS "users";