-- Auth Functions pro Alatyr Hosting
-- Funkce pro registraci a přihlášení uživatelů

-- 1. Registrace se řeší přímo přes Supabase Client
-- Trigger handle_new_user() automaticky vytvoří profil po úspěšné registraci

-- 2. Funkce pro update profilu po OAuth přihlášení
CREATE OR REPLACE FUNCTION public.update_profile_from_oauth(
  user_id UUID,
  provider_name TEXT,
  provider_user_id TEXT,
  user_email TEXT,
  display_name TEXT DEFAULT '',
  avatar_url TEXT DEFAULT ''
)
RETURNS JSON AS $$
DECLARE
  name_parts TEXT[];
  first_name TEXT := '';
  last_name TEXT := '';
BEGIN
  -- Rozdel display name na křestní jméno a příjmení
  IF display_name IS NOT NULL AND display_name != '' THEN
    name_parts := string_to_array(display_name, ' ');
    first_name := COALESCE(name_parts[1], '');
    IF array_length(name_parts, 1) > 1 THEN
      last_name := array_to_string(name_parts[2:], ' ');
    END IF;
  END IF;

  -- Aktualizuj nebo vlož profil
  INSERT INTO public.profiles (
    id, email, first_name, last_name, provider, provider_id,
    avatar_url, email_verified, last_login
  )
  VALUES (
    user_id, user_email, first_name, last_name, provider_name,
    provider_user_id, avatar_url, true, NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    provider = EXCLUDED.provider,
    provider_id = EXCLUDED.provider_id,
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    email_verified = true,
    last_login = NOW(),
    updated_at = NOW();

  RETURN json_build_object(
    'success', true,
    'message', 'Profile updated successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Profile update failed: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Funkce pro kompletní registraci s detaily
CREATE OR REPLACE FUNCTION public.complete_registration(
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  phone TEXT DEFAULT NULL,
  company TEXT DEFAULT NULL,
  newsletter BOOLEAN DEFAULT FALSE
)
RETURNS JSON AS $$
BEGIN
  -- Aktualizuj profil s dodatečnými informacemi
  UPDATE public.profiles SET
    first_name = complete_registration.first_name,
    last_name = complete_registration.last_name,
    phone = complete_registration.phone,
    company = complete_registration.company,
    newsletter_subscription = newsletter,
    updated_at = NOW()
  WHERE id = user_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'User profile not found'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Registration completed successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Registration completion failed: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Funkce pro získání user profilu
CREATE OR REPLACE FUNCTION public.get_user_profile_by_id(user_id UUID)
RETURNS JSON AS $$
DECLARE
  profile_record public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO profile_record
  FROM public.profiles
  WHERE id = user_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Profile not found'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'profile', row_to_json(profile_record)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error retrieving profile: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Funkce pro aktualizaci profilu
CREATE OR REPLACE FUNCTION public.update_user_profile(
  user_id UUID,
  first_name TEXT DEFAULT NULL,
  last_name TEXT DEFAULT NULL,
  phone TEXT DEFAULT NULL,
  company TEXT DEFAULT NULL,
  avatar_url TEXT DEFAULT NULL,
  newsletter BOOLEAN DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
  -- Ověř, že uživatel aktualizuje svůj vlastní profil
  IF auth.uid() != user_id THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Unauthorized: Cannot update another user''s profile'
    );
  END IF;

  -- Aktualizuj pouze poskytnuté fields
  UPDATE public.profiles SET
    first_name = COALESCE(update_user_profile.first_name, profiles.first_name),
    last_name = COALESCE(update_user_profile.last_name, profiles.last_name),
    phone = COALESCE(update_user_profile.phone, profiles.phone),
    company = COALESCE(update_user_profile.company, profiles.company),
    avatar_url = COALESCE(update_user_profile.avatar_url, profiles.avatar_url),
    newsletter_subscription = COALESCE(newsletter, profiles.newsletter_subscription),
    updated_at = NOW()
  WHERE id = user_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Profile not found'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Profile updated successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Profile update failed: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Funkce pro vytvoření objednávky
CREATE OR REPLACE FUNCTION public.create_hosting_order(
  plan_id TEXT,
  plan_name TEXT,
  price DECIMAL,
  currency TEXT DEFAULT 'CZK',
  billing_email TEXT DEFAULT NULL,
  billing_name TEXT DEFAULT NULL,
  billing_company TEXT DEFAULT NULL,
  billing_address TEXT DEFAULT NULL,
  billing_phone TEXT DEFAULT NULL,
  domain_name TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  new_order_id INTEGER;
  user_id UUID := auth.uid();
BEGIN
  -- Ověř, že uživatel je přihlášen
  IF user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'User must be logged in to create an order'
    );
  END IF;

  -- Vytvoř objednávku
  INSERT INTO public.user_orders (
    user_id, plan_id, plan_name, price, currency,
    billing_email, billing_name, billing_company,
    billing_address, billing_phone, domain_name
  )
  VALUES (
    user_id, plan_id, plan_name, price, currency,
    billing_email, billing_name, billing_company,
    billing_address, billing_phone, domain_name
  )
  RETURNING id INTO new_order_id;

  RETURN json_build_object(
    'success', true,
    'order_id', new_order_id,
    'message', 'Order created successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Order creation failed: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Funkce pro získání objednávek uživatele
CREATE OR REPLACE FUNCTION public.get_user_orders(user_id UUID DEFAULT NULL)
RETURNS TABLE(
  id INTEGER,
  plan_id TEXT,
  plan_name TEXT,
  price DECIMAL,
  currency TEXT,
  status TEXT,
  payment_status TEXT,
  domain_name TEXT,
  created_at TIMESTAMPTZ,
  service_start_date DATE,
  service_end_date DATE
) AS $$
BEGIN
  -- Pokud není user_id zadáno, použij aktuálního uživatele
  IF user_id IS NULL THEN
    user_id := auth.uid();
  END IF;

  -- Ověř, že uživatel má přístup k těmto objednávkám
  IF auth.uid() != user_id THEN
    RAISE EXCEPTION 'Unauthorized access to user orders';
  END IF;

  RETURN QUERY
  SELECT
    o.id, o.plan_id, o.plan_name, o.price, o.currency,
    o.status, o.payment_status, o.domain_name, o.created_at,
    o.service_start_date, o.service_end_date
  FROM public.user_orders o
  WHERE o.user_id = get_user_orders.user_id
  ORDER BY o.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Funkce pro vytvoření support tiketu
CREATE OR REPLACE FUNCTION public.create_support_ticket(
  subject TEXT,
  message TEXT,
  priority TEXT DEFAULT 'medium',
  category TEXT DEFAULT 'general'
)
RETURNS JSON AS $$
DECLARE
  new_ticket_id INTEGER;
  user_id UUID := auth.uid();
BEGIN
  -- Ověř, že uživatel je přihlášen
  IF user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'User must be logged in to create a support ticket'
    );
  END IF;

  -- Vytvoř tiket
  INSERT INTO public.support_tickets (
    user_id, subject, message, priority, category
  )
  VALUES (
    user_id, subject, message, priority, category
  )
  RETURNING id INTO new_ticket_id;

  RETURN json_build_object(
    'success', true,
    'ticket_id', new_ticket_id,
    'message', 'Support ticket created successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Ticket creation failed: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;