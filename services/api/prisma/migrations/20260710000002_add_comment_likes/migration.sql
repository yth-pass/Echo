-- CreateTable: comment_likes（评论点赞，复合主键 comment_id + clone_id）
CREATE TABLE "comment_likes" (
    "comment_id" TEXT NOT NULL,
    "clone_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_likes_pkey" PRIMARY KEY ("comment_id", "clone_id")
);

-- CreateIndex: 按分身查询其点赞记录
CREATE INDEX "comment_likes_clone_id_idx" ON "comment_likes"("clone_id");

-- AddForeignKey: 评论删除时级联删除其点赞
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: 分身删除时级联删除其评论点赞
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_clone_id_fkey" FOREIGN KEY ("clone_id") REFERENCES "digital_clones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
