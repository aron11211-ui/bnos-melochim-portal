# Bnos Melochim Production Setup

Final production route:

- GitHub stores the source code and version history.
- Supabase provides authentication, PostgreSQL, Row Level Security, private document storage, password recovery, invitations, and permissions.
- Render hosts the React/Vite production site as a Static Site.

Do not put Supabase service-role keys in this React app.

## 1. Create the Supabase project

1. Sign in to Supabase.
2. Create a new project.
3. Choose a strong database password and store it securely.
4. Wait until the project finishes provisioning.

## 2. Find the Supabase Project URL

In Supabase:

1. Open the project.
2. Go to Project Settings → API.
3. Copy the Project URL.

It looks like:

```text
https://YOUR-PROJECT-REF.supabase.co
```

## 3. Find the Supabase anon key

In Project Settings → API, copy the public `anon` key.

Use only the anon key in the frontend. Never use the service-role key in GitHub, Render client env vars, or browser code.

## 4. Add local environment variables

Create `.env.local` from `.env.example`:

```bash
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

`.env`, `.env.*`, and `.env.local` are ignored by git.

## 5. Link the Supabase CLI

Install and sign in to the Supabase CLI, then from this repository run:

```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF
```

## 6. Run migrations

From the repository root:

```bash
supabase db push
```

This applies:

1. `supabase/migrations/202607260001_initial_schema.sql`
2. `supabase/migrations/202607260002_rls_and_storage.sql`

The migrations create the tables, foreign keys, indexes, triggers, RLS policies, audit helper, and private storage buckets.

## 7. Create the first Super Admin

In Supabase Dashboard:

1. Go to Authentication → Users.
2. Create the owner/admin user.
3. Copy the new Auth user UUID.
4. Open SQL Editor and run:

```sql
insert into public.profiles (id, email, first_name, last_name, role, status)
values (
  'AUTH_USER_UUID_HERE',
  'admin@bnosmelochim.org',
  'School',
  'Admin',
  'super_admin',
  'active'
);
```

Only a trusted owner should create this first row. After that, use the Super Admin account for staff access management.

## 8. Deploy Supabase Edge Functions for invitations and access management

The repository includes server-side Edge Functions:

- `invite-user`
- `update-user-access`

These functions use the service-role key only inside Supabase. Set secrets in Supabase, not in Render:

```bash
supabase secrets set SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
supabase functions deploy invite-user
supabase functions deploy update-user-access
```

Do not put `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`, GitHub, or Render.

## 9. Configure Supabase Site URL

In Supabase:

1. Go to Authentication → URL Configuration.
2. Set Site URL to the Render production URL after Render gives it to you.

Example:

```text
https://bnos-melochim-portal.onrender.com
```

## 10. Configure Supabase redirect URLs

Add these redirect URLs:

```text
http://localhost:5173/login
http://localhost:5173/reset-password
http://localhost:5173/accept-invitation
https://YOUR-RENDER-URL/login
https://YOUR-RENDER-URL/reset-password
https://YOUR-RENDER-URL/accept-invitation
```

Password recovery should redirect to `/reset-password`.

Invitations should redirect to `/accept-invitation`.

## 11. Connect GitHub to Render

1. Push this repository to GitHub.
2. In Render, choose New → Static Site.
3. Connect the GitHub repository.
4. Select the production branch, usually `main`.

This local repo currently has only the previous Sites remote configured, so add your GitHub remote before pushing:

```bash
git remote add origin https://github.com/YOUR-ORG/YOUR-REPO.git
git push -u origin main
```

## 12. Add Render environment variables

In Render → Static Site → Environment, add:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Do not add the service-role key.

## 13. Add the Render SPA rewrite

The repository includes `render.yaml` with:

- Build command: `npm install && npm run build`
- Publish directory: `dist`
- Rewrite:
  - Source: `/*`
  - Destination: `/index.html`
  - Action: Rewrite

If configuring manually in the Render dashboard, add the same rewrite rule.

## 14. Deploy the site

Deploy from Render after the GitHub repo is connected and environment variables are saved.

The app should not be considered live until:

- Supabase credentials are configured.
- Migrations are applied.
- Render deployment succeeds.
- Login and role testing passes.

## 15. Test all five roles

Create one test user per role and matching `profiles` row:

- `parent`
- `registration_office`
- `tuition_office`
- `school_management`
- `super_admin`

Expected redirects:

- `parent` → `/parent/dashboard`
- `registration_office` → `/office/dashboard`
- `tuition_office` → `/tuition-admin/dashboard`
- `school_management` → `/management/dashboard`
- `super_admin` → `/admin/dashboard`

Also verify:

- Parent users are connected to a family through `family_users`.
- Parents cannot see another family by changing URLs.
- Registration Office can manage registration, documents, admissions, and agreements.
- Tuition Office can manage tuition, invoices, payments, receipts, and payment plans.
- Tuition Office cannot read medical document bucket objects or medical internal notes.
- School Management can read dashboards/reports but cannot write through RLS.
- Super Admin can manage profiles, staff permissions, and settings.
- Disabled, invited, and pending-verification accounts cannot enter the portal.
- Password reset returns to `/reset-password`.
- Invitation links return to `/accept-invitation`.
- Storage buckets are private and files require authorized access.
