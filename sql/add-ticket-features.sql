-- Rozšíření ticketů o pokročilé funkce

-- 1. Přidat attachments tabulku pro obrázky a soubory
CREATE TABLE IF NOT EXISTS public.ticket_attachments (
  id BIGSERIAL PRIMARY KEY,
  ticket_id BIGINT REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Přidat ticket_messages tabulku pro konverzaci v ticketech
CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id BIGSERIAL PRIMARY KEY,
  ticket_id BIGINT REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  message TEXT NOT NULL,
  is_admin_reply BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Přidat ticket_mentions tabulku pro @mentions
CREATE TABLE IF NOT EXISTS public.ticket_mentions (
  id BIGSERIAL PRIMARY KEY,
  message_id BIGINT REFERENCES public.ticket_messages(id) ON DELETE CASCADE,
  mentioned_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Přidat sloupec assigned_to do support_tickets
ALTER TABLE public.support_tickets
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS last_reply_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_reply_by UUID REFERENCES auth.users(id);

-- 5. RLS policies pro attachments
ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attachments from their tickets"
  ON public.ticket_attachments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets
      WHERE support_tickets.id = ticket_attachments.ticket_id
      AND support_tickets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can upload attachments to their tickets"
  ON public.ticket_attachments
  FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.support_tickets
      WHERE support_tickets.id = ticket_attachments.ticket_id
      AND support_tickets.user_id = auth.uid()
    )
  );

-- 6. RLS policies pro messages
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages from their tickets"
  ON public.ticket_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets
      WHERE support_tickets.id = ticket_messages.ticket_id
      AND support_tickets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add messages to their tickets"
  ON public.ticket_messages
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.support_tickets
      WHERE support_tickets.id = ticket_messages.ticket_id
      AND support_tickets.user_id = auth.uid()
    )
  );

-- 7. RLS policies pro mentions
ALTER TABLE public.ticket_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view mentions"
  ON public.ticket_mentions
  FOR SELECT
  USING (mentioned_user_id = auth.uid());

-- 8. Indexy pro výkon
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket_id ON public.ticket_attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON public.ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_mentions_user_id ON public.ticket_mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON public.support_tickets(assigned_to);

-- 9. Grant permissions
GRANT SELECT, INSERT ON public.ticket_attachments TO authenticated;
GRANT SELECT, INSERT ON public.ticket_messages TO authenticated;
GRANT SELECT ON public.ticket_mentions TO authenticated;
GRANT INSERT ON public.ticket_mentions TO authenticated;

-- 10. Storage bucket pro ticket attachments (pokud neexistuje)
-- Toto je potřeba spustit přes Supabase Dashboard v Storage sekci
-- Název bucketu: ticket-attachments
-- Public: false
-- Allowed MIME types: image/*, application/pdf
