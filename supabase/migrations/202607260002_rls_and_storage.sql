-- RLS helpers, role policies, audit helper, and private storage buckets.
-- The service role bypasses RLS; never expose it to the browser.

create or replace function public.current_role()
returns public.app_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid() and status = 'active'
$$;

create or replace function public.is_active_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and status = 'active')
$$;

create or replace function public.has_role(allowed public.app_role[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_role() = any(allowed)
$$;

create or replace function public.can_manage_users()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.has_role(array['super_admin']::public.app_role[])
$$;

create or replace function public.can_manage_registration()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.has_role(array['registration_office','super_admin']::public.app_role[])
$$;

create or replace function public.can_manage_tuition()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.has_role(array['tuition_office','super_admin']::public.app_role[])
$$;

create or replace function public.can_read_tuition()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.has_role(array['tuition_office','school_management','super_admin']::public.app_role[])
$$;

create or replace function public.is_family_user(target_family_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.family_users
    where family_id = target_family_id and user_id = auth.uid() and status = 'active'
  )
$$;

create or replace function public.can_read_family(target_family_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_family_user(target_family_id)
    or public.has_role(array['registration_office','tuition_office','school_management','super_admin']::public.app_role[])
$$;

create or replace function public.log_audit(target_table text, target_id uuid, action text, details jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs(actor_id, action, table_name, record_id, details)
  values (auth.uid(), action, target_table, target_id, details);
end;
$$;

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = new.id and not public.can_manage_users() then
    if new.role is distinct from old.role
      or new.status is distinct from old.status
      or new.disabled_at is distinct from old.disabled_at then
      raise exception 'Profile role and status can only be changed by a super administrator.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_privileges on public.profiles;
create trigger protect_profile_privileges
before update on public.profiles
for each row execute function public.prevent_profile_privilege_escalation();

create policy "profiles read own or staff" on public.profiles
for select using (
  id = auth.uid()
  or public.has_role(array['registration_office','tuition_office','school_management','super_admin']::public.app_role[])
);
create policy "profiles update own basics" on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles super admin manage" on public.profiles
for all using (public.can_manage_users()) with check (public.can_manage_users());

create policy "school years read authenticated" on public.school_years for select using (public.is_active_user());
create policy "school years super admin manage" on public.school_years for all using (public.can_manage_users()) with check (public.can_manage_users());

create policy "families read permitted" on public.families for select using (public.can_read_family(id));
create policy "families registration manage" on public.families for all using (public.can_manage_registration() or public.can_manage_users()) with check (public.can_manage_registration() or public.can_manage_users());

create policy "family users read permitted" on public.family_users for select using (public.can_read_family(family_id) or user_id = auth.uid());
create policy "family users office manage" on public.family_users for all using (public.can_manage_registration() or public.can_manage_users()) with check (public.can_manage_registration() or public.can_manage_users());

create policy "students read permitted" on public.students for select using (public.can_read_family(family_id));
create policy "students registration manage" on public.students for all using (public.can_manage_registration() or public.can_manage_users()) with check (public.can_manage_registration() or public.can_manage_users());

create policy "registrations read permitted" on public.registrations for select using (public.can_read_family(family_id));
create policy "registrations parent update own" on public.registrations for update using (public.is_family_user(family_id)) with check (public.is_family_user(family_id));
create policy "registrations office manage" on public.registrations for all using (public.can_manage_registration() or public.can_manage_users()) with check (public.can_manage_registration() or public.can_manage_users());

create policy "registration steps read permitted" on public.registration_steps
for select using (exists(select 1 from public.registrations r where r.id = registration_id and public.can_read_family(r.family_id)));
create policy "registration steps parent update own" on public.registration_steps
for update using (exists(select 1 from public.registrations r where r.id = registration_id and public.is_family_user(r.family_id)))
with check (exists(select 1 from public.registrations r where r.id = registration_id and public.is_family_user(r.family_id)));
create policy "registration steps office manage" on public.registration_steps for all using (public.can_manage_registration() or public.can_manage_users()) with check (public.can_manage_registration() or public.can_manage_users());

create policy "document requirements read active" on public.document_requirements for select using (public.is_active_user());
create policy "document requirements office manage" on public.document_requirements for all using (public.can_manage_registration() or public.can_manage_users()) with check (public.can_manage_registration() or public.can_manage_users());

create policy "student documents read permitted" on public.student_documents
for select using (
  public.is_family_user(family_id)
  or public.has_role(array['registration_office','school_management','super_admin']::public.app_role[])
  or (
    category not in ('Medical','Confidential Medical')
    and public.has_role(array['tuition_office']::public.app_role[])
  )
);
create policy "student documents parent insert own" on public.student_documents
for insert with check (public.is_family_user(family_id));
create policy "student documents parent update own" on public.student_documents
for update using (public.is_family_user(family_id))
with check (public.is_family_user(family_id));
create policy "student documents office manage" on public.student_documents for all using (public.can_manage_registration() or public.can_manage_users()) with check (public.can_manage_registration() or public.can_manage_users());

create policy "agreements read active" on public.agreements for select using (public.is_active_user());
create policy "agreements office manage" on public.agreements for all using (public.can_manage_registration() or public.can_manage_users()) with check (public.can_manage_registration() or public.can_manage_users());

create policy "agreement signatures read permitted" on public.agreement_signatures
for select using (public.can_read_family(family_id));
create policy "agreement signatures parent sign own" on public.agreement_signatures
for insert with check (public.is_family_user(family_id) and user_id = auth.uid());
create policy "agreement signatures office manage" on public.agreement_signatures for all using (public.can_manage_registration() or public.can_manage_users()) with check (public.can_manage_registration() or public.can_manage_users());

create policy "tuition accounts read permitted" on public.tuition_accounts
for select using (public.is_family_user(family_id) or public.can_read_tuition());
create policy "tuition accounts manage" on public.tuition_accounts for all using (public.can_manage_tuition() or public.can_manage_users()) with check (public.can_manage_tuition() or public.can_manage_users());

create policy "tuition charges read permitted" on public.tuition_charges
for select using (exists(select 1 from public.tuition_accounts a where a.id = tuition_account_id and (public.is_family_user(a.family_id) or public.can_read_tuition())));
create policy "tuition charges manage" on public.tuition_charges for all using (public.can_manage_tuition() or public.can_manage_users()) with check (public.can_manage_tuition() or public.can_manage_users());

create policy "discounts credits read permitted" on public.discounts_and_credits
for select using (exists(select 1 from public.tuition_accounts a where a.id = tuition_account_id and (public.is_family_user(a.family_id) or public.can_read_tuition())));
create policy "discounts credits manage" on public.discounts_and_credits for all using (public.can_manage_tuition() or public.can_manage_users()) with check (public.can_manage_tuition() or public.can_manage_users());

create policy "payment plans read permitted" on public.payment_plans
for select using (exists(select 1 from public.tuition_accounts a where a.id = tuition_account_id and (public.is_family_user(a.family_id) or public.can_read_tuition())));
create policy "payment plans manage" on public.payment_plans for all using (public.can_manage_tuition() or public.can_manage_users()) with check (public.can_manage_tuition() or public.can_manage_users());

create policy "installments read permitted" on public.installments
for select using (exists(select 1 from public.payment_plans p join public.tuition_accounts a on a.id = p.tuition_account_id where p.id = payment_plan_id and (public.is_family_user(a.family_id) or public.can_read_tuition())));
create policy "installments manage" on public.installments for all using (public.can_manage_tuition() or public.can_manage_users()) with check (public.can_manage_tuition() or public.can_manage_users());

create policy "invoices read permitted" on public.invoices
for select using (exists(select 1 from public.tuition_accounts a where a.id = tuition_account_id and (public.is_family_user(a.family_id) or public.can_read_tuition())));
create policy "invoices manage" on public.invoices for all using (public.can_manage_tuition() or public.can_manage_users()) with check (public.can_manage_tuition() or public.can_manage_users());

create policy "payments read permitted" on public.payments
for select using (exists(select 1 from public.tuition_accounts a where a.id = tuition_account_id and (public.is_family_user(a.family_id) or public.can_read_tuition())));
create policy "payments manage" on public.payments for all using (public.can_manage_tuition() or public.can_manage_users()) with check (public.can_manage_tuition() or public.can_manage_users());

create policy "receipts read permitted" on public.receipts
for select using (exists(select 1 from public.payments p join public.tuition_accounts a on a.id = p.tuition_account_id where p.id = payment_id and (public.is_family_user(a.family_id) or public.can_read_tuition())));
create policy "receipts manage" on public.receipts for all using (public.can_manage_tuition() or public.can_manage_users()) with check (public.can_manage_tuition() or public.can_manage_users());

create policy "internal notes staff read" on public.internal_notes
for select using (
  public.has_role(array['registration_office','school_management','super_admin']::public.app_role[])
  or (
    note_type not in ('medical','confidential_medical')
    and public.has_role(array['tuition_office']::public.app_role[])
  )
);
create policy "internal notes staff manage" on public.internal_notes
for all using (public.has_role(array['registration_office','tuition_office','super_admin']::public.app_role[]))
with check (public.has_role(array['registration_office','tuition_office','super_admin']::public.app_role[]));

create policy "notifications read own or family" on public.notifications for select using (user_id = auth.uid() or public.can_read_family(family_id));
create policy "notifications staff insert" on public.notifications for insert with check (public.has_role(array['registration_office','tuition_office','super_admin']::public.app_role[]));
create policy "notifications own update" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "audit logs super admin read" on public.audit_logs for select using (public.can_manage_users());
create policy "audit logs insert active" on public.audit_logs for insert with check (public.is_active_user());

create policy "staff permissions super admin" on public.staff_permissions for all using (public.can_manage_users()) with check (public.can_manage_users());
create policy "school settings read staff" on public.school_settings for select using (public.has_role(array['registration_office','tuition_office','school_management','super_admin']::public.app_role[]));
create policy "school settings super admin manage" on public.school_settings for all using (public.can_manage_users()) with check (public.can_manage_users());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('registration-documents','registration-documents',false,10485760,array['application/pdf','image/jpeg','image/png']),
  ('medical-documents','medical-documents',false,10485760,array['application/pdf','image/jpeg','image/png']),
  ('signed-agreements','signed-agreements',false,10485760,array['application/pdf']),
  ('receipts','receipts',false,10485760,array['application/pdf'])
on conflict (id) do update set public = false;

create policy "storage parent upload own family documents" on storage.objects
for insert with check (
  bucket_id in ('registration-documents','medical-documents')
  and public.is_family_user((storage.foldername(name))[1]::uuid)
);

create policy "storage read permitted family documents" on storage.objects
for select using (
  bucket_id in ('registration-documents','medical-documents','signed-agreements','receipts')
  and (
    public.is_family_user((storage.foldername(name))[1]::uuid)
    or public.has_role(array['registration_office','school_management','super_admin']::public.app_role[])
    or (
      bucket_id in ('signed-agreements','receipts')
      and public.has_role(array['tuition_office']::public.app_role[])
    )
  )
);

create policy "storage staff manage documents" on storage.objects
for all using (
  bucket_id in ('registration-documents','medical-documents','signed-agreements','receipts')
  and (
    public.has_role(array['registration_office','super_admin']::public.app_role[])
    or (bucket_id in ('signed-agreements','receipts') and public.has_role(array['tuition_office']::public.app_role[]))
  )
) with check (
  bucket_id in ('registration-documents','medical-documents','signed-agreements','receipts')
  and (
    public.has_role(array['registration_office','super_admin']::public.app_role[])
    or (bucket_id in ('signed-agreements','receipts') and public.has_role(array['tuition_office']::public.app_role[]))
  )
);
