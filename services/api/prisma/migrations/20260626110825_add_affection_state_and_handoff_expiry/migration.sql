-- 【步骤1修复】AffectionState per-pair 模型 + Handoff.expiresAt + 枚举扩展
-- 由 prisma migrate dev --name add_affection_state_and_handoff_expiry 生成（DB 不可达时手动创建）

-- AlterEnum: HandoffStatus 增加 'expired'
ALTER TYPE "HandoffStatus" ADD VALUE 'expired';

-- AlterEnum: MatchPushStatus 增加 'bridged'
ALTER TYPE "MatchPushStatus" ADD VALUE 'bridged';

-- CreateTable: AffectionState（per-pair，userAId < userBId 字典序约定由应用层保证）
-- 列 user_a_id/user_b_id 为普通字符串键（不设 FK），存储调用方传入的 ID（当前为 clone id）
CREATE TABLE "affection_states" (
    "user_a_id" TEXT NOT NULL,
    "user_b_id" TEXT NOT NULL,
    "familiarity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "warmth" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trust" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tension" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "relationship_label" TEXT NOT NULL DEFAULT 'stranger',
    "last_interaction_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affection_states_pkey" PRIMARY KEY ("user_a_id", "user_b_id")
);

-- AddColumn: Handoff.expiresAt（超时字段，创建时设为 now + 7 days）
ALTER TABLE "handoffs" ADD COLUMN "expires_at" TIMESTAMP(3);
