-- =====================================================
-- EcoBus V2 - FULL PRODUCTION SCHEMA (PostgreSQL)
-- =====================================================

-- ========================
-- EXTENSIONS
-- ========================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================
-- ORGANIZATIONS
-- ========================
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    subscription_plan VARCHAR(50),
    subscription_status VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);
CREATE INDEX idx_org_active ON organizations(subscription_status);

-- ========================
-- USERS
-- ========================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(50),
    password_hash TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);
CREATE INDEX idx_users_org ON users(organization_id);

-- ========================
-- RBAC
-- ========================
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- ========================
-- BUSES
-- ========================
CREATE TABLE buses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100),
    plate_number VARCHAR(50),
    capacity INTEGER,
    status VARCHAR(50) DEFAULT 'inactive',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);
CREATE INDEX idx_buses_org ON buses(organization_id);

-- ========================
-- ROUTES
-- ========================
CREATE TABLE routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_routes_org ON routes(organization_id);

-- ========================
-- ROUTE STOPS
-- ========================
CREATE TABLE route_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
    name VARCHAR(100),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    stop_order INTEGER NOT NULL,
    planned_time TIME,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_route_stops_order ON route_stops(route_id, stop_order);

-- ========================
-- ROUTE ASSIGNMENTS
-- ========================
CREATE TABLE route_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    route_id UUID REFERENCES routes(id),
    bus_id UUID REFERENCES buses(id),
    driver_id UUID REFERENCES users(id),
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_assignments_active ON route_assignments(is_active);

-- ========================
-- CHILDREN
-- ========================
CREATE TABLE children (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    date_of_birth DATE,
    parent_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- ========================
-- CHILD ROUTES
-- ========================
CREATE TABLE child_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID REFERENCES children(id) ON DELETE CASCADE,
    route_id UUID REFERENCES routes(id),
    pickup_stop_id UUID REFERENCES route_stops(id),
    dropoff_stop_id UUID REFERENCES route_stops(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ========================
-- TRIPS
-- ========================
CREATE TABLE trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    route_id UUID REFERENCES routes(id),
    assignment_id UUID REFERENCES route_assignments(id),
    status VARCHAR(50),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_trips_active ON trips(status);

-- ========================
-- REAL-TIME STATUS
-- ========================
CREATE TABLE bus_live_status (
    bus_id UUID PRIMARY KEY REFERENCES buses(id),
    trip_id UUID REFERENCES trips(id),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    accuracy DOUBLE PRECISION,
    battery_level INTEGER,
    gps_status VARCHAR(20),
    last_update TIMESTAMP,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ========================
-- GPS LOGS (HEAVY TABLE)
-- ========================
CREATE TABLE gps_logs (
    id BIGSERIAL PRIMARY KEY,
    trip_id UUID REFERENCES trips(id),
    bus_id UUID REFERENCES buses(id),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    speed DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    accuracy DOUBLE PRECISION,
    battery_level INTEGER,
    recorded_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_gps_trip_time ON gps_logs(trip_id, recorded_at DESC);
CREATE INDEX idx_gps_bus_time ON gps_logs(bus_id, recorded_at DESC);

-- ========================
-- STOP EVENTS
-- ========================
CREATE TABLE stop_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES trips(id),
    stop_id UUID REFERENCES route_stops(id),
    arrival_time TIMESTAMP,
    departure_time TIMESTAMP,
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ========================
-- CHECKINS
-- ========================
CREATE TABLE checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES trips(id),
    child_id UUID REFERENCES children(id),
    status VARCHAR(50),
    method VARCHAR(50),
    timestamp TIMESTAMP DEFAULT NOW()
);

-- ========================
-- NOTIFICATIONS
-- ========================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    title VARCHAR(255),
    message TEXT,
    type VARCHAR(50),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ========================
-- DEVICE TOKENS
-- ========================
CREATE TABLE device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    token TEXT NOT NULL,
    platform VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ========================
-- SOS ALERTS
-- ========================
CREATE TABLE sos_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    trip_id UUID REFERENCES trips(id),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);

-- ========================
-- ALERTS
-- ========================
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    type VARCHAR(50),
    severity VARCHAR(20),
    bus_id UUID REFERENCES buses(id),
    trip_id UUID REFERENCES trips(id),
    message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ========================
-- GEOFENCES
-- ========================
CREATE TABLE geofences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    name VARCHAR(100),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    radius INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- ANALYTICS SYSTEM
-- =====================================================
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

-- =====================================================
-- END
-- =====================================================
