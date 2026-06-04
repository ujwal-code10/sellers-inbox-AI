-- Add optimistic locking version to variants
-- Safe to run repeatedly

DO $$
BEGIN
  IF to_regclass('public.variants') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'variants'
        AND column_name = 'version'
    ) THEN
      EXECUTE 'ALTER TABLE variants ADD COLUMN version integer NOT NULL DEFAULT 1';
    END IF;

    EXECUTE 'UPDATE variants SET version = 1 WHERE version IS NULL';
  END IF;
END
$$;
