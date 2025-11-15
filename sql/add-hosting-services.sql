-- =====================================================
-- Tabulka pro aktivní hosting služby
-- Vytvoří se automaticky když je platba PAID
-- =====================================================

-- 1. Vytvoření tabulky pro aktivní hostingy
CREATE TABLE IF NOT EXISTS public.user_hosting_services (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id BIGINT NOT NULL REFERENCES public.user_orders(id) ON DELETE CASCADE,

  -- Informace o hostingu
  plan_name VARCHAR(100) NOT NULL,
  plan_id VARCHAR(50) NOT NULL,

  -- Status služby
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- možné stavy: pending, active, suspended, expired, cancelled

  -- Cena a platby
  price DECIMAL(10, 2) NOT NULL,
  billing_period VARCHAR(20) NOT NULL DEFAULT 'monthly',
  -- možné hodnoty: monthly, yearly, one-time

  -- Technické údaje
  disk_space INTEGER, -- v GB
  bandwidth INTEGER, -- v GB
  databases INTEGER,
  email_accounts INTEGER,
  domains INTEGER,

  -- FTP přístup (pokud je)
  ftp_host VARCHAR(255),
  ftp_username VARCHAR(100),
  ftp_password_encrypted TEXT,

  -- Databázové přístupy (pokud jsou)
  db_host VARCHAR(255),
  db_name VARCHAR(100),
  db_username VARCHAR(100),
  db_password_encrypted TEXT,

  -- Datumy
  activated_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  next_billing_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Poznámky
  notes TEXT,

  UNIQUE(order_id) -- Jedna objednávka = jedna služba
);

-- 2. RLS Policies
ALTER TABLE public.user_hosting_services ENABLE ROW LEVEL SECURITY;

-- Uživatelé vidí jen své služby
CREATE POLICY "Users can view own hosting services" ON public.user_hosting_services
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admini vidí všechny služby
CREATE POLICY "Admins can view all hosting services" ON public.user_hosting_services
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = TRUE
    )
  );

-- Admini můžou upravovat všechny služby
CREATE POLICY "Admins can update all hosting services" ON public.user_hosting_services
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = TRUE
    )
  );

-- 3. Funkce pro automatické vytvoření hosting služby po zaplacení
CREATE OR REPLACE FUNCTION public.create_hosting_service_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Pokud se status změnil na 'active' a payment_status je 'paid'
  IF NEW.status = 'active' AND NEW.payment_status = 'paid' AND OLD.status != 'active' THEN

    -- Zkontroluj jestli služba už neexistuje
    IF NOT EXISTS (
      SELECT 1 FROM public.user_hosting_services
      WHERE order_id = NEW.id
    ) THEN

      -- Vytvoř novou hosting službu
      INSERT INTO public.user_hosting_services (
        user_id,
        order_id,
        plan_name,
        plan_id,
        status,
        price,
        billing_period,
        activated_at,
        expires_at,
        next_billing_date
      ) VALUES (
        NEW.user_id,
        NEW.id,
        NEW.plan_name,
        NEW.plan_id,
        'active',
        NEW.price,
        'monthly', -- Předpokládám měsíční billing
        NOW(),
        NOW() + INTERVAL '30 days', -- Vyprší za 30 dní
        NOW() + INTERVAL '30 days'  -- Další platba za 30 dní
      );

      RAISE NOTICE 'Created hosting service for order %', NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger který spustí funkci při změně objednávky
DROP TRIGGER IF EXISTS trigger_create_hosting_service ON public.user_orders;
CREATE TRIGGER trigger_create_hosting_service
  AFTER UPDATE ON public.user_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.create_hosting_service_on_payment();

-- 5. Index pro rychlejší vyhledávání
CREATE INDEX IF NOT EXISTS idx_user_hosting_services_user_id ON public.user_hosting_services(user_id);
CREATE INDEX IF NOT EXISTS idx_user_hosting_services_status ON public.user_hosting_services(status);
CREATE INDEX IF NOT EXISTS idx_user_hosting_services_order_id ON public.user_hosting_services(order_id);

-- 6. Funkce pro získání aktivních služeb uživatele
CREATE OR REPLACE FUNCTION public.get_user_active_services(user_uuid UUID)
RETURNS TABLE (
  id BIGINT,
  plan_name VARCHAR(100),
  status VARCHAR(20),
  price DECIMAL(10, 2),
  activated_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  days_remaining INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.plan_name,
    s.status,
    s.price,
    s.activated_at,
    s.expires_at,
    EXTRACT(DAY FROM (s.expires_at - NOW()))::INTEGER AS days_remaining
  FROM public.user_hosting_services s
  WHERE s.user_id = user_uuid
  AND s.status IN ('active', 'pending')
  ORDER BY s.activated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Komentáře pro dokumentaci
COMMENT ON TABLE public.user_hosting_services IS 'Aktivní hosting služby uživatelů - vytvoří se automaticky po zaplacení objednávky';
COMMENT ON COLUMN public.user_hosting_services.status IS 'Status služby: pending, active, suspended, expired, cancelled';
COMMENT ON COLUMN public.user_hosting_services.billing_period IS 'Perioda platby: monthly, yearly, one-time';
COMMENT ON FUNCTION public.create_hosting_service_on_payment() IS 'Automaticky vytvoří hosting službu když je objednávka zaplacená (status=active, payment_status=paid)';

-- =====================================================
-- KONEC MIGRACE
-- =====================================================

-- Pro otestování můžeš spustit:
-- SELECT * FROM public.user_hosting_services;
-- SELECT * FROM public.get_user_active_services('user-uuid-here');
