-- Схема навчального порталу ТМ «Трускавецька».
-- Виконати в SQL Editor проєкту Supabase (або через supabase db push).

-- ---------------------------------------------------------------------------
-- Профілі працівників
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('employee', 'admin');

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null,
  position    text,
  region      text,
  role        public.user_role not null default 'employee',
  created_at  timestamptz not null default now()
);

comment on table public.profiles is 'Працівники, які проходять навчання';

-- Профіль створюється автоматично при реєстрації користувача.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, position, region)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), new.email),
    nullif(trim(new.raw_user_meta_data ->> 'position'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'region'), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Прогрес проходження курсу
-- ---------------------------------------------------------------------------

create table public.progress (
  user_id             uuid not null references public.profiles (id) on delete cascade,
  course_id           text not null,
  completed_sections  text[] not null default '{}',
  best_score          integer,
  passed_at           timestamptz,
  updated_at          timestamptz not null default now(),
  primary key (user_id, course_id)
);

comment on column public.progress.completed_sections is 'ID розділів, позначених як пройдені';
comment on column public.progress.best_score is 'Найкращий результат підсумкового тесту';

create index progress_course_idx on public.progress (course_id);

-- ---------------------------------------------------------------------------
-- Спроби проходження тесту (потрібні для звітності, а не лише останній бал)
-- ---------------------------------------------------------------------------

create table public.quiz_attempts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  course_id   text not null,
  score       integer not null,
  total       integer not null,
  passed      boolean not null,
  created_at  timestamptz not null default now()
);

create index quiz_attempts_user_idx on public.quiz_attempts (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Права доступу
-- ---------------------------------------------------------------------------

-- Окрема security definer функція, щоб політики на profiles не викликали самі себе.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

alter table public.profiles      enable row level security;
alter table public.progress      enable row level security;
alter table public.quiz_attempts enable row level security;

-- Профілі: свій — читати й редагувати; адміністратор — читати всі.
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy profiles_update_own on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

-- Прогрес: працівник керує лише своїм рядком.
create policy progress_select on public.progress
  for select using (user_id = auth.uid() or public.is_admin());

create policy progress_insert_own on public.progress
  for insert with check (user_id = auth.uid());

create policy progress_update_own on public.progress
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy progress_delete_own on public.progress
  for delete using (user_id = auth.uid());

-- Спроби тесту: додавати можна лише свої, змінювати не можна нікому.
create policy quiz_attempts_select on public.quiz_attempts
  for select using (user_id = auth.uid() or public.is_admin());

create policy quiz_attempts_insert_own on public.quiz_attempts
  for insert with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Звіт для керівника
-- ---------------------------------------------------------------------------

create view public.employee_report
with (security_invoker = true) as
select
  p.id                                as user_id,
  p.full_name,
  p.position,
  p.region,
  p.role,
  pr.course_id,
  coalesce(array_length(pr.completed_sections, 1), 0) as sections_done,
  pr.best_score,
  pr.passed_at,
  pr.updated_at                       as last_activity,
  (select count(*) from public.quiz_attempts qa where qa.user_id = p.id) as attempts
from public.profiles p
left join public.progress pr on pr.user_id = p.id;

comment on view public.employee_report is
  'Зведення для адмінки: скільки розділів пройдено, який бал, коли остання активність';
