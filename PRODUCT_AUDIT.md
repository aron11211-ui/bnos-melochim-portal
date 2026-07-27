# Bnos Melochim Product Audit

Last updated: July 27, 2026

## Working or mostly working

- Authentication is connected to Supabase Auth.
- Role-based app routing exists for Parent Portal, Registration Office, Tuition Office, School Management, and System Administration.
- Supabase schema includes core school tables for families, students, registrations, registration steps, documents, agreements, tuition accounts, payments, notes, notifications, audit logs, settings, and private storage buckets.
- RLS is enabled on the sensitive public tables.
- Parent registration wizard now writes progress and section snapshots to Supabase.
- Staff can create family records and student records from the portal.
- System Administration can invite users through an Edge Function.
- System Administration can now update role/status through the access-management Edge Function.
- Render hosting and Supabase environment variables are configured.

## Partially working

- Registration wizard saves each step, but the steps still need full editable forms and validation.
- Documents can be approved/rejected/waived in UI state, but file upload/preview/download is not fully connected to private Supabase Storage.
- Agreements can be marked signed in UI state, but signed agreement persistence and signed-copy generation are not complete.
- Tuition screens show balances and allow simulated changes, but ledger-grade charges, payments, reversals, receipts, and plans are not fully persisted.
- Reports export simple CSV summaries, but reports are not yet backed by robust query/filter/export logic.
- Settings screens are useful structure, but most settings are not persisted to `school_settings`.
- Messages display notifications, but replies and email delivery are not implemented.

## Broken or high-risk gaps

- Important buttons still display simulated success messages instead of completing a database-backed workflow.
- Local fallback `demoState` remains in the production bundle and can mask missing Supabase data.
- Parent family selection currently defaults to the first loaded family; it must be tied to the logged-in user's `family_users` relationship.
- User invitation/password setup has had reliability problems and needs full end-to-end retesting with fresh accounts.
- Direct route refresh depends on Render SPA rewrite being correct.
- Mobile tables still rely heavily on horizontal scrolling instead of true mobile cards.

## Placeholder or not complete

- Document preview, upload progress, secure download, and replacement history.
- Tuition payment method flow.
- Access-management family assignment/removal.
- Resend/revoke invitation.
- Audit-log viewer.
- System health page.
- Email templates and delivery provider integration.
- Automated browser tests.

## Security risks to continue reviewing

- Verify parent access is filtered by actual family linkage, not loaded app state.
- Verify Tuition Office cannot access confidential medical documents.
- Verify disabled accounts cannot continue using stale sessions.
- Verify storage object policies with real uploads.
- Verify every Edge Function validates caller role and request body.
- Verify no service-role key is ever exposed to frontend, Render static env, or GitHub.

## UX/design issues

- Some screens are dense tables and need mobile-friendly card layouts.
- Several messages still use generic wording.
- Some staff workflows require jumping between pages instead of using one review workspace.
- Empty/loading/error states are inconsistent across modules.
- Large bundle warning remains; route-level code splitting should be considered.
