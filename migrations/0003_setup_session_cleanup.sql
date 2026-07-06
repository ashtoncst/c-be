-- migrations/0003_setup_session_cleanup.sql

-- Drop existing function if it exists (to avoid conflicts)
DROP FUNCTION IF EXISTS cleanup_expired_sessions();

-- Create cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
  idle_cutoff TIMESTAMP;
  absolute_cutoff TIMESTAMP;
BEGIN
  idle_cutoff := NOW() - INTERVAL '30 minutes';
  absolute_cutoff := NOW() - INTERVAL '4 hours';
  
  DELETE FROM chat_sessions
  WHERE last_activity_at < idle_cutoff
     OR created_at < absolute_cutoff;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Create logging table if it doesn't exist
  CREATE TABLE IF NOT EXISTS session_cleanup_logs (
    id SERIAL PRIMARY KEY,
    deleted_count INTEGER NOT NULL,
    idle_cutoff TIMESTAMP NOT NULL,
    absolute_cutoff TIMESTAMP NOT NULL,
    executed_at TIMESTAMP DEFAULT NOW()
  );

  INSERT INTO session_cleanup_logs (deleted_count, idle_cutoff, absolute_cutoff)
  VALUES (deleted_count, idle_cutoff, absolute_cutoff);

  RAISE NOTICE 'Cleaned up % expired sessions', deleted_count;
END;
$$;

-- NOTE: pg_cron setup for AWS RDS
-- To enable pg_cron on AWS RDS:
-- 1. Add pg_cron to shared_preload_libraries in your DB parameter group
-- 2. Restart the database
-- 3. Run: CREATE EXTENSION pg_cron;
-- 4. Run the schedule command below

-- Check if pg_cron is available
DO $migration$
BEGIN
  -- Try to create pg_cron extension
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      CREATE EXTENSION pg_cron;
      RAISE NOTICE 'pg_cron extension created successfully';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'pg_cron extension not available. To enable it:';
      RAISE WARNING '1. In AWS RDS Console, modify your DB parameter group';
      RAISE WARNING '2. Add "pg_cron" to shared_preload_libraries parameter';
      RAISE WARNING '3. Set cron.database_name to "converge_staging_db"';
      RAISE WARNING '4. Reboot the database instance';
      RAISE WARNING '5. Then run: CREATE EXTENSION pg_cron;';
      RAISE WARNING 'For now, the cleanup function is created but not scheduled.';
    END;
  END IF;
END $migration$;

-- Schedule job to run hourly at :05 (only if pg_cron is available)
DO $schedule$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove existing job if it exists
    PERFORM cron.unschedule('cleanup-expired-chat-sessions');
    
    -- Schedule new job
    PERFORM cron.schedule(
      'cleanup-expired-chat-sessions',
      '5 * * * *',
      'SELECT cleanup_expired_sessions();'
    );
    
    RAISE NOTICE 'Cron job scheduled successfully';
  ELSE
    RAISE NOTICE 'pg_cron not available - skipping job scheduling';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not schedule cron job: %', SQLERRM;
END $schedule$;

-- Verification query (manual)
-- SELECT * FROM cron.job;

