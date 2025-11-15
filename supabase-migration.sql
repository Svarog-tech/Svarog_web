-- Supabase Database Migration Script
-- This script creates all necessary tables and functions for the hosting application

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- PROFILES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  company TEXT,
  newsletter BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- =====================================================
-- ORDERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.orders (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'CZK',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'cancelled', 'expired')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  billing_email TEXT,
  billing_name TEXT,
  billing_company TEXT,
  billing_address TEXT,
  billing_phone TEXT,
  domain_name TEXT,
  service_start_date TIMESTAMP WITH TIME ZONE,
  service_end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Policies for orders
CREATE POLICY "Users can view their own orders"
  ON public.orders
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own orders"
  ON public.orders
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- SUPPORT TICKETS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category TEXT DEFAULT 'general',
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Policies for support tickets
CREATE POLICY "Users can view their own tickets"
  ON public.support_tickets
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tickets"
  ON public.support_tickets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to update last login timestamp
CREATE OR REPLACE FUNCTION public.update_last_login(user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET last_login = NOW()
  WHERE id = user_id;
END;
$$;

-- Function to get user profile with stats
CREATE OR REPLACE FUNCTION public.get_user_profile(user_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  company TEXT,
  newsletter BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  last_login TIMESTAMP WITH TIME ZONE,
  total_orders BIGINT,
  active_services BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- If user_id is provided, use it; otherwise use the current authenticated user
  target_user_id := COALESCE(user_id, auth.uid());

  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.first_name,
    p.last_name,
    p.avatar_url,
    p.phone,
    p.company,
    p.newsletter,
    p.created_at,
    p.updated_at,
    p.last_login,
    COUNT(DISTINCT o.id) AS total_orders,
    COUNT(DISTINCT CASE WHEN o.status = 'active' THEN o.id END) AS active_services
  FROM public.profiles p
  LEFT JOIN public.orders o ON p.id = o.user_id
  WHERE p.id = target_user_id
  GROUP BY p.id, p.email, p.first_name, p.last_name, p.avatar_url,
           p.phone, p.company, p.newsletter, p.created_at, p.updated_at, p.last_login;
END;
$$;

-- Function to update user profile
CREATE OR REPLACE FUNCTION public.update_user_profile(
  user_id UUID,
  first_name TEXT DEFAULT NULL,
  last_name TEXT DEFAULT NULL,
  phone TEXT DEFAULT NULL,
  company TEXT DEFAULT NULL,
  avatar_url TEXT DEFAULT NULL,
  newsletter BOOLEAN DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET
    first_name = COALESCE(update_user_profile.first_name, profiles.first_name),
    last_name = COALESCE(update_user_profile.last_name, profiles.last_name),
    phone = COALESCE(update_user_profile.phone, profiles.phone),
    company = COALESCE(update_user_profile.company, profiles.company),
    avatar_url = COALESCE(update_user_profile.avatar_url, profiles.avatar_url),
    newsletter = COALESCE(update_user_profile.newsletter, profiles.newsletter),
    updated_at = NOW()
  WHERE id = user_id AND auth.uid() = user_id;
END;
$$;

-- Function to create hosting order
CREATE OR REPLACE FUNCTION public.create_hosting_order(
  plan_id TEXT,
  plan_name TEXT,
  price NUMERIC,
  currency TEXT DEFAULT 'CZK',
  billing_email TEXT DEFAULT NULL,
  billing_name TEXT DEFAULT NULL,
  billing_company TEXT DEFAULT NULL,
  billing_address TEXT DEFAULT NULL,
  billing_phone TEXT DEFAULT NULL,
  domain_name TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_order_id BIGINT;
BEGIN
  INSERT INTO public.orders (
    user_id, plan_id, plan_name, price, currency,
    billing_email, billing_name, billing_company,
    billing_address, billing_phone, domain_name,
    status, payment_status
  )
  VALUES (
    auth.uid(), plan_id, plan_name, price, currency,
    billing_email, billing_name, billing_company,
    billing_address, billing_phone, domain_name,
    'pending', 'pending'
  )
  RETURNING id INTO new_order_id;

  RETURN new_order_id;
END;
$$;

-- Function to get user orders
CREATE OR REPLACE FUNCTION public.get_user_orders(user_id UUID DEFAULT NULL)
RETURNS TABLE (
  id BIGINT,
  plan_id TEXT,
  plan_name TEXT,
  price NUMERIC,
  currency TEXT,
  status TEXT,
  payment_status TEXT,
  domain_name TEXT,
  service_start_date TIMESTAMP WITH TIME ZONE,
  service_end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- If user_id is provided, use it; otherwise use the current authenticated user
  target_user_id := COALESCE(user_id, auth.uid());

  RETURN QUERY
  SELECT
    o.id,
    o.plan_id,
    o.plan_name,
    o.price,
    o.currency,
    o.status,
    o.payment_status,
    o.domain_name,
    o.service_start_date,
    o.service_end_date,
    o.created_at
  FROM public.orders o
  WHERE o.user_id = target_user_id
  ORDER BY o.created_at DESC;
END;
$$;

-- Function to create support ticket
CREATE OR REPLACE FUNCTION public.create_support_ticket(
  subject TEXT,
  message TEXT,
  priority TEXT DEFAULT 'medium',
  category TEXT DEFAULT 'general'
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_ticket_id BIGINT;
BEGIN
  INSERT INTO public.support_tickets (
    user_id, subject, message, priority, category, status
  )
  VALUES (
    auth.uid(), subject, message, priority, category, 'open'
  )
  RETURNING id INTO new_ticket_id;

  RETURN new_ticket_id;
END;
$$;

-- =====================================================
-- TRIGGER: Auto-create profile on user signup
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', NULL)
  );
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- TRIGGER: Update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Add update triggers to tables
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant permissions on tables
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT ON public.orders TO authenticated;
GRANT SELECT, INSERT ON public.support_tickets TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.update_last_login TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_hosting_order TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_orders TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_support_ticket TO authenticated;

-- Grant sequence permissions
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
