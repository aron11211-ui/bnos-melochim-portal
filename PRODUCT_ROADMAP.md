# Bnos Melochim Portal Product Roadmap

This application is now positioned as a production school operations portal, not a demo. The goal is to keep the current branding and layout while turning each module into a reliable, database-backed workflow.

## Product principles

- Parents should always know what is missing, what is done, and what to do next.
- Office staff should be able to move families through registration without using spreadsheets.
- Tuition staff should see financial information without unnecessary medical or confidential registration details.
- School management should get high-level visibility without accidentally changing operational data.
- Super Admin should control users, permissions, settings, and security-sensitive actions.

## Phase 1 — Stability and usability foundation

- Friendly error recovery instead of blank screens.
- Clear active navigation and mobile menu behavior.
- Useful account and school settings screens.
- Better empty states, loading states, and action confirmations.
- Consistent date, money, status, and table behavior.
- Safer invite and password setup experience.

## Phase 2 — Real database-backed family operations

- Replace remaining demo family/student/document/tuition state with Supabase reads and writes. *(In progress: loader now normalizes Supabase families, students, documents, agreements, tuition accounts, and notifications.)*
- Add linked parent-family selection for parent accounts.
- Add create/edit/archive flows for families. *(Started: staff can create family records from the portal.)*
- Add create/edit student profiles. *(Started: Registration Office and Super Admin can create student records from the portal.)*
- Add audit logs for family/student changes.
- Add duplicate checking for emails, family codes, and student records.

## Phase 3 — Registration workflow

- Store each registration section separately.
- Add autosave, section validation, and completion tracking.
- Support multiple students in one family registration.
- Add staff review notes, internal-only flags, and request-correction flows.
- Add final submission and admissions-review handoff.

## Phase 4 — Documents and private storage

- Connect document uploads to private Supabase Storage.
- Add signed download URLs with RLS checks.
- Add document replacement, approval, rejection, waiver, expiration, and review history.
- Add per-student and per-family document requirements.
- Add staff-only comments and parent-facing rejection reasons.

## Phase 5 — Tuition and agreements

- Add tuition account tables, charge schedules, discounts, scholarships, and payment plans.
- Add agreement templates and typed/e-sign acknowledgments.
- Add invoice/statement generation.
- Add payment records and receipts.
- Keep Stripe disconnected until the owner approves payment processing.

## Phase 6 — Communications and reporting

- Add internal notes, parent messages, staff assignment, and notification preferences.
- Add operational reports for enrollment, missing documents, admissions status, and tuition aging.
- Add export permissions by role.
- Add dashboard alerts for overdue items and staff queues.

## Phase 7 — Polish and scale

- Full Yiddish/RTL-ready translation architecture.
- More robust mobile layouts for tables and long forms.
- Advanced search and filters.
- Activity timeline on family and student records.
- End-to-end tests for all five roles.
