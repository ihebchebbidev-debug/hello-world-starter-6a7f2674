-- Best-effort revert. Removing TimescaleDB policies is safe; converting a
-- hypertable back to a plain table is destructive and intentionally not
-- automated here. If you truly need to roll back, dump gps_logs first.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'timescaledb'
  ) THEN
    PERFORM remove_retention_policy('gps_logs', if_exists => TRUE);
    PERFORM remove_compression_policy('gps_logs', if_exists => TRUE);
  END IF;
END
$$;