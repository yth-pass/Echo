-- Echo Database Initialization
-- This runs automatically when PostgreSQL container starts for the first time.

-- Enable pgvector extension (required for AI embeddings)
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable uuid generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Verify extensions
SELECT extname, extversion FROM pg_extension WHERE extname IN ('vector', 'uuid-ossp');
