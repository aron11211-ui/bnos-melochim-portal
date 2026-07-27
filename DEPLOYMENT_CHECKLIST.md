# Bnos Melochim Deployment Checklist

## Repository

- [ ] Review local changes.
- [ ] Commit the production setup changes.
- [ ] Create a GitHub repository.
- [ ] Add the GitHub remote.
- [ ] Push the production branch to GitHub.

## Supabase

- [ ] Create the Supabase project.
- [ ] Copy the Project URL.
- [ ] Copy the public anon key.
- [ ] Create `.env.local`.
- [ ] Run `supabase login`.
- [ ] Run `supabase link --project-ref YOUR-PROJECT-REF`.
- [ ] Run `supabase db push`.
- [ ] Confirm all migrations apply successfully.
- [ ] Confirm private buckets exist: `registration-documents`, `medical-documents`, `signed-agreements`, `receipts`.
- [ ] Create the first Super Admin auth user.
- [ ] Insert the first Super Admin profile row.
- [ ] Set Supabase Edge Function secrets.
- [ ] Deploy `invite-user`.
- [ ] Deploy `update-user-access`.
- [ ] Configure Site URL.
- [ ] Configure redirect URLs for login, password reset, and invitations.

## Render

- [ ] Create a Render Static Site from the GitHub repo.
- [ ] Set build command to `npm install && npm run build`.
- [ ] Set publish directory to `dist`.
- [ ] Add `VITE_SUPABASE_URL`.
- [ ] Add `VITE_SUPABASE_ANON_KEY`.
- [ ] Confirm the SPA rewrite: `/*` → `/index.html`.
- [ ] Deploy the site.

## Role testing

- [ ] Parent redirects to `/parent/dashboard`.
- [ ] Registration Office redirects to `/office/dashboard`.
- [ ] Tuition Office redirects to `/tuition-admin/dashboard`.
- [ ] School Management redirects to `/management/dashboard`.
- [ ] Super Admin redirects to `/admin/dashboard`.
- [ ] Parent cannot access another family.
- [ ] Registration Office cannot access tuition-only admin actions.
- [ ] Tuition Office cannot access confidential medical documents or medical internal notes.
- [ ] School Management cannot write protected data.
- [ ] Super Admin can access Users & Access.

## Auth testing

- [ ] Email/password login works.
- [ ] Forgot password email sends.
- [ ] Reset password works at `/reset-password`.
- [ ] Invitation flow works at `/accept-invitation`.
- [ ] Logout works.
- [ ] Session persists after refresh.
- [ ] Disabled account is blocked.
- [ ] Pending or invited account is blocked until activated.

## Final security check

- [ ] No service-role key is in GitHub.
- [ ] No `.env` or `.env.local` file is committed.
- [ ] Render has only the public anon key.
- [ ] Storage buckets are private.
- [ ] Direct URL access cannot bypass frontend route guards.
- [ ] RLS blocks unauthorized database access.
