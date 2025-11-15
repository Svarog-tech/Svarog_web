-- Trigger pro automatické odesílání emailů při vytvoření objednávky
-- Tento trigger zavolá Supabase Edge Function pro odeslání potvrzovacího emailu

-- Nejdřív vytvoř funkci, která zavolá Edge Function
CREATE OR REPLACE FUNCTION public.send_order_confirmation_email()
RETURNS TRIGGER AS $$
DECLARE
  function_url TEXT;
  service_role_key TEXT;
BEGIN
  -- URL Edge Function (nahraď YOUR_PROJECT_REF svým project reference)
  function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-order-email';
  service_role_key := current_setting('app.settings.supabase_service_role_key', true);

  -- Zavolej Edge Function asynchronně pomocí pg_net (pokud je nainstalován)
  -- NEBO použij supabase_functions.invoke_edge_function

  -- Pro jednoduchost použijeme přímé volání přes HTTP extension
  -- (tento kód funguje jen pokud máš nainstalované http extension)
  PERFORM net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'customerEmail', NEW.customer_email,
      'customerName', NEW.customer_name,
      'planName', NEW.plan_name,
      'price', NEW.price,
      'orderId', NEW.id
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vytvoř trigger, který se spustí po vytvoření nové objednávky
CREATE OR REPLACE TRIGGER on_order_created
  AFTER INSERT ON public.user_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.send_order_confirmation_email();

-- Poznámka: Pro fungování tohoto triggeru musíš:
-- 1. Nainstalovat pg_net extension v Supabase (Database > Extensions > pg_net)
-- 2. Nastavit proměnné prostředí v Database Settings:
--    - app.settings.supabase_url = tvoje Supabase URL
--    - app.settings.supabase_service_role_key = service role key
-- 3. Nasadit Edge Function send-order-email do Supabase
