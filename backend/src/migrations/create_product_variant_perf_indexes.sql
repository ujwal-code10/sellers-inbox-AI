-- Performance indexes for product setup and variant operations
-- Safe to run repeatedly

DO $$
BEGIN
  IF to_regclass('public.products') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id)';
  END IF;

  IF to_regclass('public.variants') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_variants_product_id ON variants(product_id)';
  END IF;

  IF to_regclass('public.subscriptions') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)';
  END IF;

  IF to_regclass('public.usage_daily') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_usage_daily_user_date ON usage_daily(user_id, date)';
  END IF;
END
$$;
