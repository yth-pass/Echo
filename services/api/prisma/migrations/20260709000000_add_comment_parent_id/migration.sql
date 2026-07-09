-- AlterTable: Add nullable parent_id to comments for nested replies
ALTER TABLE "comments" ADD COLUMN "parent_id" TEXT;

-- CreateIndex: Speed up queries for child comments of a parent
CREATE INDEX "comments_parent_id_idx" ON "comments"("parent_id");

-- AddForeignKey: Self-referential relation, CASCADE delete so removing a comment removes its replies
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
