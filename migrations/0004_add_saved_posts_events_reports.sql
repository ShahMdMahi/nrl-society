-- Migration: 0004_add_saved_posts_events_reports
-- Add tables for saved posts, events, reports, and blocks

-- Saved Posts table
CREATE TABLE IF NOT EXISTS saved_posts (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    post_id TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

-- Unique index to prevent duplicate saves
CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_posts_unique ON saved_posts(user_id, post_id);
CREATE INDEX IF NOT EXISTS idx_saved_posts_user ON saved_posts(user_id, created_at);

-- Events table
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY NOT NULL,
    creator_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    cover_image_url TEXT,
    location TEXT,
    location_type TEXT DEFAULT 'in-person' CHECK(location_type IN ('in-person', 'online', 'hybrid')),
    event_url TEXT,
    start_date INTEGER NOT NULL,
    end_date INTEGER,
    is_public INTEGER DEFAULT 1,
    max_attendees INTEGER,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    updated_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_events_creator ON events(creator_id);
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_public ON events(is_public, start_date);

-- Event Attendees table
CREATE TABLE IF NOT EXISTS event_attendees (
    id TEXT PRIMARY KEY NOT NULL,
    event_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT DEFAULT 'going' CHECK(status IN ('going', 'interested', 'not_going')),
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_attendees_unique ON event_attendees(event_id, user_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_event ON event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_user ON event_attendees(user_id);

-- Reports table (for reporting users/posts/comments)
CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY NOT NULL,
    reporter_id TEXT NOT NULL,
    target_type TEXT NOT NULL CHECK(target_type IN ('user', 'post', 'comment', 'message', 'event')),
    target_id TEXT NOT NULL,
    reason TEXT NOT NULL CHECK(reason IN ('spam', 'harassment', 'hate_speech', 'violence', 'nudity', 'false_information', 'other')),
    description TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    reviewed_by TEXT,
    reviewed_at INTEGER,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);

-- Blocks table (user blocking)
CREATE TABLE IF NOT EXISTS blocks (
    id TEXT PRIMARY KEY NOT NULL,
    blocker_id TEXT NOT NULL,
    blocked_id TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_blocks_unique ON blocks(blocker_id, blocked_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks(blocked_id);

-- Hashtags table
CREATE TABLE IF NOT EXISTS hashtags (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE,
    post_count INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hashtags_name ON hashtags(name);
CREATE INDEX IF NOT EXISTS idx_hashtags_trending ON hashtags(post_count, created_at);

-- Post Hashtags junction table
CREATE TABLE IF NOT EXISTS post_hashtags (
    post_id TEXT NOT NULL,
    hashtag_id TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    PRIMARY KEY (post_id, hashtag_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (hashtag_id) REFERENCES hashtags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_post_hashtags_hashtag ON post_hashtags(hashtag_id);

-- Shares/Reposts table
CREATE TABLE IF NOT EXISTS shares (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    post_id TEXT NOT NULL,
    comment TEXT,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_shares_user ON shares(user_id);
CREATE INDEX IF NOT EXISTS idx_shares_post ON shares(post_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shares_unique ON shares(user_id, post_id);

-- User Follows table (for following without being friends)
CREATE TABLE IF NOT EXISTS follows (
    id TEXT PRIMARY KEY NOT NULL,
    follower_id TEXT NOT NULL,
    following_id TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_follows_unique ON follows(follower_id, following_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- Add follower counts to users
ALTER TABLE users ADD COLUMN followers_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN following_count INTEGER DEFAULT 0;
