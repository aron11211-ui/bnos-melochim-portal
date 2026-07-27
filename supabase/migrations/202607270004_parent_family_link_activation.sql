-- Allow an invited parent to activate only their own existing family link
-- after accepting an invitation and setting a password.

drop policy if exists "family users activate own invitation" on public.family_users;
create policy "family users activate own invitation"
on public.family_users
for update
using (user_id = auth.uid() and status = 'invited')
with check (user_id = auth.uid() and status = 'active');
