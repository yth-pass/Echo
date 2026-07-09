-- AlterTable: Add nullable metadata_json to notifications for structured context
-- (e.g. comment-reply notifications carry actor name, reply content, quoted original comment)
ALTER TABLE "notifications" ADD COLUMN "metadata_json" JSONB;
