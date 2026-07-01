-- ============================================================================
-- Manual pgvector migration for Echo ProfileEmbedding
-- ============================================================================
-- Prisma does not natively support the pgvector type.  Run this SQL manually
-- against your PostgreSQL database AFTER creating the profile_embeddings table
-- via `npx prisma migrate dev` or `npx prisma db push`.
--
-- Prerequisites:
--   1. PostgreSQL 12+ with the pgvector extension available.
--   2. The profile_embeddings table already exists (created by Prisma with
--      the `embedding` column as JSON).
--
-- What this does:
--   1. Enable the pgvector extension.
--   2. Convert the existing JSON `embedding` column to `vector(1536)`.
--      Any existing JSON arrays are cast via text → vector.
--   3. Create an HNSW index for fast approximate nearest-neighbour search
--      (cosine similarity).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE profile_embeddings
  ALTER COLUMN embedding TYPE vector(1536)
  USING embedding::text::vector;

CREATE INDEX IF NOT EXISTS idx_profile_embeddings_hnsw
  ON profile_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 200);
