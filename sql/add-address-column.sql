-- Přidání sloupce address do tabulky profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS address TEXT;

-- Přidání sloupců customer_email a customer_name do user_orders
-- (pro kompatibilitu s kódem, který je používá)
ALTER TABLE public.user_orders
ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);

ALTER TABLE public.user_orders
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(200);

-- Vytvoření indexů pro rychlejší vyhledávání
CREATE INDEX IF NOT EXISTS user_orders_customer_email_idx ON public.user_orders(customer_email);

-- Úprava RLS políčka pro povolení objednávek i pro nepřihlášené uživatele
DROP POLICY IF EXISTS "Users can insert own orders" ON public.user_orders;

CREATE POLICY "Users can insert own orders"
  ON public.user_orders FOR INSERT
  WITH CHECK (
    auth.uid() = user_id OR              -- Přihlášený uživatel vytváří svou objednávku
    (auth.uid() IS NULL AND user_id IS NULL) OR  -- Nepřihlášený uživatel
    user_id IS NULL                      -- Objednávka bez user_id (pro nepřihlášené)
  );
