-- Optional: convert gps_logs to a TimescaleDB hypertable.
--
-- Run this migration ONLY on a Postgres instance with the timescaledb
-- extension available. If timescaledb is not installed the DO block is a
-- no-op and the existing plain table continues to work; the in-memory
-- batcher (src/services/gpsBatcher.js) gives the next-best write path.
--
-- Recommended retention for school-bus GPS: 90 days raw, then continuous
-- aggregates for trip replays. Tweak chunk_time_interval to match write
-- volume (1 day per chunk ≈ a few million rows per chunk at 50 buses).
--
-- IMPORTANT: TimescaleDB requires every UNIQUE index on a hypertable to
-- include the partitioning column. The original `gps_logs` table was
-- created with `id BIGSERIAL PRIMARY KEY`, which is a unique index on
-- `id` alone. Before calling create_hypertable() we therefore drop that
-- PK and recreate it as a composite key (id, recorded_at). The id column
-- stays unique on its own in practice (driven by a sequence), but the
-- physical PK index now satisfies Timescale's partitioning rule.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_available_extensions WHERE name = 'timescaledb'
  ) THEN
    CREATE EXTENSION IF NOT EXISTS timescaledb;

    -- Skip if already a hypertable
    IF NOT EXISTS (
      SELECT 1 FROM timescaledb_information.hypertables
      WHERE hypertable_name = 'gps_logs'
    ) THEN
      -- Repartition the primary key to include recorded_at so Timescale
      -- accepts it. Safe to re-run: we only drop/recreate when needed.
      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.gps_logs'::regclass
          AND contype  = 'p'
          AND conname  = 'gps_logs_pkey'
      ) AND NOT EXISTS (
        SELECT 1
        FROM pg_index i
        JOIN pg_class c ON c.oid = i.indexrelid
        JOIN pg_attribute a ON a.attrelid = i.indrelid
                           AND a.attnum = ANY(i.indkey)
        WHERE c.relname = 'gps_logs_pkey'
          AND a.attname = 'recorded_at'
      ) THEN
        ALTER TABLE public.gps_logs DROP CONSTRAINT gps_logs_pkey;
        ALTER TABLE public.gps_logs
          ADD CONSTRAINT gps_logs_pkey PRIMARY KEY (id, recorded_at);
      END IF;

      PERFORM create_hypertable(
        'gps_logs', 'recorded_at',
        chunk_time_interval => INTERVAL '1 day',
        migrate_data        => TRUE,
        if_not_exists       => TRUE
      );
    END IF;

    -- Compression + retention policies require the TimescaleDB Community
    -- (TSL) license. Apache-only builds expose the functions but throw
    -- "is not supported under the current 'apache' license" when called.
    -- Detect the active license and skip gracefully so the migration works
    -- on both editions.
    DECLARE
      ts_license TEXT;
    BEGIN
      SELECT current_setting('timescaledb.license', TRUE) INTO ts_license;

      IF ts_license IS NOT NULL AND lower(ts_license) IN ('timescale', 'tsl', 'community') THEN
        -- Compress chunks older than 7 days for ~10x storage reduction.
        PERFORM add_compression_policy('gps_logs', INTERVAL '7 days', if_not_exists => TRUE);

        -- Drop chunks older than 90 days. Adjust as needed for compliance.
        PERFORM add_retention_policy('gps_logs', INTERVAL '90 days', if_not_exists => TRUE);
      ELSE
        RAISE NOTICE 'TimescaleDB Apache license detected — skipping compression/retention policies (TSL feature)';
      END IF;
    EXCEPTION WHEN feature_not_supported OR insufficient_privilege OR undefined_function THEN
      RAISE NOTICE 'Skipping TimescaleDB compression/retention policies: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'timescaledb extension not available — gps_logs stays a plain table';
  END IF;
END
$$;
