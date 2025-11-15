-- =====================================================
-- Rozšíření user_hosting_services o HestiaCP integraci
-- Přidá sloupce pro automatické vytváření hosting účtů
-- =====================================================

-- 1. Přidání HestiaCP sloupců do user_hosting_services
ALTER TABLE public.user_hosting_services
ADD COLUMN IF NOT EXISTS hestia_username VARCHAR(50),
ADD COLUMN IF NOT EXISTS hestia_domain VARCHAR(255),
ADD COLUMN IF NOT EXISTS hestia_package VARCHAR(50),
ADD COLUMN IF NOT EXISTS hestia_created BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS hestia_created_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS hestia_error TEXT,
ADD COLUMN IF NOT EXISTS cpanel_url VARCHAR(500);

-- 2. Index pro rychlejší vyhledávání podle HestiaCP username
CREATE INDEX IF NOT EXISTS idx_user_hosting_services_hestia_username
ON public.user_hosting_services(hestia_username);

-- 3. Index pro vyhledávání podle domény
CREATE INDEX IF NOT EXISTS idx_user_hosting_services_hestia_domain
ON public.user_hosting_services(hestia_domain);

-- 4. Komentáře pro dokumentaci
COMMENT ON COLUMN public.user_hosting_services.hestia_username IS 'HestiaCP uživatelské jméno (generované automaticky)';
COMMENT ON COLUMN public.user_hosting_services.hestia_domain IS 'Primární doména v HestiaCP';
COMMENT ON COLUMN public.user_hosting_services.hestia_package IS 'HestiaCP balíček (např. basic, standard, pro)';
COMMENT ON COLUMN public.user_hosting_services.hestia_created IS 'Zda byl HestiaCP účet úspěšně vytvořen';
COMMENT ON COLUMN public.user_hosting_services.hestia_created_at IS 'Datum vytvoření HestiaCP účtu';
COMMENT ON COLUMN public.user_hosting_services.hestia_error IS 'Chybová zpráva pokud se nepodařilo vytvořit účet';
COMMENT ON COLUMN public.user_hosting_services.cpanel_url IS 'URL pro přístup do control panelu';

-- 5. Přidání sloupců do user_orders pro tracking HestiaCP statusu
ALTER TABLE public.user_orders
ADD COLUMN IF NOT EXISTS payment_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS payment_url TEXT,
ADD COLUMN IF NOT EXISTS gopay_status VARCHAR(50);

-- 6. Index pro rychlejší vyhledávání podle payment_id
CREATE INDEX IF NOT EXISTS idx_user_orders_payment_id
ON public.user_orders(payment_id);

COMMENT ON COLUMN public.user_orders.payment_id IS 'GoPay payment ID';
COMMENT ON COLUMN public.user_orders.payment_url IS 'GoPay platební URL';
COMMENT ON COLUMN public.user_orders.gopay_status IS 'GoPay status platby (CREATED, PAID, CANCELED, atd.)';

-- =====================================================
-- KONEC MIGRACE
-- =====================================================

-- Pro otestování:
-- SELECT * FROM public.user_hosting_services WHERE hestia_created = TRUE;
-- SELECT * FROM public.user_orders WHERE payment_status = 'paid';
