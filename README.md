# Bnos Melochim Registration & Tuition Portal

A professional private-school family portal for registration, required documents, agreements, tuition, and office workflows.

## Tech stack

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Supabase Auth, database, RLS, and private storage
- Render Static Site deployment

Stripe is intentionally not connected yet.

## Installation

```bash
npm install
```

Copy `.env.example` to `.env.local` and add the Supabase project URL and anon key.

## Run locally

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

## Build

```bash
npm run build
```

## Portal access

Users sign in with email and password. Roles are assigned in Supabase; users do not choose their own role.

- `parent` → `/parent/dashboard`
- `registration_office` → `/office/dashboard`
- `tuition_office` → `/tuition-admin/dashboard`
- `school_management` → `/management/dashboard`
- `super_admin` → `/admin/dashboard`

See [SETUP.md](./SETUP.md) for Supabase setup, migrations, first super admin creation, redirect URLs, storage buckets, and secure deployment notes.

## Render deployment

The repository includes `render.yaml` for a Render Static Site:

- Build command: `npm install && npm run build`
- Publish directory: `dist`
- SPA rewrite: `/*` → `/index.html`

Set only these frontend environment variables in Render:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
