# Production Checklist

## Environment

- [x] Supabase project connected.
- [x] Render site connected.
- [x] `VITE_SUPABASE_URL` configured.
- [x] `VITE_SUPABASE_ANON_KEY` configured.
- [x] Service-role key kept out of frontend.
- [ ] Production email provider configured.
- [ ] All Auth redirect URLs verified after final domain setup.

## Database and security

- [x] Core migrations applied through `202607270003`.
- [x] RLS enabled on sensitive tables.
- [x] Private storage buckets configured.
- [ ] Parent-family access tested with two separate parent accounts.
- [x] Parent portal data loader scoped to active `family_users` links.
- [ ] Tuition Office confidential-medical restriction tested.
- [ ] Disabled account stale-session behavior tested.
- [ ] Storage signed URL behavior tested.

## Application workflows

- [x] Registration wizard saves progress/steps to Supabase.
- [x] Family creation started.
- [x] Student creation started.
- [x] User invitation Edge Function exists.
- [x] User role/status management wired to Edge Function.
- [ ] Parent registration can be completed end to end.
- [ ] Documents can be uploaded/reviewed/downloaded end to end.
- [ ] Agreements can be signed and stored end to end.
- [ ] Tuition ledger is functional end to end.
- [ ] Reports are operationally complete.

## Testing

- [x] Latest local lint/build run before commit.
- [ ] Automated tests added.
- [ ] All five roles tested in deployed app.
- [ ] Mobile layouts tested.
- [ ] Browser console checked on every main route.
- [ ] Render deployment verified after latest commit.
