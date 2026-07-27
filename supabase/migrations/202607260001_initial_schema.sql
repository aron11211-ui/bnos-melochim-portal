-- Bnos Melochim Registration & Tuition Management
-- Initial secure multi-user schema for a new Supabase project.

create extension if not exists "pgcrypto";

do $$ begin
  create type public.app_role as enum (
    'parent',
    'registration_office',
    'tuition_office',
    'school_management',
    'super_admin'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.account_status as enum (
    'active',
    'invited',
    'disabled',
    'pending_verification'
  );
exception when duplicate_object then null; end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  email text not null unique,
  phone text,
  role public.app_role not null default 'parent',
  status public.account_status not null default 'pending_verification',
  disabled_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.school_years (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  hebrew_label text,
  starts_on date not null,
  ends_on date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  family_code text not null unique,
  family_name text not null,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  primary_email text,
  primary_phone text,
  shul text,
  emergency_contacts jsonb not null default '[]'::jsonb,
  maternal_grandparents text,
  paternal_grandparents text,
  guardians jsonb not null default '[]'::jsonb,
  registration_status text not null default 'in_progress',
  registration_percent integer not null default 0 check (registration_percent between 0 and 100),
  school_year_id uuid references public.school_years(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.family_users (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  relationship text not null,
  is_primary_contact boolean not null default false,
  status public.account_status not null default 'active',
  permissions jsonb not null default '{}'::jsonb,
  invited_by uuid references auth.users(id),
  invited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, user_id)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  student_number text unique,
  legal_name text not null,
  preferred_name text,
  date_of_birth date,
  gender text,
  grade text,
  program text,
  new_returning text not null default 'New',
  registration_status text not null default 'in_progress',
  document_status text not null default 'missing',
  tuition_status text not null default 'current',
  transportation text,
  progress integer not null default 0 check (progress between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  school_year_id uuid references public.school_years(id),
  status text not null default 'in_progress',
  percent_complete integer not null default 0 check (percent_complete between 0 and 100),
  completed_sections integer not null default 0,
  remaining_items integer not null default 0,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, school_year_id)
);

create table if not exists public.registration_steps (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  step_key text not null,
  title text not null,
  status text not null default 'not_started',
  completed_at timestamptz,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (registration_id, step_key)
);

create table if not exists public.document_requirements (
  id uuid primary key default gen_random_uuid(),
  school_year_id uuid references public.school_years(id),
  name text not null,
  category text not null,
  applies_to text not null default 'family',
  due_on date,
  required boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_documents (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  requirement_id uuid references public.document_requirements(id),
  document_type text,
  category text not null default 'Registration',
  status text not null default 'missing',
  storage_bucket text,
  storage_path text,
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  staff_note text,
  expires_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agreements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  version text not null,
  body text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (title, version)
);

create table if not exists public.agreement_signatures (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  signer_name text not null,
  signed_at timestamptz not null default now(),
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (agreement_id, family_id, user_id)
);

create table if not exists public.tuition_accounts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  school_year_id uuid references public.school_years(id),
  status text not null default 'current',
  annual_tuition numeric(12,2) not null default 0,
  fees numeric(12,2) not null default 0,
  transportation numeric(12,2) not null default 0,
  registration_fee numeric(12,2) not null default 0,
  discounts numeric(12,2) not null default 0,
  scholarships numeric(12,2) not null default 0,
  credits numeric(12,2) not null default 0,
  paid numeric(12,2) not null default 0,
  plan_name text not null default 'Custom arrangement',
  next_due_on date,
  next_due_amount numeric(12,2),
  failed_payments integer not null default 0,
  collection_notes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, school_year_id)
);

create table if not exists public.tuition_charges (
  id uuid primary key default gen_random_uuid(),
  tuition_account_id uuid not null references public.tuition_accounts(id) on delete cascade,
  student_id uuid references public.students(id),
  charge_type text not null,
  description text not null,
  amount numeric(12,2) not null,
  due_on date,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.discounts_and_credits (
  id uuid primary key default gen_random_uuid(),
  tuition_account_id uuid not null references public.tuition_accounts(id) on delete cascade,
  type text not null,
  description text not null,
  amount numeric(12,2) not null,
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.payment_plans (
  id uuid primary key default gen_random_uuid(),
  tuition_account_id uuid not null references public.tuition_accounts(id) on delete cascade,
  plan_name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.installments (
  id uuid primary key default gen_random_uuid(),
  payment_plan_id uuid not null references public.payment_plans(id) on delete cascade,
  due_on date not null,
  amount numeric(12,2) not null,
  status text not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  tuition_account_id uuid not null references public.tuition_accounts(id) on delete cascade,
  invoice_number text not null unique,
  status text not null default 'open',
  total_amount numeric(12,2) not null default 0,
  issued_on date not null default current_date,
  due_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  tuition_account_id uuid not null references public.tuition_accounts(id) on delete cascade,
  amount numeric(12,2) not null,
  payment_date date not null default current_date,
  method text not null default 'manual',
  status text not null default 'recorded',
  reference text,
  recorded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  receipt_number text not null unique,
  storage_bucket text,
  storage_path text,
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.internal_notes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  note_type text not null default 'general',
  body text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  table_name text not null,
  record_id uuid,
  details jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  permission_key text not null,
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (user_id, permission_key)
);

create table if not exists public.school_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_role_status on public.profiles(role, status);
create index if not exists idx_family_users_user_id on public.family_users(user_id);
create index if not exists idx_family_users_family_id on public.family_users(family_id);
create index if not exists idx_students_family_id on public.students(family_id);
create index if not exists idx_registrations_family_id on public.registrations(family_id);
create index if not exists idx_registration_steps_registration_id on public.registration_steps(registration_id);
create index if not exists idx_documents_family_id on public.student_documents(family_id);
create index if not exists idx_documents_student_id on public.student_documents(student_id);
create index if not exists idx_tuition_accounts_family_id on public.tuition_accounts(family_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','school_years','families','family_users','students','registrations',
    'registration_steps','document_requirements','student_documents','agreements',
    'agreement_signatures','tuition_accounts','tuition_charges','discounts_and_credits',
    'payment_plans','installments','invoices','payments','receipts','internal_notes',
    'notifications','audit_logs','staff_permissions','school_settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists school_years_updated_at on public.school_years;
create trigger school_years_updated_at before update on public.school_years for each row execute function public.set_updated_at();
drop trigger if exists families_updated_at on public.families;
create trigger families_updated_at before update on public.families for each row execute function public.set_updated_at();
drop trigger if exists family_users_updated_at on public.family_users;
create trigger family_users_updated_at before update on public.family_users for each row execute function public.set_updated_at();
drop trigger if exists students_updated_at on public.students;
create trigger students_updated_at before update on public.students for each row execute function public.set_updated_at();
drop trigger if exists registrations_updated_at on public.registrations;
create trigger registrations_updated_at before update on public.registrations for each row execute function public.set_updated_at();
drop trigger if exists registration_steps_updated_at on public.registration_steps;
create trigger registration_steps_updated_at before update on public.registration_steps for each row execute function public.set_updated_at();
drop trigger if exists document_requirements_updated_at on public.document_requirements;
create trigger document_requirements_updated_at before update on public.document_requirements for each row execute function public.set_updated_at();
drop trigger if exists student_documents_updated_at on public.student_documents;
create trigger student_documents_updated_at before update on public.student_documents for each row execute function public.set_updated_at();
drop trigger if exists agreements_updated_at on public.agreements;
create trigger agreements_updated_at before update on public.agreements for each row execute function public.set_updated_at();
drop trigger if exists tuition_accounts_updated_at on public.tuition_accounts;
create trigger tuition_accounts_updated_at before update on public.tuition_accounts for each row execute function public.set_updated_at();
drop trigger if exists payment_plans_updated_at on public.payment_plans;
create trigger payment_plans_updated_at before update on public.payment_plans for each row execute function public.set_updated_at();
drop trigger if exists installments_updated_at on public.installments;
create trigger installments_updated_at before update on public.installments for each row execute function public.set_updated_at();
drop trigger if exists invoices_updated_at on public.invoices;
create trigger invoices_updated_at before update on public.invoices for each row execute function public.set_updated_at();
drop trigger if exists internal_notes_updated_at on public.internal_notes;
create trigger internal_notes_updated_at before update on public.internal_notes for each row execute function public.set_updated_at();
drop trigger if exists school_settings_updated_at on public.school_settings;
create trigger school_settings_updated_at before update on public.school_settings for each row execute function public.set_updated_at();
