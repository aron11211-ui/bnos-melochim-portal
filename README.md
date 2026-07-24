# School Registration & Tuition Management System

A professional Phase 1 web application for a new private school. The system is organized around families, with support for multiple parents/guardians and multiple children per family.

## Project purpose

The application gives parents and school staff one place to manage:

- Family and student registration
- Annual enrollment and onboarding
- Required document tracking and review
- Parent agreements and acknowledgments
- Preschool and medical forms
- Tuition charges, payment plans, invoices, receipts, and balances
- Office review, admissions status, dashboards, and reports

## Tech stack

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Local demo data and local React state
- Component/data structure prepared for future Supabase integration

No Stripe, Supabase, or external services are connected in this phase.

## Installation

```bash
npm install
```

## Run locally

```bash
npm run dev
```

Then open the local Vite URL, usually:

```text
http://127.0.0.1:5173
```

## Build

```bash
npm run build
```

## Current features

- Demo role selector for Parent, School Office, Tuition Administrator, and School Management
- Responsive layout with desktop sidebar and mobile navigation menu
- Parent portal:
  - Dashboard
  - My Family editable profile
  - My Children cards and student detail pages
  - Multi-step registration wizard with simulated autosave and validation
  - Required document checklist with all requested statuses
  - Agreements with simulated typed-name signature flow
  - Tuition, payments, messages, and settings
- Administrator portal:
  - Dashboard metrics and visual summaries
  - Families table with search and filters
  - Family detail page with tabs/summary
  - Students table and student detail page
  - Registration queue
  - Document review queue with approve/reject/request/waive actions
  - Admissions review status updates
  - Tuition administration actions that update local state
  - Payments and collection notes
  - Reports with CSV export
- Demo data:
  - 8 families
  - 18 students
  - Multiple grades and programs
  - Mixed document statuses
  - Current, overdue, discounted, scholarship, credit, and custom-plan tuition examples

## Planned Supabase integration

Recommended next data tables:

- families
- guardians
- students
- emergency_contacts
- documents
- document_requirements
- agreements
- agreement_acknowledgments
- tuition_accounts
- tuition_charges
- invoices
- receipts
- payments
- collection_notes
- messages
- activity_history

Recommended Supabase work:

- Add authentication and role-based row-level security
- Replace local demo state with repository/service functions
- Persist wizard progress and document review events
- Store document files in Supabase Storage
- Add audit trails for staff actions

## Planned Stripe integration

Stripe should be added only in a later phase.

Recommended approach:

- Use Stripe Checkout or Payment Element for secure payment collection
- Store only Stripe customer/payment-method references, never full card numbers
- Use webhooks for payment status, failed payments, receipts, and invoice reconciliation
- Keep tuition ledger records in the application database
- Add staff controls for manual payments and offline adjustments

## Security considerations

- Do not store full payment card numbers
- Use role-based access control for parent, office, tuition, and management users
- Limit parent access to their own family records only
- Restrict medical details for tuition-only users
- Add audit logs for document decisions, admissions decisions, and tuition adjustments
- Validate all form inputs on both client and server once a backend is introduced
- Use signed URLs or scoped storage access for uploaded documents

## Recommended next steps

1. Split the current Phase 1 data model into Supabase-ready service modules.
2. Add authentication and persistent user sessions.
3. Add real file upload and document preview.
4. Add deeper field-level validation to the registration wizard.
5. Add role-specific route guards backed by server-side authorization.
6. Integrate Stripe after tuition ledger and invoice rules are finalized.
