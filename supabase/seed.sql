-- Optional non-auth seed data for local testing.
-- Create Auth users first, then update profiles/family_users with their UUIDs.

insert into public.school_years (id, label, hebrew_label, starts_on, ends_on, is_current)
values ('11111111-1111-1111-1111-111111111111','2026-2027','תשפ״ז','2026-08-01','2027-06-30',true)
on conflict (id) do nothing;

insert into public.families (id, family_code, family_name, primary_email, primary_phone, address_line1, city, state, postal_code, registration_status)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','FAM-1001','Friedman Family','parent.friedman@example.com','732-555-0180','144 Forest Avenue','Lakewood','NJ','08701','in_progress'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','FAM-1002','Levy Family','parent.levy@example.com','732-555-0131','27 Pine Street','Lakewood','NJ','08701','submitted')
on conflict (id) do nothing;

insert into public.students (id, family_id, preferred_name, legal_name, date_of_birth, grade, program, registration_status, document_status, tuition_status, transportation)
values
  ('aaaaaaaa-0001-0001-0001-aaaaaaaa0001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Miri','Miriam Friedman','2019-03-12','Pre-K','Preschool','in_progress','missing','current','Parent pickup'),
  ('aaaaaaaa-0002-0002-0002-aaaaaaaa0002','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Chani','Chana Friedman','2017-11-05','1','Elementary','accepted','approved','current','Bus route A'),
  ('bbbbbbbb-0001-0001-0001-bbbbbbbb0001','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Rivky','Rivka Levy','2020-06-20','Nursery','Preschool','submitted','uploaded','arrangement','Parent pickup')
on conflict (id) do nothing;

insert into public.registrations (id, family_id, school_year_id, status, percent_complete, completed_sections, remaining_items)
values
  ('aaaaaaaa-1111-1111-1111-aaaaaaaa1111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','in_progress',58,7,5),
  ('bbbbbbbb-1111-1111-1111-bbbbbbbb1111','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','11111111-1111-1111-1111-111111111111','submitted',82,10,2)
on conflict (id) do nothing;

insert into public.document_requirements (id, school_year_id, name, category, applies_to, due_on, required)
values
  ('dddddddd-0001-0001-0001-dddddddd0001','11111111-1111-1111-1111-111111111111','Birth certificate','Registration','student','2026-08-01',true),
  ('dddddddd-0002-0002-0002-dddddddd0002','11111111-1111-1111-1111-111111111111','Emergency medical consent','Medical','student','2026-08-10',true),
  ('dddddddd-0003-0003-0003-dddddddd0003','11111111-1111-1111-1111-111111111111','Tuition agreement','Tuition','family','2026-08-15',true)
on conflict (id) do nothing;

insert into public.tuition_accounts (id, family_id, school_year_id, annual_tuition, fees, transportation, registration_fee, discounts, scholarships, credits, paid, plan_name, next_due_on, next_due_amount)
values
  ('aaaaaaaa-2222-2222-2222-aaaaaaaa2222','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111',24500,875,1200,350,1000,2500,0,4200,'10 monthly payments','2026-08-01',2193),
  ('bbbbbbbb-2222-2222-2222-bbbbbbbb2222','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','11111111-1111-1111-1111-111111111111',11200,500,0,350,0,1500,0,1800,'Custom arrangement','2026-08-15',875)
on conflict (id) do nothing;
