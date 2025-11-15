-- Alatyr Hosting - SQL Schema pro Authentication System
-- Tento script vytvoří všechny potřebné tabulky a nastavení pro login/registraci

-- 1. Vytvoření tabulky profiles (rozšíření Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  full_name VARCHAR(200) GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  avatar_url TEXT,
  phone VARCHAR(20),
  company VARCHAR(200),

  -- OAuth provider info
  provider VARCHAR(50) DEFAULT 'email', -- 'email', 'google', 'github'
  provider_id VARCHAR(255),

  -- Account settings
  email_verified BOOLEAN DEFAULT FALSE,
  newsletter_subscription BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- 2. Nastavení RLS (Row Level Security)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies pro přístup k profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 3. Trigger pro automatické vytvoření profilu po registraci
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    provider,
    email_verified
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.app_metadata->>'provider', 'email'),
    COALESCE(NEW.email_confirmed_at IS NOT NULL, FALSE)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger, který se spustí při vytvoření nového uživatele
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Trigger pro aktualizaci updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5. Funkce pro aktualizaci last_login
CREATE OR REPLACE FUNCTION public.update_last_login(user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET last_login = NOW()
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Tabulka pro hosting objednávky (rozšíření existující orders tabulky)
CREATE TABLE IF NOT EXISTS public.user_orders (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id VARCHAR(50) NOT NULL,
  plan_name VARCHAR(200) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'CZK',

  -- Billing info
  billing_email VARCHAR(255),
  billing_name VARCHAR(200),
  billing_company VARCHAR(200),
  billing_address TEXT,
  billing_phone VARCHAR(20),

  -- Order status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'active', 'cancelled', 'expired')),
  payment_status VARCHAR(20) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded', 'failed')),

  -- Service details
  domain_name VARCHAR(255),
  service_start_date DATE,
  service_end_date DATE,
  auto_renewal BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Payment details
  payment_method VARCHAR(50),
  transaction_id VARCHAR(255),
  payment_date TIMESTAMP WITH TIME ZONE,

  -- Notes
  notes TEXT
);

-- RLS pro user_orders
ALTER TABLE public.user_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own orders"
  ON public.user_orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own orders"
  ON public.user_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins mohou vidět všechny objednávky
CREATE POLICY "Admins can view all orders"
  ON public.user_orders FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (email = 'admin@alatyr.cz' OR email LIKE '%@alatyr.cz')
    )
  );

-- 7. Trigger pro user_orders updated_at
CREATE OR REPLACE TRIGGER user_orders_updated_at
  BEFORE UPDATE ON public.user_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 8. Tabulka pro support tikety
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category VARCHAR(50) DEFAULT 'general',

  -- Support agent
  assigned_to UUID REFERENCES public.profiles(id),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tickets"
  ON public.support_tickets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create tickets"
  ON public.support_tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 9. Vytvoření indexů pro lepší výkon
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);
CREATE INDEX IF NOT EXISTS profiles_provider_idx ON public.profiles(provider);
CREATE INDEX IF NOT EXISTS user_orders_user_id_idx ON public.user_orders(user_id);
CREATE INDEX IF NOT EXISTS user_orders_status_idx ON public.user_orders(status);
CREATE INDEX IF NOT EXISTS user_orders_created_at_idx ON public.user_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_user_id_idx ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON public.support_tickets(status);

-- 10. Funkce pro získání user profilu s statistikami
CREATE OR REPLACE FUNCTION public.get_user_profile(user_id UUID)
RETURNS JSON AS $$
DECLARE
  profile_data JSON;
  order_count INTEGER;
  active_services INTEGER;
  total_spent DECIMAL;
BEGIN
  -- Získej základní profil
  SELECT row_to_json(p) INTO profile_data
  FROM public.profiles p
  WHERE p.id = user_id;

  -- Počítej statistiky
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'active'),
    COALESCE(SUM(price), 0)
  INTO order_count, active_services, total_spent
  FROM public.user_orders
  WHERE user_orders.user_id = get_user_profile.user_id;

  -- Vrať kombinovaná data
  RETURN json_build_object(
    'profile', profile_data,
    'stats', json_build_object(
      'total_orders', order_count,
      'active_services', active_services,
      'total_spent', total_spent
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Povolit Storage bucket pro avatary (spustit v Supabase Storage)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Policy pro upload avatarů
-- CREATE POLICY "Avatar uploads are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
-- CREATE POLICY "Anyone can upload an avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');
-- CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE USING (auth.uid()::text = (storage.foldername(name))[1]);

-- KONEC SCHÉMATU