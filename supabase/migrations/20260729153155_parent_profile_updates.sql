drop policy if exists "families parent update own" on public.families;
create policy "families parent update own"
on public.families
for update
to authenticated
using (public.is_family_user(id))
with check (public.is_family_user(id));

drop policy if exists "students parent update own" on public.students;
create policy "students parent update own"
on public.students
for update
to authenticated
using (public.is_family_user(family_id))
with check (public.is_family_user(family_id));

drop policy if exists "registration steps parent insert own" on public.registration_steps;
create policy "registration steps parent insert own"
on public.registration_steps
for insert
to authenticated
with check (
  exists (
    select 1
    from public.registrations r
    where r.id = registration_id
      and public.is_family_user(r.family_id)
  )
);

drop policy if exists "agreement signatures parent update own" on public.agreement_signatures;
create policy "agreement signatures parent update own"
on public.agreement_signatures
for update
to authenticated
using (public.is_family_user(family_id) and user_id = auth.uid())
with check (public.is_family_user(family_id) and user_id = auth.uid());
