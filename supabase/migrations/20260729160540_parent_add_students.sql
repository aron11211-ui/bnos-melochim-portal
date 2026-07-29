drop policy if exists "students parent insert own" on public.students;
create policy "students parent insert own"
on public.students
for insert
to authenticated
with check (public.is_family_user(family_id));
