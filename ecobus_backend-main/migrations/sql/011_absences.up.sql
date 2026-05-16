-- 011 child absences
CREATE TABLE IF NOT EXISTS child_absences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES users(id) ON DELETE SET NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason VARCHAR(50) NOT NULL DEFAULT 'other',
    note TEXT,
    cancelled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_absences_child ON child_absences(child_id);
CREATE INDEX IF NOT EXISTS idx_absences_org ON child_absences(organization_id);
CREATE INDEX IF NOT EXISTS idx_absences_dates ON child_absences(start_date, end_date);
