-- 005 analytics
CREATE TABLE visitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    ip_address VARCHAR(100),
    user_agent TEXT,
    country VARCHAR(100),
    city VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_id UUID REFERENCES visitors(id),
    started_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP,
    device_type VARCHAR(50),
    platform VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE page_views (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID REFERENCES sessions(id),
    page VARCHAR(255),
    title VARCHAR(255),
    duration INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_page_views_session ON page_views(session_id);

CREATE TABLE events (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID REFERENCES sessions(id),
    user_id UUID REFERENCES users(id),
    event_type VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_events_user ON events(user_id);
