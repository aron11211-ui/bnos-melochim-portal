-- Allow linked parent accounts to create their own registration workflow rows.
-- Parents can only insert rows tied to a family they are linked to through family_users.

drop policy if exists "registrations parent insert own" on public.registrations;
create policy "registrations parent insert own"
on public.registrations
for insert
with check (public.is_family_user(family_id));

drop policy if exists "registration steps parent insert own" on public.registration_steps;
create policy "registration steps parent insert own"
on public.registration_steps
for insert
with check (
  exists (
    select 1
    from public.registrations r
    where r.id = registration_id
      and public.is_family_user(r.family_id)
  )
);
