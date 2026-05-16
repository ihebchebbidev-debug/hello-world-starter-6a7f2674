-- 003 children + trips + tracking
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

CREATE TABLE child_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID REFERENCES children(id) ON DELETE CASCADE,
    route_id UUID REFERENCES routes(id),
    pickup_stop_id UUID REFERENCES route_stops(id),
    dropoff_stop_id UUID REFERENCES route_stops(id),
    created_at TIMESTAMP DEFAULT NOW()
);

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

CREATE TABLE stop_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES trips(id),
    stop_id UUID REFERENCES route_stops(id),
    arrival_time TIMESTAMP,
    departure_time TIMESTAMP,
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES trips(id),
    child_id UUID REFERENCES children(id),
    status VARCHAR(50),
    method VARCHAR(50),
    timestamp TIMESTAMP DEFAULT NOW()
);
