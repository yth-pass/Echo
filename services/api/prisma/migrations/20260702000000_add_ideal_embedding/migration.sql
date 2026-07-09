-- Add ideal_embedding column for dual-channel matching (A.ideal <-> B.self + B.ideal <-> A.self).
-- No HNSW index: ideal_embedding is loaded via primary key after top-K retrieval on self embedding.

ALTER TABLE profile_embeddings
  ADD COLUMN IF NOT EXISTS ideal_embedding vector(1536);
