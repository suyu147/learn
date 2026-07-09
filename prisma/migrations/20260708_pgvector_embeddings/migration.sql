-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Convert embedding column from JSON to vector(1536)
-- Step 1: Add a temporary vector column
ALTER TABLE dt_document_chunks ADD COLUMN embedding_vec vector(1536);

-- Step 2: Migrate existing JSON data to vector format
-- Converts JSON arrays like [0.1, 0.2, ...] to vector type
UPDATE dt_document_chunks
SET embedding_vec = (embedding::text)::vector
WHERE embedding IS NOT NULL;

-- Step 3: Drop the old JSON column
ALTER TABLE dt_document_chunks DROP COLUMN embedding;

-- Step 4: Rename the new column to match Prisma's expected name
ALTER TABLE dt_document_chunks RENAME COLUMN embedding_vec TO embedding;

-- Step 5: Create HNSW index for efficient cosine similarity search
CREATE INDEX IF NOT EXISTS dt_document_chunks_embedding_idx
  ON dt_document_chunks
  USING hnsw (embedding vector_cosine_ops);
