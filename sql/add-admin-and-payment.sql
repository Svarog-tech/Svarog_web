-- Přidání admin pole do profiles tabulky
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Přidání payment polí do user_orders pro GoPay integraci
ALTER TABLE public.user_orders
ADD COLUMN IF NOT EXISTS payment_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_url TEXT,
ADD COLUMN IF NOT EXISTS gopay_status VARCHAR(50);

-- Index pro rychlé vyhledávání adminů
CREATE INDEX IF NOT EXISTS profiles_is_admin_idx ON public.profiles(is_admin) WHERE is_admin = TRUE;

-- Index pro payment_id
CREATE INDEX IF NOT EXISTS user_orders_payment_id_idx ON public.user_orders(payment_id);

-- Nastavení prvního admina (změň email na svůj)
-- UPDATE public.profiles SET is_admin = TRUE WHERE email = 'tvuj-admin@email.cz';

-- Funkce pro kontrolu, zda je uživatel admin
CREATE OR REPLACE FUNCTION public.is_user_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND is_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policy pro adminy - mohou vidět všechny profily
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    is_admin = TRUE AND auth.uid() IN (
      SELECT id FROM public.profiles WHERE is_admin = TRUE
    )
  );
