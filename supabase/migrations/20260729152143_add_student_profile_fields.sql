alter table public.students
  add column if not exists previous_school text,
  add column if not exists medical_alerts text,
  add column if not exists physician_name text,
  add column if not exists physician_phone text,
  add column if not exists emergency_info text,
  add column if not exists authorized_pickup jsonb not null default '[]'::jsonb;

create index if not exists students_family_grade_idx
  on public.students (family_id, grade);

create index if not exists students_legal_name_idx
  on public.students (lower(legal_name));
