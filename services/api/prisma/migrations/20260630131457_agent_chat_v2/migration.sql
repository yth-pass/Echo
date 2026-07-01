/*
  Warnings:

  - A unique constraint covering the columns `[session_id,turn_index,bubble_index]` on the table `agent_messages` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "AgentSessionStatus" ADD VALUE 'wind_down';

-- DropIndex
DROP INDEX "agent_messages_turn_id_key";

-- AlterTable
ALTER TABLE "agent_messages" ADD COLUMN     "bubble_index" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "delay_ms" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "agent_sessions" ADD COLUMN     "daily_turn_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "daily_turn_date" TIMESTAMP(3),
ADD COLUMN     "wind_down_at" TIMESTAMP(3),
ADD COLUMN     "wind_down_by" TEXT,
ADD COLUMN     "wind_down_reason" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "agent_messages_session_id_turn_index_bubble_index_key" ON "agent_messages"("session_id", "turn_index", "bubble_index");
