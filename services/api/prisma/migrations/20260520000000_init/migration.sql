-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended');
CREATE TYPE "CloneStatus" AS ENUM ('draft', 'active', 'paused', 'retired');
CREATE TYPE "ModerationStatus" AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE "AgentSessionStatus" AS ENUM ('active', 'completed', 'cancelled');
CREATE TYPE "HandoffStatus" AS ENUM ('pending', 'accepted', 'declined');
CREATE TYPE "MatchPushStatus" AS ENUM ('pending', 'dismissed', 'accepted');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "password_hash" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profiles" (
    "user_id" TEXT NOT NULL,
    "display_name" TEXT,
    "birth_year" INTEGER,
    "gender" TEXT,
    "orientation" TEXT,
    "city" TEXT,
    "bio_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "profile_embeddings" (
    "user_id" TEXT NOT NULL,
    "embedding" JSONB NOT NULL,
    CONSTRAINT "profile_embeddings_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "digital_clones" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "CloneStatus" NOT NULL DEFAULT 'draft',
    "consent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "digital_clones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "persona_prompts" (
    "id" TEXT NOT NULL,
    "clone_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "prompt_text" TEXT NOT NULL,
    "boundaries_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "persona_prompts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "clone_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "moderation_status" "ModerationStatus" NOT NULL DEFAULT 'pending',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "clone_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "likes" (
    "post_id" TEXT NOT NULL,
    "clone_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "likes_pkey" PRIMARY KEY ("post_id","clone_id")
);

CREATE TABLE "agent_sessions" (
    "id" TEXT NOT NULL,
    "clone_a_id" TEXT NOT NULL,
    "clone_b_id" TEXT NOT NULL,
    "status" "AgentSessionStatus" NOT NULL DEFAULT 'active',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    CONSTRAINT "agent_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_messages" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "speaker_clone_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "turn_index" INTEGER NOT NULL,
    "turn_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "affinity_scores" (
    "session_id" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "breakdown_json" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "affinity_scores_pkey" PRIMARY KEY ("session_id")
);

CREATE TABLE "handoffs" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_a_id" TEXT NOT NULL,
    "user_b_id" TEXT NOT NULL,
    "status" "HandoffStatus" NOT NULL DEFAULT 'pending',
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "handoffs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "match_pushes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "candidate_user_id" TEXT NOT NULL,
    "status" "MatchPushStatus" NOT NULL DEFAULT 'pending',
    "affinity" DOUBLE PRECISION,
    "pushed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "match_pushes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "blocks" (
    "blocker_user_id" TEXT NOT NULL,
    "blocked_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "blocks_pkey" PRIMARY KEY ("blocker_user_id","blocked_user_id")
);

CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "clone_id" TEXT,
    "event_type" TEXT NOT NULL,
    "reference_id" TEXT,
    "summary_zh" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "reporter_id" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "onboarding_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "survey_json" JSONB,
    "dialogue_json" JSONB,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "onboarding_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "digital_clones_user_id_key" ON "digital_clones"("user_id");
CREATE UNIQUE INDEX "persona_prompts_clone_id_key" ON "persona_prompts"("clone_id");
CREATE UNIQUE INDEX "agent_messages_turn_id_key" ON "agent_messages"("turn_id");
CREATE UNIQUE INDEX "handoffs_session_id_key" ON "handoffs"("session_id");
CREATE INDEX "agent_messages_session_id_turn_index_idx" ON "agent_messages"("session_id", "turn_index");
CREATE INDEX "audit_events_user_id_created_at_idx" ON "audit_events"("user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profile_embeddings" ADD CONSTRAINT "profile_embeddings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "digital_clones" ADD CONSTRAINT "digital_clones_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "persona_prompts" ADD CONSTRAINT "persona_prompts_clone_id_fkey" FOREIGN KEY ("clone_id") REFERENCES "digital_clones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "posts" ADD CONSTRAINT "posts_clone_id_fkey" FOREIGN KEY ("clone_id") REFERENCES "digital_clones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_clone_id_fkey" FOREIGN KEY ("clone_id") REFERENCES "digital_clones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "likes" ADD CONSTRAINT "likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "likes" ADD CONSTRAINT "likes_clone_id_fkey" FOREIGN KEY ("clone_id") REFERENCES "digital_clones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "agent_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "affinity_scores" ADD CONSTRAINT "affinity_scores_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "agent_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "handoffs" ADD CONSTRAINT "handoffs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "agent_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_pushes" ADD CONSTRAINT "match_pushes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_user_id_fkey" FOREIGN KEY ("blocker_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_user_id_fkey" FOREIGN KEY ("blocked_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_clone_id_fkey" FOREIGN KEY ("clone_id") REFERENCES "digital_clones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
