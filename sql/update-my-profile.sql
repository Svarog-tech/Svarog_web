-- Aktualizace profilu pro adam.broz.cz@gmail.com
-- Změň jméno a příjmení jak chceš

UPDATE public.profiles
SET
  first_name = 'Adam',
  last_name = 'Brož',
  phone = '+420 123 456 789',  -- změň na svůj telefon
  company = '',  -- vyplň pokud chceš
  updated_at = NOW()
WHERE email = 'adam.broz.cz@gmail.com';

-- Zkontroluj že se to updatlo
SELECT id, email, first_name, last_name, phone, company
FROM public.profiles
WHERE email = 'adam.broz.cz@gmail.com';
