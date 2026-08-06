-- Тестові акаунти для перевірки порталу.
-- Виконувати ПІСЛЯ міграції 0001_init.sql, у SQL Editor проєкту Supabase.
--
--   Працівник:      pracivnyk@truskavetska.test  /  Test1234!
--   Адміністратор:  kerivnyk@truskavetska.test   /  Admin1234!
--
-- Пошта навмисно в домені .test — такі адреси не існують і листи нікуди
-- не підуть. Акаунти створюються одразу підтвердженими, тому вхід працює
-- без листа. Профілі створить тригер handle_new_user з міграції.
--
-- УВАГА: це дані для тестування. Перед відкриттям порталу для працівників
-- видаліть їх — блок видалення в кінці файлу.

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  employee_id uuid := gen_random_uuid();
  admin_id    uuid := gen_random_uuid();
begin
  -- ---------------------------------------------------------------------
  -- Працівник
  -- ---------------------------------------------------------------------
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000',
    employee_id, 'authenticated', 'authenticated',
    'pracivnyk@truskavetska.test',
    extensions.crypt('Test1234!', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'full_name', 'Тест Працівник',
      'position',  'Торговий представник',
      'region',    'Львівська обл.'
    ),
    '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), employee_id, employee_id::text,
    jsonb_build_object('sub', employee_id::text, 'email', 'pracivnyk@truskavetska.test'),
    'email', now(), now(), now()
  );

  -- ---------------------------------------------------------------------
  -- Адміністратор
  -- ---------------------------------------------------------------------
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000',
    admin_id, 'authenticated', 'authenticated',
    'kerivnyk@truskavetska.test',
    extensions.crypt('Admin1234!', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'full_name', 'Тест Керівник',
      'position',  'Керівник відділу продажів',
      'region',    'Київ'
    ),
    '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), admin_id, admin_id::text,
    jsonb_build_object('sub', admin_id::text, 'email', 'kerivnyk@truskavetska.test'),
    'email', now(), now(), now()
  );

  -- Роль адміністратора — щоб з'явився розділ «Звіт про навчання»
  update public.profiles set role = 'admin' where id = admin_id;

  -- Трохи прогресу для працівника, щоб звіт не був порожнім
  insert into public.progress (user_id, course_id, completed_sections, best_score, updated_at)
  values (
    employee_id, 'truskavetska-basics',
    array['brand', 'origin', 'history', 'science'],
    14, now()
  );

  insert into public.quiz_attempts (user_id, course_id, score, total, passed)
  values (employee_id, 'truskavetska-basics', 14, 20, false);

  raise notice 'Створено тестові акаунти: pracivnyk@truskavetska.test / kerivnyk@truskavetska.test';
end $$;

-- ---------------------------------------------------------------------------
-- Видалення тестових акаунтів (розкоментуйте й виконайте, коли не потрібні).
-- Профілі, прогрес і спроби зникнуть автоматично — через on delete cascade.
-- ---------------------------------------------------------------------------
-- delete from auth.users
-- where email in ('pracivnyk@truskavetska.test', 'kerivnyk@truskavetska.test');
