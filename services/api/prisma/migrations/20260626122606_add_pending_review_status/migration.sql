-- CreateEnum
CREATE TYPE "HandoffDecision" AS ENUM ('accept', 'decline');

-- AlterEnum
ALTER TYPE "ModerationStatus" ADD VALUE 'pending_review';

-- AlterTable
ALTER TABLE "affection_states" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "agent_sessions" ADD COLUMN     "metadata_json" JSONB;

-- AlterTable
ALTER TABLE "handoffs" ADD COLUMN     "contact_info_json" JSONB;

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "style_md" TEXT;

-- CreateTable
CREATE TABLE "handoff_responses" (
    "id" TEXT NOT NULL,
    "handoff_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "decision" "HandoffDecision" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "handoff_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'android',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "handoff_responses_handoff_id_user_id_key" ON "handoff_responses"("handoff_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_user_id_token_key" ON "device_tokens"("user_id", "token");

-- AddForeignKey
ALTER TABLE "handoff_responses" ADD CONSTRAINT "handoff_responses_handoff_id_fkey" FOREIGN KEY ("handoff_id") REFERENCES "handoffs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
