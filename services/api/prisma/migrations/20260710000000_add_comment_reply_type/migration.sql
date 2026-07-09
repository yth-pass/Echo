-- AlterType: Add new notification type for "my comment was replied to"
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction block.
-- Prisma runs this migration with `--transaction` disabled automatically when it detects ADD VALUE.
ALTER TYPE "NotificationType" ADD VALUE 'comment_reply';
