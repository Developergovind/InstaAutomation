-- Instagram Automation — initial schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  score NUMERIC DEFAULT 0,
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_trends_score ON trends (score DESC);
CREATE INDEX IF NOT EXISTS idx_trends_processed ON trends (processed, score DESC);
CREATE INDEX IF NOT EXISTS idx_trends_source ON trends (source);
CREATE INDEX IF NOT EXISTS idx_trends_created_at ON trends (created_at DESC);

CREATE TABLE IF NOT EXISTS generated_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trend_id UUID REFERENCES trends(id) ON DELETE SET NULL,
  hook TEXT,
  caption TEXT,
  hashtags TEXT,
  image_prompt TEXT,
  image_url TEXT,
  carousel_text TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generated_posts_trend ON generated_posts (trend_id);
CREATE INDEX IF NOT EXISTS idx_generated_posts_status ON generated_posts (status);

CREATE TABLE IF NOT EXISTS instagram_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_post_id UUID REFERENCES generated_posts(id) ON DELETE SET NULL,
  instagram_post_id TEXT,
  posted_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_instagram_posts_generated ON instagram_posts (generated_post_id);
CREATE INDEX IF NOT EXISTS idx_instagram_posts_ig_id ON instagram_posts (instagram_post_id);

CREATE TABLE IF NOT EXISTS analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instagram_post_id TEXT NOT NULL,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  engagement_rate NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_ig_post ON analytics (instagram_post_id);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics (created_at DESC);
