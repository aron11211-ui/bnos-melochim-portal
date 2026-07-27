# Remaining Work

## Critical next work

- Fully retest invitation acceptance and password setup using fresh Parent, Registration Office, Tuition Office, School Management, and System Administration accounts.
- Live-test Parent Portal family scoping with two separate parent accounts after creating active family links.
- Make each registration wizard step a real editable form with validation.
- Persist parent family-profile edits to Supabase.
- Persist document review actions to Supabase.
- Implement private document upload/preview/download with Supabase Storage.
- Persist agreement signatures to Supabase, including signer relationship, timestamp, user agent, and signed-copy generation.
- Replace tuition simulated mutations with a real ledger workflow.

## Important but later

- Resend/revoke invitations.
- Assign/remove parent family access from Users & Access.
- Audit-log viewer.
- School settings persistence.
- In-app notification center.
- Email provider integration.
- PDF/print reports.
- Automated Playwright end-to-end tests.
- Mobile card layouts for all large tables.
- Route-level code splitting.

## Manual owner actions still needed

- Keep Supabase Auth redirect URLs updated for production and localhost.
- Configure a reliable email provider for production invitations/password recovery when ready.
- Confirm Render SPA rewrite is active.
- Provide real school policy/agreement wording.
- Decide when payment processor integration should begin.
