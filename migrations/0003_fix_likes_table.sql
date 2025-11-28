-- Fix likes table to match Drizzle schema
-- Migration: 0003_fix_likes_table

-- Drop the old likes table
DROP TABLE IF EXISTS likes;

-- Create likes table with polymorphic design
CREATE TABLE likes (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for likes
CREATE INDEX idx_likes_target ON likes(target_type, target_id);
CREATE UNIQUE INDEX idx_likes_unique ON likes(user_id, target_type, target_id);
