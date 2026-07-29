import { Component, useEffect, useMemo, useState } from "react";
import type { ErrorInfo, FormEvent, ReactNode } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  Download,
  Eye,
  EyeOff,
  FileCheck2,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Search,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import type { AppRole, Profile } from "./lib/supabase";
import "./App.css";

type Role = AppRole;
type AccountStatus = "active" | "invited" | "disabled" | "pending_verification";
type DocStatus =
  | "Not Started"
  | "Missing"
  | "Uploaded"
  | "Under Review"
  | "Approved"
  | "Rejected"
  | "Expired"
  | "Waived";
type RegistrationStatus =
  | "Not Started"
  | "In Progress"
  | "Submitted"
  | "Incomplete"
  | "Under Review"
  | "Interview Required"
  | "Accepted"
  | "Waitlisted"
  | "Declined"
  | "Contract Pending"
  | "Deposit Pending"
  | "Fully Enrolled";

type ParentGuardian = {
  name: string;
  relationship: string;
  phone: string;
  email: string;
  employer: string;
};

type Student = {
  id: string;
  familyId: string;
  preferredName: string;
  legalName: string;
  dob: string;
  grade: string;
  gender: string;
  program: string;
  newReturning: "New" | "Returning";
  registrationStatus: RegistrationStatus;
  documentStatus: DocStatus;
  tuitionStatus: "Current" | "Overdue" | "Arrangement" | "Credit";
  medicalAlerts: string;
  previousSchool: string;
  physicianName: string;
  physicianPhone: string;
  emergencyInfo: string;
  authorizedPickup: string;
  transportation: string;
  progress: number;
};

type DocumentItem = {
  id: string;
  familyId: string;
  studentId?: string;
  type: string;
  category: string;
  status: DocStatus;
  uploadDate?: string;
  rejectionReason?: string;
  staffNote?: string;
};

type Agreement = {
  id: string;
  familyId: string;
  title: string;
  status: "Awaiting Signature" | "Signed" | "Reviewed";
  version: string;
  dateReviewed?: string;
  signer?: string;
};

type TuitionAccount = {
  familyId: string;
  annualTuition: number;
  fees: number;
  transportation: number;
  registration: number;
  discounts: number;
  scholarships: number;
  credits: number;
  paid: number;
  plan: "Annual payment" | "10 monthly payments" | "12 monthly payments" | "Custom arrangement";
  nextDue: string;
  failedPayments: number;
  collectionNotes: string[];
};

type Family = {
  id: string;
  dbId?: string;
  code?: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  shul: string;
  emergencyContacts: string[];
  maternalGrandparents: string;
  paternalGrandparents: string;
  parents: ParentGuardian[];
  status: RegistrationStatus;
  registrationPercent: number;
};

type AppState = {
  families: Family[];
  students: Student[];
  documents: DocumentItem[];
  agreements: Agreement[];
  tuition: TuitionAccount[];
  messages: { id: string; familyId: string; subject: string; body: string; date: string }[];
};

type NavItem = { label: string; path: string; icon: LucideIcon };

class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Portal screen failed", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="grid min-h-screen place-items-center bg-ivory px-6">
          <Card className="max-w-xl text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-700">
              <AlertCircle aria-hidden="true" />
            </div>
            <h1 className="mt-4 text-2xl font-bold text-navy">Something needs a quick refresh</h1>
            <p className="mt-2 text-slate-600">The portal hit a screen error, but your account is safe. Refresh the page and continue where you left off.</p>
            <button className="mt-5 rounded-xl bg-navy px-5 py-3 font-bold text-white hover:bg-burgundy" onClick={() => window.location.reload()}>
              Refresh portal
            </button>
          </Card>
        </main>
      );
    }
    return this.props.children;
  }
}

const roleLabels: Record<Role, string> = {
  parent: "Parent Portal",
  registration_office: "Registration Office",
  tuition_office: "Tuition Office",
  school_management: "School Management",
  super_admin: "System Administration",
};

const accountStatusLabels: Record<AccountStatus, string> = {
  active: "Active",
  invited: "Invited",
  disabled: "Disabled",
  pending_verification: "Pending verification",
};

const roleDescriptions: Record<Role, string> = {
  parent: "Family registration, documents, tuition, and messages",
  registration_office: "Applications, student records, documents, and agreements",
  tuition_office: "Tuition accounts, invoices, payments, and notes",
  school_management: "Read-only dashboards, reports, and school-wide oversight",
  super_admin: "Full system administration, users, roles, and settings",
};

const emptyFamily: Family = {
  id: "no-family-linked",
  dbId: "no-family-linked",
  code: "no-family-linked",
  name: "No family linked",
  address: "",
  city: "",
  state: "",
  zip: "",
  phone: "",
  email: "",
  shul: "",
  emergencyContacts: [],
  maternalGrandparents: "",
  paternalGrandparents: "",
  parents: [],
  status: "Not Started",
  registrationPercent: 0,
};

const docTypes = [
  "Registration form",
  "Birth certificate",
  "Parent identification",
  "Proof of address",
  "Immunization record",
  "Universal Child Health Record",
  "Previous school records",
  "Emergency Medical Consent",
  "Authorized Pickup Form",
  "Transportation Agreement",
  "Field Trip Permission",
  "Supervised Walk Authorization",
  "Medication Policy Acknowledgment",
  "Parent Record Checklist",
  "Tuition Agreement",
];

const agreementTitles = [
  "Parent handbook",
  "Release of children policy",
  "Expulsion policy",
  "Technology and social media policy",
  "Communicable disease policy",
  "Parent notification policy",
  "Transportation acknowledgment",
  "Emergency medical consent",
  "Field-trip permission",
  "Supervised-walk permission",
  "Tuition agreement",
];

const familyNames = [
  "Friedman",
  "Levy",
  "Rosenberg",
  "Klein",
  "Weiss",
  "Stein",
  "Gross",
  "Miller",
];

const initialFamilies: Family[] = familyNames.map((name, index) => ({
  id: `FAM-${1001 + index}`,
  name,
  address: `${18 + index * 7} Maple Terrace`,
  city: index % 2 ? "Lakewood" : "Brooklyn",
  state: index % 2 ? "NJ" : "NY",
  zip: index % 2 ? "08701" : "11219",
  phone: `(732) 555-01${index}0`,
  email: `${name.toLowerCase()}family@example.com`,
  shul: ["Bais Tefillah", "Ohr Chaim", "Ateres Shalom", "Khal Zichron Moshe"][index % 4],
  emergencyContacts: [`Aunt ${name} - (732) 555-22${index}0`, `Neighbor Cohen - (732) 555-33${index}1`],
  maternalGrandparents: `${["Gold", "Rubin", "Adler", "Katz"][index % 4]} grandparents`,
  paternalGrandparents: `${["Fried", "Schwartz", "Singer", "Baum"][index % 4]} grandparents`,
  parents: [
    {
      name: `Mr. ${name}`,
      relationship: "Father / guardian",
      phone: `(732) 555-10${index}0`,
      email: `father.${name.toLowerCase()}@example.com`,
      employer: ["Evergreen Accounting", "Torah Tech", "Maple Medical", "Sterling Supply"][index % 4],
    },
    {
      name: `Mrs. ${name}`,
      relationship: "Mother / guardian",
      phone: `(732) 555-11${index}0`,
      email: `mother.${name.toLowerCase()}@example.com`,
      employer: ["Home", "Bnos Office", "Bright Path Therapy", "Cedar Design"][index % 4],
    },
  ],
  status: [
    "In Progress",
    "Submitted",
    "Fully Enrolled",
    "Incomplete",
    "Under Review",
    "Accepted",
    "Contract Pending",
    "Deposit Pending",
  ][index] as RegistrationStatus,
  registrationPercent: [58, 82, 100, 41, 75, 93, 68, 88][index],
}));

const initialStudents: Student[] = [
  ["s1", "FAM-1001", "Miri", "Miriam Friedman", "2019-03-12", "Pre-K", "Female", "Preschool", "New", "In Progress", "Missing", "Current", "Peanut allergy", "Parent pickup", 58],
  ["s2", "FAM-1001", "Chani", "Chana Friedman", "2016-09-05", "2", "Female", "Elementary", "Returning", "Submitted", "Under Review", "Current", "None", "Bus Route A", 78],
  ["s3", "FAM-1002", "Rivky", "Rivka Levy", "2020-06-20", "Nursery", "Female", "Preschool", "New", "Submitted", "Uploaded", "Arrangement", "Asthma inhaler", "Parent pickup", 82],
  ["s4", "FAM-1002", "Esti", "Esther Levy", "2015-02-17", "3", "Female", "Elementary", "Returning", "Under Review", "Approved", "Arrangement", "None", "Bus Route B", 86],
  ["s5", "FAM-1003", "Tova", "Tova Rosenberg", "2018-12-02", "Kindergarten", "Female", "Elementary", "Returning", "Fully Enrolled", "Approved", "Current", "None", "Bus Route C", 100],
  ["s6", "FAM-1003", "Suri", "Sarah Rosenberg", "2014-04-28", "4", "Female", "Elementary", "Returning", "Fully Enrolled", "Approved", "Current", "EpiPen", "Bus Route C", 100],
  ["s7", "FAM-1003", "Bracha", "Bracha Rosenberg", "2012-11-18", "6", "Female", "Middle School", "Returning", "Fully Enrolled", "Approved", "Current", "None", "Carpool", 100],
  ["s8", "FAM-1004", "Leah", "Leah Klein", "2019-07-30", "Pre-K", "Female", "Preschool", "New", "Incomplete", "Rejected", "Overdue", "Dairy sensitivity", "Parent pickup", 41],
  ["s9", "FAM-1004", "Goldie", "Golda Klein", "2017-01-21", "1", "Female", "Elementary", "New", "Incomplete", "Missing", "Overdue", "None", "Parent pickup", 39],
  ["s10", "FAM-1005", "Hindy", "Hinda Weiss", "2020-10-10", "Nursery", "Female", "Preschool", "New", "Under Review", "Under Review", "Current", "None", "Bus Route A", 73],
  ["s11", "FAM-1005", "Raizy", "Rachel Weiss", "2013-05-09", "5", "Female", "Elementary", "Returning", "Accepted", "Approved", "Current", "None", "Bus Route A", 91],
  ["s12", "FAM-1006", "Faigy", "Faiga Stein", "2018-08-14", "Kindergarten", "Female", "Elementary", "Returning", "Accepted", "Approved", "Credit", "None", "Bus Route B", 95],
  ["s13", "FAM-1006", "Shani", "Shoshana Stein", "2011-03-24", "7", "Female", "Middle School", "Returning", "Accepted", "Approved", "Credit", "Gluten free", "Bus Route B", 92],
  ["s14", "FAM-1007", "Malka", "Malka Gross", "2021-01-02", "Toddler", "Female", "Preschool", "New", "Contract Pending", "Uploaded", "Arrangement", "None", "Parent pickup", 69],
  ["s15", "FAM-1007", "Dina", "Dina Gross", "2016-12-13", "2", "Female", "Elementary", "New", "Interview Required", "Missing", "Arrangement", "None", "Parent pickup", 56],
  ["s16", "FAM-1008", "Ruchi", "Ruchama Miller", "2019-09-22", "Pre-K", "Female", "Preschool", "Returning", "Deposit Pending", "Approved", "Overdue", "None", "Bus Route C", 84],
  ["s17", "FAM-1008", "Tehila", "Tehila Miller", "2015-06-16", "3", "Female", "Elementary", "Returning", "Accepted", "Approved", "Overdue", "None", "Bus Route C", 89],
  ["s18", "FAM-1008", "Adina", "Adina Miller", "2010-02-07", "8", "Female", "Middle School", "Returning", "Fully Enrolled", "Approved", "Current", "None", "Walk authorization", 98],
].map(([id, familyId, preferredName, legalName, dob, grade, gender, program, newReturning, registrationStatus, documentStatus, tuitionStatus, medicalAlerts, transportation, progress]) => ({
  id: id as string,
  familyId: familyId as string,
  preferredName: preferredName as string,
  legalName: legalName as string,
  dob: dob as string,
  grade: grade as string,
  gender: gender as string,
  program: program as string,
  newReturning: newReturning as Student["newReturning"],
  registrationStatus: registrationStatus as RegistrationStatus,
  documentStatus: documentStatus as DocStatus,
  tuitionStatus: tuitionStatus as Student["tuitionStatus"],
  medicalAlerts: medicalAlerts as string,
  previousSchool: "",
  physicianName: "",
  physicianPhone: "",
  emergencyInfo: "",
  authorizedPickup: "Parents and listed guardians",
  transportation: transportation as string,
  progress: Number(progress),
}));

const demoState: AppState = {
  families: initialFamilies,
  students: initialStudents,
  documents: initialFamilies.flatMap((family, familyIndex) =>
    docTypes.map((type, docIndex) => ({
      id: `${family.id}-DOC-${docIndex}`,
      familyId: family.id,
      studentId: initialStudents.find((s) => s.familyId === family.id)?.id,
      type,
      category: docIndex < 4 ? "Identity" : docIndex < 8 ? "Medical" : docIndex < 12 ? "Permissions" : "Agreements",
      status: (["Approved", "Missing", "Uploaded", "Under Review", "Rejected", "Expired", "Waived", "Not Started"][
        (familyIndex + docIndex) % 8
      ] || "Missing") as DocStatus,
      uploadDate: docIndex % 3 === 0 ? "2026-07-10" : undefined,
      rejectionReason: (familyIndex + docIndex) % 8 === 4 ? "Image is blurry; please upload a clear scan." : undefined,
    })),
  ),
  agreements: initialFamilies.flatMap((family, familyIndex) =>
    agreementTitles.map((title, index) => ({
      id: `${family.id}-AGR-${index}`,
      familyId: family.id,
      title,
      status: index % 3 === familyIndex % 3 ? "Signed" : index % 2 ? "Awaiting Signature" : "Reviewed",
      version: `2026.${(index % 4) + 1}`,
      dateReviewed: index % 3 === familyIndex % 3 ? "2026-07-14" : undefined,
      signer: index % 3 === familyIndex % 3 ? `Mrs. ${family.name}` : undefined,
    })),
  ),
  tuition: initialFamilies.map((family, index) => ({
    familyId: family.id,
    annualTuition: 8200 * initialStudents.filter((student) => student.familyId === family.id).length,
    fees: 650 + index * 35,
    transportation: index % 2 ? 900 : 0,
    registration: 350,
    discounts: index % 3 === 0 ? 700 : 0,
    scholarships: index % 4 === 0 ? 1200 : 0,
    credits: index === 5 ? 450 : 0,
    paid: [2400, 5200, 18800, 900, 6000, 15000, 2100, 4200][index],
    plan: ["10 monthly payments", "Custom arrangement", "Annual payment", "12 monthly payments"][index % 4] as TuitionAccount["plan"],
    nextDue: ["2026-08-01", "2026-08-15", "Paid in full", "2026-07-01"][index % 4],
    failedPayments: index === 3 || index === 7 ? 1 : 0,
    collectionNotes: index === 3 ? ["Called 7/18; family requested revised due date."] : [],
  })),
  messages: [
    { id: "m1", familyId: "FAM-1001", subject: "Welcome packet", body: "Please review preschool arrival instructions.", date: "2026-07-20" },
    { id: "m2", familyId: "FAM-1001", subject: "Document reminder", body: "Birth certificate is still missing for Miri.", date: "2026-07-22" },
    { id: "m3", familyId: "FAM-1008", subject: "Tuition arrangement", body: "The office is reviewing your payment-plan request.", date: "2026-07-18" },
  ],
};

function currency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value?: string) {
  if (!value) return "Not scheduled";
  if (value === "Paid in full") return value;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(date);
}

function total(account: TuitionAccount) {
  return account.annualTuition + account.fees + account.transportation + account.registration - account.discounts - account.scholarships - account.credits;
}

function upcomingPayment(account: TuitionAccount) {
  if (account.nextDue === "Paid in full") return "Paid in full";
  const remaining = Math.max(total(account) - account.paid, 0);
  const divisor = account.plan === "Annual payment" ? 1 : account.plan === "12 monthly payments" ? 12 : account.plan === "10 monthly payments" ? 10 : 6;
  return `${currency(Math.ceil(remaining / divisor))} due ${formatDate(account.nextDue)}`;
}

function emptyPortalState(): AppState {
  return { families: [], students: [], documents: [], agreements: [], tuition: [], messages: [] };
}

async function loadPortalData(client: SupabaseClient, profile: Profile): Promise<AppState> {
  const familyFilter =
    profile.role === "parent"
      ? await client
          .from("family_users")
          .select("family_id")
          .eq("user_id", profile.id)
          .eq("status", "active")
      : null;
  const parentFamilyIds = profile.role === "parent" ? (familyFilter?.data ?? []).map((row: any) => row.family_id).filter(Boolean) : [];

  if (profile.role === "parent" && !parentFamilyIds.length) return emptyPortalState();

  const familiesQuery = client.from("families").select("*").order("family_code");
  const registrationsQuery = client.from("registrations").select("*").order("updated_at", { ascending: false });
  const studentsQuery = client.from("students").select("*").order("legal_name");
  const documentsQuery = client.from("student_documents").select("*");
  const signaturesQuery = client.from("agreement_signatures").select("*");
  const tuitionQuery = client.from("tuition_accounts").select("*");
  const notificationsQuery = client.from("notifications").select("*").order("created_at", { ascending: false });

  const [{ data: families }, { data: registrations }, { data: students }, { data: documents }, { data: agreements }, { data: signatures }, { data: tuitionAccounts }, { data: notifications }] = await Promise.all([
    parentFamilyIds.length ? familiesQuery.in("id", parentFamilyIds) : familiesQuery,
    parentFamilyIds.length ? registrationsQuery.in("family_id", parentFamilyIds) : registrationsQuery,
    parentFamilyIds.length ? studentsQuery.in("family_id", parentFamilyIds) : studentsQuery,
    parentFamilyIds.length ? documentsQuery.in("family_id", parentFamilyIds) : documentsQuery,
    client.from("agreements").select("*").eq("active", true),
    parentFamilyIds.length ? signaturesQuery.in("family_id", parentFamilyIds) : signaturesQuery,
    parentFamilyIds.length ? tuitionQuery.in("family_id", parentFamilyIds) : tuitionQuery,
    parentFamilyIds.length ? notificationsQuery.in("family_id", parentFamilyIds) : notificationsQuery,
  ]);

  const familyCodeById = new Map((families ?? []).map((family: any) => [family.id, family.family_code ?? family.id]));
  const familyCode = (familyId: string) => familyCodeById.get(familyId) ?? familyId;
  const registrationByFamilyId = new Map((registrations ?? []).map((registration: any) => [registration.family_id, registration]));
  const appFamilies: Family[] = (families ?? []).map((family: any) => ({
    id: family.family_code ?? family.id,
    dbId: family.id,
    code: family.family_code ?? family.id,
    name: family.family_name ?? "Family",
    address: family.address_line1 ?? "",
    city: family.city ?? "",
    state: family.state ?? "",
    zip: family.postal_code ?? "",
    phone: family.primary_phone ?? "",
    email: family.primary_email ?? "",
    shul: family.shul ?? "",
    emergencyContacts: Array.isArray(family.emergency_contacts) ? family.emergency_contacts : [],
    maternalGrandparents: family.maternal_grandparents ?? "",
    paternalGrandparents: family.paternal_grandparents ?? "",
    parents: Array.isArray(family.guardians) ? family.guardians : [],
    status: toRegistrationStatus(registrationByFamilyId.get(family.id)?.status ?? family.registration_status),
    registrationPercent: registrationByFamilyId.get(family.id)?.percent_complete ?? family.registration_percent ?? 0,
  }));
  const appTuition: TuitionAccount[] = (tuitionAccounts ?? []).map((account: any) => ({
    familyId: familyCode(account.family_id),
    annualTuition: account.annual_tuition ?? 0,
    fees: account.fees ?? 0,
    transportation: account.transportation ?? 0,
    registration: account.registration_fee ?? 0,
    discounts: account.discounts ?? 0,
    scholarships: account.scholarships ?? 0,
    credits: account.credits ?? 0,
    paid: account.paid ?? 0,
    plan: account.plan_name ?? "Custom arrangement",
    nextDue: account.next_due_on ?? "",
    failedPayments: account.failed_payments ?? 0,
    collectionNotes: Array.isArray(account.collection_notes) ? account.collection_notes : [],
  }));
  const tuitionByFamily = new Set(appTuition.map((account) => account.familyId));
  const completeTuition = [
    ...appTuition,
    ...appFamilies.filter((family) => !tuitionByFamily.has(family.id)).map((family) => zeroTuitionAccount(family.id)),
  ];

  return {
    families: appFamilies,
    students: (students ?? []).map((student: any) => ({
      id: student.id,
      familyId: familyCode(student.family_id),
      preferredName: student.preferred_name ?? student.legal_name ?? "Student",
      legalName: student.legal_name ?? student.preferred_name ?? "Student",
      dob: student.date_of_birth ?? "",
      grade: student.grade ?? "",
      gender: student.gender ?? "",
      program: student.program ?? "",
      newReturning: student.new_returning === "Returning" ? "Returning" : "New",
      registrationStatus: toRegistrationStatus(student.registration_status),
      documentStatus: toDocStatus(student.document_status),
      tuitionStatus: toTuitionStatus(student.tuition_status),
      medicalAlerts: student.medical_alerts ?? "None",
      previousSchool: student.previous_school ?? "",
      physicianName: student.physician_name ?? "",
      physicianPhone: student.physician_phone ?? "",
      emergencyInfo: student.emergency_info ?? "",
      authorizedPickup: Array.isArray(student.authorized_pickup) ? student.authorized_pickup.join(", ") : "",
      transportation: student.transportation ?? "",
      progress: student.progress ?? 0,
    })),
    documents: (documents ?? []).map((doc: any) => ({
      id: doc.id,
      familyId: familyCode(doc.family_id ?? ""),
      studentId: doc.student_id ?? undefined,
      type: doc.name ?? doc.document_type ?? "Document",
      category: doc.category ?? "Registration",
      status: toDocStatus(doc.status),
      uploadDate: doc.uploaded_at ?? undefined,
      rejectionReason: doc.rejection_reason ?? undefined,
      staffNote: doc.staff_note ?? undefined,
    })),
    agreements: (agreements ?? []).flatMap((agreement: any) => {
      const familyTargets = appFamilies.length ? appFamilies : [emptyFamily];
      return familyTargets.map((family) => {
        const signature = (signatures ?? []).find((item: any) => item.agreement_id === agreement.id && familyCode(item.family_id) === family.id);
        return {
        id: `${agreement.id}:${family.id}`,
        familyId: family.id,
        title: agreement.title ?? "Agreement",
        status: signature ? "Signed" : "Awaiting Signature",
        version: agreement.version ?? "1.0",
        dateReviewed: signature?.signed_at,
        signer: signature?.signer_name,
      };
      });
    }),
    tuition: completeTuition,
    messages: (notifications ?? []).map((note: any) => ({
      id: note.id,
      familyId: familyCode(note.family_id ?? ""),
      subject: note.title ?? "Notification",
      body: note.body ?? "",
      date: note.created_at ?? "",
    })),
  };
}

function toRegistrationStatus(status: string): RegistrationStatus {
  const normalized = (status ?? "").toLowerCase().replaceAll("_", " ");
  if (normalized.includes("submitted")) return "Submitted";
  if (normalized.includes("incomplete")) return "Incomplete";
  if (normalized.includes("review")) return "Under Review";
  if (normalized.includes("interview")) return "Interview Required";
  if (normalized.includes("accepted")) return "Accepted";
  if (normalized.includes("wait")) return "Waitlisted";
  if (normalized.includes("declined")) return "Declined";
  if (normalized.includes("contract")) return "Contract Pending";
  if (normalized.includes("deposit")) return "Deposit Pending";
  if (normalized.includes("enrolled")) return "Fully Enrolled";
  if (normalized.includes("not")) return "Not Started";
  return "In Progress";
}

function toDocStatus(status: string): DocStatus {
  const normalized = (status ?? "").toLowerCase();
  if (normalized.includes("approved")) return "Approved";
  if (normalized.includes("reject")) return "Rejected";
  if (normalized.includes("review")) return "Under Review";
  if (normalized.includes("upload")) return "Uploaded";
  if (normalized.includes("expire")) return "Expired";
  if (normalized.includes("waive")) return "Waived";
  if (normalized.includes("missing")) return "Missing";
  return "Not Started";
}

function toTuitionStatus(status: string): Student["tuitionStatus"] {
  const normalized = (status ?? "").toLowerCase();
  if (normalized.includes("over")) return "Overdue";
  if (normalized.includes("arrangement")) return "Arrangement";
  if (normalized.includes("credit")) return "Credit";
  return "Current";
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [state, setState] = useState<AppState>(demoState);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const client = supabase;
    if (!isSupabaseConfigured || !client) {
      setAuthLoading(false);
      return;
    }

    const loadProfile = async (activeSession: Session | null) => {
      setSession(activeSession);
      if (!activeSession?.user) {
        setProfile(null);
        setAuthLoading(false);
        return;
      }

      const { data, error } = await client
        .from("profiles")
        .select("id,email,first_name,last_name,role,status,disabled_at")
        .eq("id", activeSession.user.id)
        .maybeSingle();

      if (error || !data) {
        setProfile(null);
        setAuthMessage("Your login was accepted, but your portal profile is not active yet. Please contact the school office.");
      } else if (data.status !== "active") {
        await client.auth.signOut();
        setProfile(null);
        setAuthMessage(data.status === "disabled" ? "This account is disabled. Please contact the school office." : "This account is not active yet. Please verify your email or contact the school office.");
      } else {
        const activeProfile = data as Profile;
        setProfile(activeProfile);
        setState(await loadPortalData(client, activeProfile));
        setAuthMessage(null);
      }
      setAuthLoading(false);
    };

    client.auth.getSession().then(({ data }) => loadProfile(data.session));
    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      void loadProfile(nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  };

  return (
    <AppErrorBoundary>
      <BrowserRouter>
        {toast && <div className="fixed right-4 top-4 z-50 rounded-xl bg-navy px-4 py-3 text-sm font-semibold text-white shadow-2xl" role="status" aria-live="polite">{toast}</div>}
        <Routes>
          <Route path="/login" element={<Login session={session} profile={profile} authMessage={authMessage} />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/accept-invitation" element={<ResetPassword invitation />} />
          <Route path="/" element={<Navigate to={profile ? defaultRouteForRole(profile.role) : "/login"} replace />} />
          <Route
            path="/*"
            element={
              authLoading ? <LoadingScreen /> : profile ? (
                <ProtectedPortal profile={profile} state={state} setState={setState} notify={notify} />
              ) : <Navigate to="/login" replace />
            }
          />
        </Routes>
      </BrowserRouter>
    </AppErrorBoundary>
  );
}

function Login({ session, profile, authMessage }: { session: Session | null; profile: Profile | null; authMessage: string | null }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(authMessage);

  useEffect(() => setMessage(authMessage), [authMessage]);
  useEffect(() => {
    if (session && profile) navigate(defaultRouteForRole(profile.role), { replace: true });
  }, [navigate, profile, session]);

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (!isSupabaseConfigured || !supabase) {
      setMessage("Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then redeploy.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setMessage("Invalid email or password. If you need help, contact the school office.");
  };

  const sendReset = async () => {
    if (!email.trim()) {
      setMessage("Enter your email first, then choose Forgot password.");
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      setMessage("Password reset will work after Supabase is configured.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setMessage(error ? "We could not send a reset email. Please contact the school office." : "If that email has an account, a password reset link was sent.");
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#f7efd9,transparent_35%),radial-gradient(circle_at_85%_20%,rgba(123,0,36,.35),transparent_28%),linear-gradient(135deg,#0f2746,#173b63)] px-6 py-10 text-white">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.15fr_.85fr] lg:items-center">
        <section>
          <div className="mb-8 flex h-28 w-28 items-center justify-center rounded-[2rem] border border-gold/30 bg-white p-3 shadow-2xl shadow-burgundy/20">
            <img src="/bnos-melochim-logo.jpeg" alt="Bnos Melochim logo" className="h-full w-full rounded-3xl object-contain" />
          </div>
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-white/10 px-4 py-2 text-sm">
            <ShieldCheck className="h-4 w-4 text-gold" aria-hidden="true" /> Secure school family access
          </div>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">Bnos Melochim Family Portal</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-ivory/90">
            Registration, required documents, agreements, tuition, and family information—all in one secure place.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {["Family-first records", "Office review queues", "Tuition dashboards"].map((item) => (
              <div key={item} className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                <CheckCircle2 className="mb-3 h-5 w-5 text-gold" aria-hidden="true" />
                <p className="font-semibold">{item}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-3xl border border-white/20 bg-white p-6 text-slate-900 shadow-2xl">
          <div className="mb-5 flex items-center gap-4 rounded-2xl bg-ivory p-4">
            <img src="/bnos-melochim-logo.jpeg" alt="Bnos Melochim logo" className="h-16 w-16 rounded-2xl bg-white object-contain p-1" />
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold-dark">Portal Login</p>
              <p className="font-bold text-burgundy">בנות מלכים</p>
            </div>
          </div>
          <h2 className="mt-2 text-2xl font-bold text-navy">Sign in to your account</h2>
          <p className="mt-2 text-sm text-slate-600">Your access is assigned by the school office. Staff accounts are invitation-only.</p>
          {message && <div className="mt-4 rounded-2xl border border-gold/40 bg-ivory p-3 text-sm font-semibold text-navy">{message}</div>}
          <form onSubmit={signIn} className="mt-6 grid gap-4">
            <label className="text-sm font-semibold text-slate-700">
              Email address
              <input className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Password
              <span className="mt-1 flex rounded-xl border border-slate-200 focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/30">
                <input className="min-w-0 flex-1 rounded-l-xl px-4 py-3 outline-none" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
                <button type="button" className="rounded-r-xl px-3 text-slate-500 hover:bg-ivory focus-visible:bg-ivory" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
                </button>
              </span>
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-burgundy" />
                Remember me
              </label>
              <button type="button" onClick={sendReset} className="text-sm font-bold text-burgundy hover:text-burgundy-dark focus-visible:underline">Forgot password?</button>
            </div>
            <button disabled={busy || !remember} className="rounded-xl bg-burgundy px-5 py-3 font-bold text-white shadow-lg shadow-burgundy/20 transition hover:bg-burgundy-dark focus-visible:ring-2 focus-visible:ring-gold disabled:cursor-not-allowed disabled:opacity-60">
              {busy ? "Signing in..." : "Sign In"}
            </button>
            {!remember && <p className="text-xs text-slate-500">Session persistence is required for this secure family portal.</p>}
          </form>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-ivory p-4 text-sm text-slate-700">
            Need an account or locked out? Contact the school office. There is no public self-registration for staff.
          </div>
          <div className="mt-6 grid gap-3">
            {(["parent", "registration_office", "tuition_office", "school_management"] as Role[]).map((role) => (
              <button
                key={role}
                type="button"
                disabled
                className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-left font-semibold text-navy opacity-80"
                aria-label={`${roleLabels[role]} access is assigned after login`}
              >
                <span className="flex items-center justify-between gap-4">
                  <span>{roleLabels[role]}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500">
                    Assigned by office <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                </span>
                <span className="mt-1 block text-sm font-normal text-slate-600">{roleDescriptions[role]}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function ResetPassword({ invitation = false }: { invitation?: boolean }) {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tokenReady, setTokenReady] = useState(false);

  useEffect(() => {
    const prepareTokenSession = async () => {
      if (!supabase) {
        setMessage("Supabase is not configured yet.");
        setTokenReady(true);
        return;
      }
      const url = new URL(window.location.href);
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
      const queryParams = url.searchParams;
      const accessToken = hashParams.get("access_token") ?? queryParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token") ?? queryParams.get("refresh_token");
      const code = queryParams.get("code") ?? hashParams.get("code");
      const tokenHash = queryParams.get("token_hash") ?? hashParams.get("token_hash");
      const type = queryParams.get("type") ?? hashParams.get("type") ?? (invitation ? "invite" : "recovery");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (error) setMessage("This link is no longer valid. Please request a new one.");
      } else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) setMessage("This link is no longer valid. Please request a new one.");
      } else if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type === "invite" ? "invite" : "recovery" });
        if (error) setMessage("This link is no longer valid. Please request a new one.");
      } else if (invitation) {
        const { data } = await supabase.auth.getSession();
        if (!data.session) setMessage("Open the newest setup link from Users & Access. Older invite links will not work.");
      }
      setTokenReady(true);
    };
    void prepareTokenSession();
  }, [invitation]);

  const updatePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return setMessage("Supabase is not configured yet.");
    if (!tokenReady) return setMessage("Still checking this secure link. Please try again in a moment.");
    if (password.length < 8) return setMessage("Use at least 8 characters.");
    if (password !== confirm) return setMessage("Passwords do not match.");
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return setMessage(invitation ? "Open the newest setup link from Users & Access, then set the password." : "Open the newest reset link, then set the password.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setMessage("This reset link is no longer valid. Please request a new one.");
    else {
      if (invitation) {
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          await Promise.all([
            supabase.from("profiles").update({ status: "active" }).eq("id", data.user.id),
            supabase.from("family_users").update({ status: "active" }).eq("user_id", data.user.id).eq("status", "invited"),
          ]);
        }
      }
      setMessage("Password updated. You can now sign in.");
      window.setTimeout(() => navigate("/login", { replace: true }), 1200);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-ivory px-6">
      <form onSubmit={updatePassword} className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
        <img src="/bnos-melochim-logo.jpeg" alt="Bnos Melochim logo" className="mb-4 h-16 w-16 rounded-2xl border border-gold/30 object-contain p-1" />
        <h1 className="text-2xl font-bold text-navy">{invitation ? "Accept invitation" : "Change password"}</h1>
        <p className="mt-2 text-sm text-slate-600">{invitation ? "Choose a password to finish setting up your Bnos Melochim portal account." : "Choose a new password for your Bnos Melochim portal account."}</p>
        {message && <p className="mt-4 rounded-xl bg-ivory p-3 text-sm font-semibold text-navy">{message}</p>}
        <label className="mt-5 block text-sm font-semibold text-slate-700">New password<input className="mt-1 w-full rounded-xl border px-4 py-3" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></label>
        <label className="mt-4 block text-sm font-semibold text-slate-700">Confirm password<input className="mt-1 w-full rounded-xl border px-4 py-3" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} minLength={8} required /></label>
        <button disabled={busy} className="mt-5 w-full rounded-xl bg-burgundy px-5 py-3 font-bold text-white hover:bg-burgundy-dark disabled:opacity-60">{busy ? "Updating..." : "Update password"}</button>
      </form>
    </main>
  );
}

function LoadingScreen() {
  return <main className="grid min-h-screen place-items-center bg-ivory text-lg font-bold text-navy">Loading secure portal...</main>;
}

function ProtectedPortal({ profile, state, setState, notify }: { profile: Profile; state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>>; notify: (message: string) => void }) {
  const location = useLocation();
  if (!isAuthorizedPath(profile.role, location.pathname)) return <Navigate to={defaultRouteForRole(profile.role)} replace />;
  return (
    <Shell profile={profile}>
      <Portal state={state} setState={setState} role={profile.role} notify={notify} />
    </Shell>
  );
}

function Shell({ profile, children }: { profile: Profile; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const role = profile.role;
  const nav = role === "parent" ? parentNav : adminNav(role);
  const navigate = useNavigate();
  const location = useLocation();
  const userName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email;
  const currentSection = nav.find((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`))?.label ?? "Portal";
  return (
    <div className="min-h-screen bg-ivory text-slate-900">
      <button className="fixed left-4 top-4 z-40 rounded-xl bg-navy p-3 text-white shadow-lg lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
        <Menu />
      </button>
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 border-r border-slate-200 bg-white p-5 shadow-xl transition lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-start justify-between">
          <Link to={defaultRouteForRole(role)} className="flex items-center gap-3">
            <div className="grid h-13 w-13 place-items-center rounded-2xl border border-gold/40 bg-white p-1 shadow-sm">
              <img src="/bnos-melochim-logo.jpeg" alt="Bnos Melochim logo" className="h-full w-full rounded-xl object-contain" />
            </div>
            <div>
              <p className="font-bold text-burgundy">Bnos Melochim</p>
              <p className="text-xs text-slate-500">{roleLabels[role]}</p>
            </div>
          </Link>
          <button className="rounded-lg p-1 hover:bg-ivory lg:hidden" onClick={() => setOpen(false)} aria-label="Close navigation"><X aria-hidden="true" /></button>
        </div>
        <nav className="mt-8 space-y-1" aria-label="Main navigation">
          {nav.map((item) => {
            const active = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-ivory hover:text-navy focus-visible:bg-ivory focus-visible:text-navy ${active ? "bg-ivory text-burgundy shadow-sm" : "text-slate-700"}`}
              >
                <item.icon className="h-4 w-4" aria-hidden="true" /> {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          className="absolute bottom-5 left-5 right-5 flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 font-semibold text-slate-600 hover:bg-ivory"
          onClick={async () => {
            if (supabase) await supabase.auth.signOut();
            navigate("/login");
          }}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
        </button>
      </aside>
      <section className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 px-6 py-4 backdrop-blur">
          <div className="ml-14 flex flex-wrap items-center justify-between gap-3 lg:ml-0">
            <div className="flex min-w-0 items-center gap-3">
              <img src="/bnos-melochim-logo.jpeg" alt="Bnos Melochim logo" className="h-12 w-12 rounded-2xl border border-gold/30 bg-white object-contain p-1 shadow-sm" />
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-dark">Private School Operations</p>
                <h1 className="text-lg font-bold text-burgundy sm:text-xl">Registration & Tuition Management</h1>
                <p className="mt-1 text-xs font-semibold text-slate-500">{currentSection}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`hidden rounded-full px-3 py-1 text-xs font-bold sm:inline-flex ${isSupabaseConfigured ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {isSupabaseConfigured ? "Secure live portal" : "Supabase not configured"}
              </span>
              <label className="sr-only" htmlFor="language-select">Language</label>
              <select id="language-select" className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-navy shadow-sm" aria-label="Language selector">
                <option>English</option>
                <option>Yiddish</option>
              </select>
              <div className="hidden rounded-2xl bg-ivory px-4 py-2 text-sm sm:block">
                <p className="font-bold text-navy">{userName}</p>
                <p className="text-xs text-slate-600">{roleLabels[role]} · {profile.email}</p>
              </div>
              <Link to="/reset-password" className="hidden rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-ivory focus-visible:bg-ivory md:inline">Change password</Link>
            </div>
          </div>
        </header>
        <main className="p-5 md:p-8">{children}</main>
      </section>
    </div>
  );
}

const parentNav: NavItem[] = [
  { label: "Dashboard", path: "/parent/dashboard", icon: LayoutDashboard },
  { label: "My Family", path: "/parent/family", icon: Users },
  { label: "My Children", path: "/parent/children", icon: BookOpen },
  { label: "Registration", path: "/parent/registration", icon: ClipboardCheck },
  { label: "Required Documents", path: "/parent/documents", icon: FileCheck2 },
  { label: "Agreements", path: "/parent/agreements", icon: ShieldCheck },
  { label: "Tuition", path: "/parent/tuition", icon: Banknote },
  { label: "Payments", path: "/parent/payments", icon: Banknote },
  { label: "Messages", path: "/parent/messages", icon: MessageSquare },
  { label: "Account Settings", path: "/parent/settings", icon: Settings },
];

function roleBasePath(role: Role) {
  if (role === "parent") return "/parent";
  if (role === "registration_office") return "/office";
  if (role === "tuition_office") return "/tuition-admin";
  if (role === "school_management") return "/management";
  return "/admin";
}

function defaultRouteForRole(role: Role) {
  return `${roleBasePath(role)}/dashboard`;
}

function isAuthorizedPath(role: Role, path: string) {
  if (path === "/reset-password" || path === "/login") return true;
  if (role === "super_admin") return path.startsWith("/admin");
  const base = roleBasePath(role);
  if (!path.startsWith(base)) return false;
  const section = path.split("/")[2] || "dashboard";
  const allowedSections: Record<Exclude<Role, "super_admin">, string[]> = {
    parent: ["dashboard", "family", "children", "registration", "documents", "agreements", "tuition", "payments", "messages", "settings"],
    registration_office: ["dashboard", "families", "students", "registration", "documents", "admissions", "reports", "messages", "users", "settings"],
    tuition_office: ["dashboard", "families", "students", "tuition", "payments", "reports", "messages"],
    school_management: ["dashboard", "families", "students", "registration", "documents", "admissions", "tuition", "payments", "reports", "messages"],
  };
  return allowedSections[role].includes(section);
}

function adminNav(role: Role) {
  const base = roleBasePath(role);
  const all: NavItem[] = [
    { label: "Dashboard", path: `${base}/dashboard`, icon: LayoutDashboard },
    { label: "Families", path: `${base}/families`, icon: Users },
    { label: "Students", path: `${base}/students`, icon: BookOpen },
    { label: "Registration", path: `${base}/registration`, icon: ClipboardCheck },
    { label: "Documents", path: `${base}/documents`, icon: FileCheck2 },
    { label: "Admissions Review", path: `${base}/admissions`, icon: ShieldCheck },
    { label: "Tuition", path: `${base}/tuition`, icon: Banknote },
    { label: "Payments", path: `${base}/payments`, icon: Banknote },
    { label: "Reports", path: `${base}/reports`, icon: Download },
    { label: "Messages", path: `${base}/messages`, icon: MessageSquare },
    { label: "Users & Access", path: `${base}/users`, icon: ShieldCheck },
    { label: "School Settings", path: `${base}/settings`, icon: Settings },
  ];
  const allowed =
    role === "registration_office"
      ? all.filter(({ label }) => !["Payments", "Tuition"].includes(label))
      : role === "tuition_office"
        ? all.filter(({ label }) => ["Dashboard", "Families", "Students", "Tuition", "Payments", "Reports", "Messages"].includes(label))
        : role === "school_management"
          ? all.filter(({ label }) => !["Users & Access", "School Settings"].includes(label))
          : all;
  return allowed;
}

function Portal({ state, setState, role, notify }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>>; role: Role; notify: (message: string) => void }) {
  const parentFamily = state.families[0];
  if (role === "parent" && !parentFamily) {
    return <SimplePage title="Family access pending" description="Your account is active, but no family record is linked yet. Please contact the school office." />;
  }
  const routeFamily = parentFamily ?? emptyFamily;
  return (
    <Routes>
      <Route path="/parent/dashboard" element={<ParentDashboard state={state} family={routeFamily} />} />
      <Route path="/parent/family" element={<MyFamily state={state} setState={setState} family={routeFamily} notify={notify} />} />
      <Route path="/parent/children" element={<Children state={state} familyId={routeFamily.id} />} />
      <Route path="/parent/children/:studentId" element={<StudentDetail state={state} />} />
      <Route path="/parent/registration" element={<RegistrationWizard state={state} setState={setState} family={routeFamily} notify={notify} />} />
      <Route path="/parent/documents" element={<Documents state={state} setState={setState} familyId={routeFamily.id} notify={notify} parent />} />
      <Route path="/parent/agreements" element={<Agreements state={state} setState={setState} familyId={routeFamily.id} notify={notify} />} />
      <Route path="/parent/tuition" element={<Tuition state={state} setState={setState} familyId={routeFamily.id} notify={notify} parent />} />
      <Route path="/parent/payments" element={<Payments state={state} familyId={routeFamily.id} />} />
      <Route path="/parent/messages" element={<Messages state={state} familyId={routeFamily.id} notify={notify} />} />
      <Route path="/parent/settings" element={<AccountSettings notify={notify} />} />
      <Route path="/:staffBase/dashboard" element={<AdminDashboard state={state} role={role} />} />
      <Route path="/:staffBase/families" element={<FamiliesTable state={state} setState={setState} currentRole={role} notify={notify} />} />
      <Route path="/:staffBase/families/:familyId" element={<FamilyDetail state={state} />} />
      <Route path="/:staffBase/students" element={<StudentsTable state={state} setState={setState} currentRole={role} notify={notify} />} />
      <Route path="/:staffBase/students/:studentId" element={<StudentDetail state={state} admin />} />
      <Route path="/:staffBase/registration" element={<RegistrationQueue state={state} setState={setState} currentRole={role} notify={notify} />} />
      <Route path="/:staffBase/documents" element={<Documents state={state} setState={setState} notify={notify} />} />
      <Route path="/:staffBase/admissions" element={<Admissions state={state} setState={setState} notify={notify} />} />
      <Route path="/:staffBase/tuition" element={<Tuition state={state} setState={setState} notify={notify} />} />
      <Route path="/:staffBase/payments" element={<Payments state={state} />} />
      <Route path="/:staffBase/reports" element={<Reports state={state} notify={notify} />} />
      <Route path="/:staffBase/messages" element={<Messages state={state} notify={notify} />} />
      <Route path="/:staffBase/users" element={<UsersAccess currentRole={role} notify={notify} />} />
      <Route path="/:staffBase/settings" element={<SchoolSettings role={role} notify={notify} />} />
      <Route path="*" element={<Navigate to={defaultRouteForRole(role)} replace />} />
    </Routes>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</section>;
}

function Stat({ label, value, tone = "navy", to }: { label: string; value: string | number; tone?: "navy" | "gold" | "red"; to?: string }) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        {to && <ArrowRight className="h-4 w-4 text-gold-dark" aria-hidden="true" />}
      </div>
      <p className={`mt-2 text-2xl font-bold ${tone === "red" ? "text-red-700" : tone === "gold" ? "text-gold-dark" : "text-navy"}`}>{value}</p>
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="block rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-gold hover:shadow-lg focus-visible:bg-ivory"
        aria-label={`${label}: ${value}. Open related page.`}
      >
        {content}
      </Link>
    );
  }

  return <Card>{content}</Card>;
}

function Progress({ value }: { value: number }) {
  return <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gold" style={{ width: `${Math.min(value, 100)}%` }} /></div>;
}

function StatusBadge({ status }: { status: string }) {
  const className = status.includes("Approved") || status.includes("Enrolled") || status.includes("Signed") ? "bg-emerald-50 text-emerald-700" : status.includes("Missing") || status.includes("Rejected") || status.includes("Overdue") || status.includes("Failed") ? "bg-red-50 text-red-700" : "bg-gold/15 text-gold-dark";
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${className}`}>{status}</span>;
}

function ParentDashboard({ state, family }: { state: AppState; family: Family }) {
  const students = state.students.filter((s) => s.familyId === family.id);
  const docs = state.documents.filter((d) => d.familyId === family.id);
  const agreements = state.agreements.filter((a) => a.familyId === family.id);
  const account = state.tuition.find((t) => t.familyId === family.id)!;
  const missing = docs.filter((d) => ["Missing", "Rejected", "Expired", "Not Started"].includes(d.status)).length;
  const completedSections = Math.round((family.registrationPercent / 100) * 12);
  const remainingItems = missing + agreements.filter((a) => a.status === "Awaiting Signature").length;
  const actionItems = [
    {
      title: "Upload birth certificate",
      student: students[0]?.preferredName,
      status: "Missing",
      dueDate: "2026-08-01",
      to: "/parent/documents",
      action: "Upload document",
    },
    {
      title: "Complete emergency medical consent",
      student: students[0]?.preferredName,
      status: "Not Started",
      dueDate: "2026-08-05",
      to: "/parent/registration",
      action: "Continue registration",
    },
    {
      title: "Sign tuition agreement",
      status: "Awaiting Signature",
      dueDate: "2026-08-10",
      to: "/parent/agreements",
      action: "Sign agreement",
    },
    {
      title: "Confirm transportation arrangement",
      student: students[1]?.preferredName,
      status: "Needs confirmation",
      dueDate: "2026-08-12",
      to: "/parent/registration",
      action: "Confirm transportation",
    },
    {
      title: "Review parent handbook",
      status: "Ready for review",
      to: "/parent/agreements",
      action: "Review handbook",
    },
  ];
  return (
    <div className="space-y-6">
      <Card className="bg-[linear-gradient(135deg,#10233f,#7b0024)] text-white">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            <img src="/bnos-melochim-logo.jpeg" alt="Bnos Melochim logo" className="h-20 w-20 rounded-3xl bg-white object-contain p-2 shadow-xl sm:h-24 sm:w-24" />
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-gold">
                <CalendarDays className="h-4 w-4" aria-hidden="true" /> School Year 2026–2027 / תשפ״ז
              </p>
              <p className="mt-4 text-gold">Welcome, {family.name} family</p>
              <h2 className="mt-2 text-3xl font-bold">{family.registrationPercent}% registration complete</h2>
              <p className="mt-2 text-sm text-ivory/90">{completedSections} of 12 sections complete · {remainingItems} items remaining</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:flex-col lg:flex-row">
            <Link className="rounded-2xl bg-gold px-5 py-3 text-center font-bold text-navy shadow-sm hover:bg-white focus-visible:bg-white" to="/parent/registration">Continue Registration</Link>
            <Link className="rounded-2xl border border-white/40 bg-white/10 px-5 py-3 text-center font-bold text-white hover:bg-white hover:text-navy focus-visible:bg-white focus-visible:text-navy" to="/parent/documents">View Missing Items</Link>
          </div>
        </div>
        <div className="mt-6"><Progress value={family.registrationPercent} /></div>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Stat label="Children enrolled" value={students.length} to="/parent/children" />
        <Stat label="Missing items" value={missing} tone={missing ? "red" : "navy"} to="/parent/documents" />
        <Stat label="Documents needing attention" value={docs.filter((d) => d.status === "Rejected").length} to="/parent/documents" />
        <Stat label="Agreements awaiting signature" value={agreements.filter((a) => a.status === "Awaiting Signature").length} to="/parent/agreements" />
        <Stat label="Tuition balance" value={currency(total(account) - account.paid)} to="/parent/tuition" />
        <Stat label="Upcoming payment" value={upcomingPayment(account)} to="/parent/payments" />
      </div>
      <Card>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-xl font-bold text-navy">Items requiring your attention</h3>
            <p className="mt-1 text-sm text-slate-600">Use the action buttons below to go directly to the correct section.</p>
          </div>
          <Link to="/parent/documents" className="inline-flex items-center gap-2 rounded-xl border border-gold px-4 py-2 text-sm font-bold text-burgundy hover:bg-ivory">
            View all missing items <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="mt-5 grid gap-3">
          {actionItems.map((item) => (
            <div key={item.title} className="grid gap-3 rounded-2xl border border-slate-200 bg-ivory p-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-navy">{item.title}</p>
                  <StatusBadge status={item.status} />
                </div>
                <p className="mt-1 text-sm text-slate-700">
                  {item.student ? `${item.student} · ` : ""}
                  {item.dueDate ? `Due ${formatDate(item.dueDate)}` : "No due date"}
                </p>
              </div>
              <Link to={item.to} className="inline-flex items-center justify-center gap-2 rounded-xl bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-burgundy focus-visible:bg-burgundy" aria-label={`${item.action}: ${item.title}`}>
                {item.action} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <h3 className="text-xl font-bold text-navy">Recent school messages</h3>
        <div className="mt-4 space-y-3">
          {state.messages.filter((m) => m.familyId === family.id).map((m) => (
            <div key={m.id} className="rounded-2xl bg-ivory p-4"><p className="font-semibold">{m.subject}</p><p className="text-sm text-slate-600">{formatDate(m.date)} · {m.body}</p></div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function MyFamily({ state, setState, family, notify }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>>; family: Family; notify: (message: string) => void }) {
  const [draft, setDraft] = useState(family);
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name || !draft.email || !draft.phone) return notify("Please complete family name, email, and phone.");
    setState({ ...state, families: state.families.map((f) => (f.id === family.id ? draft : f)) });
    notify("Family information saved.");
  };
  return (
    <form onSubmit={save} className="space-y-6">
      <PageTitle title="My Family" subtitle="Household, parent/guardian, employment, shul, emergency, and grandparent information." />
      <Card className="grid gap-4 md:grid-cols-2">
        {(["name", "address", "city", "state", "zip", "phone", "email", "shul", "maternalGrandparents", "paternalGrandparents"] as (keyof Family)[]).map((field) => (
          <label key={field} className="text-sm font-semibold text-slate-600">
            {String(field).replace(/([A-Z])/g, " $1")}
            <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" value={String(draft[field])} onChange={(e) => setDraft({ ...draft, [field]: e.target.value })} />
          </label>
        ))}
      </Card>
      <Card>
        <h3 className="font-bold text-navy">Parents / Guardians & Employment</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {draft.parents.map((parent, index) => (
            <div className="rounded-2xl bg-ivory p-4" key={parent.relationship}>
              <p className="font-bold">{parent.relationship}</p>
              <input className="mt-3 w-full rounded-xl border px-3 py-2" value={parent.name} onChange={(e) => setDraft({ ...draft, parents: draft.parents.map((p, i) => (i === index ? { ...p, name: e.target.value } : p)) })} />
              <p className="mt-2 text-sm text-slate-600">{parent.email} · {parent.phone} · {parent.employer}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <h3 className="font-bold text-navy">Emergency contacts</h3>
        <p className="mt-2 text-slate-600">{draft.emergencyContacts.join(" • ")}</p>
      </Card>
      <button className="rounded-2xl bg-navy px-5 py-3 font-bold text-white">Save Family Profile</button>
    </form>
  );
}

function Children({ state, familyId }: { state: AppState; familyId: string }) {
  return (
    <div className="space-y-6">
      <PageTitle title="My Children" subtitle="Open any student record to review enrollment, documents, medical, transportation, and tuition details." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {state.students.filter((s) => s.familyId === familyId).map((student) => (
          <Card key={student.id}>
            <div className="flex items-start justify-between gap-3"><h3 className="text-xl font-bold text-navy">{student.preferredName}</h3><StatusBadge status={student.registrationStatus} /></div>
            <p className="mt-1 text-sm text-slate-500">{student.legalName} · DOB {student.dob}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Info label="Grade" value={student.grade} /><Info label="Gender" value={student.gender} /><Info label="Student" value={student.newReturning} /><Info label="Tuition" value={student.tuitionStatus} />
            </dl>
            <div className="mt-4"><Progress value={student.progress} /></div>
            <Link className="mt-5 inline-flex rounded-xl bg-navy px-4 py-2 font-semibold text-white" to={`/parent/children/${student.id}`}>View student record</Link>
          </Card>
        ))}
      </div>
    </div>
  );
}

function RegistrationWizard({ state, setState, family, notify }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>>; family: Family; notify: (message: string) => void }) {
  const steps = [
    { key: "welcome", title: "Welcome" },
    { key: "family_information", title: "Family information" },
    { key: "parents_guardians", title: "Parents/guardians" },
    { key: "review_children", title: "Review children" },
    { key: "student_information", title: "Student information" },
    { key: "emergency_medical", title: "Emergency/medical" },
    { key: "transportation", title: "Transportation" },
    { key: "government_eligibility", title: "Government eligibility" },
    { key: "policies", title: "Policies" },
    { key: "tuition_review", title: "Tuition review" },
    { key: "payment_plan", title: "Payment plan" },
    { key: "final_checklist", title: "Final checklist" },
  ];
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const currentStep = steps[step];
  const save = async (exit = false) => {
    if (step === 1 && !family.email) return setError("Primary email is required before continuing.");
    if (!supabase) return setError("Supabase is not configured, so registration cannot be saved yet.");
    const familyDbId = family.dbId ?? family.id;
    if (!familyDbId || familyDbId === "no-family-linked") return setError("This account is not linked to a family record yet.");
    setError("");
    const progress = Math.max(family.registrationPercent, Math.round(((step + 1) / steps.length) * 100));
    const status = progress >= 100 ? "submitted" : "in_progress";
    const completedSections = Math.max(step + 1, Math.round((progress / 100) * steps.length));
    const remainingItems = Math.max(steps.length - completedSections, 0);

    setSaving(true);
    const { data: existingRegistration, error: lookupError } = await supabase
      .from("registrations")
      .select("id")
      .eq("family_id", familyDbId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      setSaving(false);
      return setError("Registration record could not be checked. Please try again.");
    }

    const registrationPayload = {
      family_id: familyDbId,
      status,
      percent_complete: progress,
      completed_sections: completedSections,
      remaining_items: remainingItems,
      submitted_at: progress >= 100 ? new Date().toISOString() : null,
    };

    const registrationResult = existingRegistration?.id
      ? await supabase.from("registrations").update(registrationPayload).eq("id", existingRegistration.id).select("id").single()
      : await supabase.from("registrations").insert(registrationPayload).select("id").single();

    if (registrationResult.error || !registrationResult.data) {
      setSaving(false);
      return setError(registrationResult.error?.message || "Registration progress could not be saved.");
    }

    const familyStudents = state.students.filter((s) => s.familyId === family.id);
    const account = state.tuition.find((item) => item.familyId === family.id);
    const stepData = {
      saved_at: new Date().toISOString(),
      saved_from: "parent_portal",
      family: {
        id: family.id,
        db_id: familyDbId,
        name: family.name,
        email: family.email,
        phone: family.phone,
        address: [family.address, family.city, family.state, family.zip].filter(Boolean).join(", "),
      },
      students: familyStudents.map((student) => ({
        id: student.id,
        legal_name: student.legalName,
        preferred_name: student.preferredName,
        grade: student.grade,
        registration_status: student.registrationStatus,
        transportation: student.transportation,
      })),
      documents: state.documents.filter((doc) => doc.familyId === family.id).map((doc) => ({ id: doc.id, type: doc.type, status: doc.status })),
      tuition: account ? { plan: account.plan, balance: total(account) - account.paid, next_due: account.nextDue } : null,
    };

    const { error: stepError } = await supabase.from("registration_steps").upsert(
      {
        registration_id: registrationResult.data.id,
        step_key: currentStep.key,
        title: currentStep.title,
        status: "completed",
        completed_at: new Date().toISOString(),
        data: stepData,
      },
      { onConflict: "registration_id,step_key" },
    );

    if (stepError) {
      setSaving(false);
      return setError(stepError.message || "Registration section could not be saved.");
    }

    setState({ ...state, families: state.families.map((f) => (f.id === family.id ? { ...f, registrationPercent: progress, status: progress >= 100 ? "Submitted" : "In Progress" } : f)) });
    setSaving(false);
    notify(exit ? "Registration section saved to Supabase. You can return anytime." : "Registration section saved to Supabase.");
    if (!exit && step < steps.length - 1) setStep(step + 1);
  };
  return (
    <div className="space-y-6">
      <PageTitle title="Registration Wizard" subtitle="Your progress is saved as you move through the form, and shared family information is reused across all children." />
      <Card>
        <div className="flex items-center justify-between"><p className="font-bold text-navy">Step {step + 1} of {steps.length}: {currentStep.title}</p><StatusBadge status={saving ? "Saving" : step < 4 ? "Family shared" : "Multi-child aware"} /></div>
        <div className="mt-4"><Progress value={((step + 1) / steps.length) * 100} /></div>
        <div className="mt-4 flex flex-wrap gap-2">
          {steps.map((item, index) => <span key={item.key} className={`rounded-full px-3 py-1 text-xs font-bold ${index < step ? "bg-emerald-50 text-emerald-700" : index === step ? "bg-gold/20 text-gold-dark" : "bg-slate-100 text-slate-500"}`}>{index < step ? "✓ " : ""}{index + 1}</span>)}
        </div>
      </Card>
      <Card>
        <h3 className="text-2xl font-bold text-navy">{currentStep.title}</h3>
        <p className="mt-3 text-slate-600">
          {step === 0 && "Welcome. The office uses this guided workflow to gather all family, student, medical, policy, and tuition information."}
          {step === 1 && `Confirm household details for the ${family.name} family: ${family.address}, ${family.city}, ${family.state} ${family.zip}.`}
          {step === 2 && `Guardians on file: ${family.parents.map((p) => p.name).join(" and ")}.`}
          {step === 3 && `Children included: ${state.students.filter((s) => s.familyId === family.id).map((s) => s.preferredName).join(", ")}.`}
          {step >= 4 && "This step stores student-specific details without making the family re-enter household information."}
        </p>
        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
      </Card>
      <div className="flex flex-wrap gap-3">
        <button className="rounded-xl border border-slate-300 px-4 py-2 font-semibold" disabled={saving || step === 0} onClick={() => setStep(step - 1)}><ChevronLeft className="inline h-4 w-4" /> Back</button>
        <button disabled={saving} className="rounded-xl bg-navy px-4 py-2 font-semibold text-white disabled:opacity-60" onClick={() => void save(false)}>{saving ? "Saving..." : step === steps.length - 1 ? "Submit Registration" : "Save and Continue"}</button>
        <button disabled={saving} className="rounded-xl border border-gold px-4 py-2 font-semibold text-gold-dark disabled:opacity-60" onClick={() => void save(true)}>Save and Exit</button>
      </div>
    </div>
  );
}

function Documents({ state, setState, familyId, notify, parent = false }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>>; familyId?: string; notify: (message: string) => void; parent?: boolean }) {
  const [filter, setFilter] = useState("All");
  const docs = state.documents.filter((doc) => (!familyId || doc.familyId === familyId) && (filter === "All" || doc.status === filter));
  const action = (id: string, status: DocStatus) => {
    if (status === "Rejected" && !window.confirm("Reject this document and request a replacement?")) return;
    setState({ ...state, documents: state.documents.map((d) => (d.id === id ? { ...d, status, staffNote: status === "Waived" ? "Requirement waived by staff." : d.staffNote } : d)) });
    notify(`Document marked ${status}.`);
  };
  return (
    <div className="space-y-6">
      <PageTitle title={parent ? "Required Documents" : "Document Review Queue"} subtitle={parent ? "Track requirements, rejection reasons, and replacement actions." : "Preview, approve, reject, request replacements, waive, and add staff notes."} />
      <FilterBar value={filter} setValue={setFilter} options={["All", "Missing", "Uploaded", "Under Review", "Approved", "Rejected", "Expired", "Waived", "Not Started"]} />
      <div className="grid gap-4">
        {docs.map((doc) => (
          <Card key={doc.id}>
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-3"><h3 className="font-bold text-navy">{doc.type}</h3><StatusBadge status={doc.status} /></div>
                <p className="mt-1 text-sm text-slate-500">{doc.familyId} · {doc.category} · Uploaded {doc.uploadDate ? formatDate(doc.uploadDate) : "not yet"}</p>
                {doc.rejectionReason && <p className="mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">Rejection reason: {doc.rejectionReason}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-ivory" onClick={() => notify("Document preview opened.")}>Preview</button>
                {parent ? (
                  <button className="rounded-xl bg-navy px-3 py-2 text-sm font-semibold text-white" onClick={() => action(doc.id, "Uploaded")}>Replace Document</button>
                ) : (
                  <>
                    <button className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => action(doc.id, "Approved")}>Approve</button>
                    <button className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => action(doc.id, "Rejected")}>Reject</button>
                    <button className="rounded-xl border px-3 py-2 text-sm font-semibold" onClick={() => action(doc.id, "Missing")}>Request replacement</button>
                    <button className="rounded-xl border px-3 py-2 text-sm font-semibold" onClick={() => action(doc.id, "Waived")}>Waive</button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
        {!docs.length && <Empty />}
      </div>
    </div>
  );
}

function Agreements({ state, setState, familyId, notify }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>>; familyId: string; notify: (message: string) => void }) {
  const [signer, setSigner] = useState("");
  const sign = (id: string) => {
    if (!signer.trim()) return notify("Type signer name before saving acknowledgment.");
    setState({ ...state, agreements: state.agreements.map((a) => (a.id === id ? { ...a, status: "Signed", signer, dateReviewed: "2026-07-24" } : a)) });
    notify("Agreement acknowledgment saved.");
  };
  return (
    <div className="space-y-6">
      <PageTitle title="Agreements" subtitle="Electronic acknowledgments use typed name, checkbox confirmation, and review date." />
      <Card>
        <label className="font-semibold text-slate-600">Typed signer name<input className="mt-1 w-full rounded-xl border px-3 py-2" value={signer} onChange={(e) => setSigner(e.target.value)} placeholder="Parent / guardian legal name" /></label>
        <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" defaultChecked /> I agree that my typed name represents my signature.</label>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        {state.agreements.filter((a) => a.familyId === familyId).map((a) => (
          <Card key={a.id}>
            <div className="flex items-start justify-between gap-3"><h3 className="font-bold text-navy">{a.title}</h3><StatusBadge status={a.status} /></div>
            <p className="mt-2 text-sm text-slate-500">Version {a.version} · Reviewed {a.dateReviewed ? formatDate(a.dateReviewed) : "not yet"} {a.signer ? `· ${a.signer}` : ""}</p>
            <div className="mt-4 flex gap-2"><button className="rounded-xl border px-3 py-2 text-sm font-semibold" onClick={() => notify(`${a.title} opened for review.`)}>View</button><button className="rounded-xl bg-navy px-3 py-2 text-sm font-semibold text-white" onClick={() => sign(a.id)}>Acknowledge / Sign</button></div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Tuition({ state, setState, familyId, notify, parent = false }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>>; familyId?: string; notify: (message: string) => void; parent?: boolean }) {
  const accounts = state.tuition.filter((a) => !familyId || a.familyId === familyId);
  const update = (familyId: string, patch: Partial<TuitionAccount>, message: string) => {
    setState({ ...state, tuition: state.tuition.map((a) => (a.familyId === familyId ? { ...a, ...patch } : a)) });
    notify(message);
  };
  return (
    <div className="space-y-6">
      <PageTitle title={parent ? "Tuition" : "Tuition Administration"} subtitle={parent ? "Charges, credits, payment plans, invoices, receipts, and payment history." : "Family tuition accounts, adjustments, failed-payment list, aging, and arrangements."} />
      {accounts.map((a) => (
        <Card key={a.familyId}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-xl font-bold text-navy">{state.families.find((f) => f.id === a.familyId)?.name} family account</h3>
              <p className="text-sm text-slate-500">Plan: {a.plan} · Next installment: {upcomingPayment(a)}</p>
            </div>
            <StatusBadge status={total(a) - a.paid > 0 ? "Balance due" : "Paid in full"} />
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <Info label="Annual tuition" value={currency(a.annualTuition)} /><Info label="School fees" value={currency(a.fees)} /><Info label="Transportation" value={currency(a.transportation)} /><Info label="Registration" value={currency(a.registration)} />
            <Info label="Discounts" value={currency(a.discounts)} /><Info label="Scholarships" value={currency(a.scholarships)} /><Info label="Credits" value={currency(a.credits)} /><Info label="Paid" value={currency(a.paid)} />
            <Info label="Total obligation" value={currency(total(a))} /><Info label="Remaining balance" value={currency(total(a) - a.paid)} /><Info label="Failed payments" value={String(a.failedPayments)} /><Info label="Invoices/receipts" value="INV-101, RCT-205" />
          </div>
          {parent ? (
            <div className="mt-5 rounded-2xl bg-ivory p-4">
              <p className="font-semibold text-navy">Payment method</p>
              <p className="mt-1 text-sm text-slate-600">Payment information will be securely handled by the payment processor in a later phase. No full card numbers are collected or displayed.</p>
              <button className="mt-3 rounded-xl bg-navy px-4 py-2 font-semibold text-white" onClick={() => notify("Secure payment method flow is reserved for a later payment-processor phase.")}>Add Secure Payment Method</button>
            </div>
          ) : (
            <div className="mt-5 flex flex-wrap gap-2">
              <button className="rounded-xl border px-3 py-2 text-sm font-semibold" onClick={() => update(a.familyId, { fees: a.fees + 100 }, "Charge added.")}>Add charge</button>
              <button className="rounded-xl border px-3 py-2 text-sm font-semibold" onClick={() => update(a.familyId, { discounts: a.discounts + 100 }, "Discount added.")}>Add discount</button>
              <button className="rounded-xl border px-3 py-2 text-sm font-semibold" onClick={() => update(a.familyId, { credits: a.credits + 100 }, "Credit applied.")}>Apply credit</button>
              <button className="rounded-xl border px-3 py-2 text-sm font-semibold" onClick={() => update(a.familyId, { fees: Math.max(0, a.fees - 50) }, "Late fee waived.")}>Waive late fee</button>
              <button className="rounded-xl border px-3 py-2 text-sm font-semibold" onClick={() => update(a.familyId, { paid: a.paid + 500 }, "Manual payment recorded.")}>Record manual payment</button>
              <button className="rounded-xl border px-3 py-2 text-sm font-semibold" onClick={() => update(a.familyId, { nextDue: "2026-09-01" }, "Payment due date changed.")}>Change due date</button>
              <button className="rounded-xl bg-navy px-3 py-2 text-sm font-semibold text-white" onClick={() => update(a.familyId, { plan: "Custom arrangement", collectionNotes: [...a.collectionNotes, "Custom arrangement created."] }, "Payment arrangement created.")}>Create arrangement</button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function AdminDashboard({ state, role }: { state: AppState; role: Role }) {
  const expected = state.tuition.reduce((sum, a) => sum + total(a), 0);
  const collected = state.tuition.reduce((sum, a) => sum + a.paid, 0);
  const gradeCounts = countBy(state.students, "grade");
  const statusCounts = countBy(state.families, "status");
  const base = roleBasePath(role);
  const workQueues = [
    {
      title: "Registration applications to review",
      count: state.families.filter((f) => ["Submitted", "Under Review", "Incomplete", "Interview Required"].includes(f.status)).length,
      description: "Review submissions, request corrections, and move families through admissions.",
      to: `${base}/registration`,
      roles: ["super_admin", "registration_office", "school_management"] as Role[],
    },
    {
      title: "Documents needing review",
      count: state.documents.filter((d) => ["Uploaded", "Under Review"].includes(d.status)).length,
      description: "Approve, reject, waive, or request replacement documents.",
      to: `${base}/documents`,
      roles: ["super_admin", "registration_office", "school_management"] as Role[],
    },
    {
      title: "Missing parent items",
      count: state.documents.filter((d) => ["Missing", "Rejected", "Expired", "Not Started"].includes(d.status)).length,
      description: "Follow up with families before registration deadlines.",
      to: `${base}/documents`,
      roles: ["super_admin", "registration_office", "school_management"] as Role[],
    },
    {
      title: "Tuition accounts needing attention",
      count: state.tuition.filter((a) => a.failedPayments > 0 || total(a) - a.paid > 0).length,
      description: "Review balances, failed payments, plans, and collection notes.",
      to: `${base}/tuition`,
      roles: ["super_admin", "tuition_office", "school_management"] as Role[],
    },
  ].filter((item) => item.roles.includes(role));
  return (
    <div className="space-y-6">
      <PageTitle title="Admin Dashboard" subtitle={`Role-aware overview for ${role}.`} />
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Total families" value={state.families.length} to={`${base}/families`} /><Stat label="Total students" value={state.students.length} to={`${base}/students`} /><Stat label="New applications" value={state.students.filter((s) => s.newReturning === "New").length} to={`${base}/registration`} /><Stat label="In progress" value={state.families.filter((f) => f.status === "In Progress").length} to={`${base}/registration`} /><Stat label="Awaiting review" value={state.families.filter((f) => f.status === "Under Review").length} to={`${base}/admissions`} />
        <Stat label="Missing documents" value={state.documents.filter((d) => d.status === "Missing").length} tone="red" to={`${base}/documents`} /><Stat label="Docs awaiting review" value={state.documents.filter((d) => d.status === "Under Review").length} to={`${base}/documents`} /><Stat label="Fully enrolled" value={state.students.filter((s) => s.registrationStatus === "Fully Enrolled").length} to={`${base}/students`} /><Stat label="Expected tuition" value={currency(expected)} to={`${base}/tuition`} /><Stat label="Collected" value={currency(collected)} to={`${base}/payments`} />
        <Stat label="Outstanding" value={currency(expected - collected)} to={`${base}/tuition`} /><Stat label="Overdue balances" value={state.students.filter((s) => s.tuitionStatus === "Overdue").length} tone="red" to={`${base}/tuition`} /><Stat label="Failed payments" value={state.tuition.reduce((sum, a) => sum + a.failedPayments, 0)} tone="red" to={`${base}/payments`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {workQueues.map((queue) => (
          <Link key={queue.title} to={queue.to} className="block rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:-translate-y-0.5 hover:border-gold hover:shadow-lg focus-visible:bg-ivory">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-bold text-navy">{queue.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{queue.description}</p>
              </div>
              <span className={`rounded-2xl px-4 py-2 text-xl font-bold ${queue.count ? "bg-gold/20 text-burgundy" : "bg-emerald-50 text-emerald-700"}`}>{queue.count}</span>
            </div>
            <p className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-burgundy">Open queue <ArrowRight className="h-4 w-4" aria-hidden="true" /></p>
          </Link>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <MiniChart title="Enrollment by grade" data={gradeCounts} />
        <MiniChart title="Registration status" data={statusCounts} />
        <MiniChart title="Tuition collected vs outstanding" data={{ Collected: collected, Outstanding: expected - collected }} />
      </div>
      <MiniChart title="Missing requirements by category" data={countBy(state.documents.filter((d) => d.status === "Missing"), "category")} />
    </div>
  );
}

const zeroTuitionAccount = (familyId: string): TuitionAccount => ({
  familyId,
  annualTuition: 0,
  fees: 0,
  transportation: 0,
  registration: 0,
  discounts: 0,
  scholarships: 0,
  credits: 0,
  paid: 0,
  plan: "Custom arrangement",
  nextDue: "",
  failedPayments: 0,
  collectionNotes: [],
});

function FamiliesTable({ state, setState, currentRole, notify }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>>; currentRole: Role; notify: (message: string) => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    family_code: "",
    family_name: "",
    guardian_name: "",
    guardian_email: "",
    primary_phone: "",
    address_line1: "",
    city: "",
    state: "NJ",
    postal_code: "",
    shul: "",
  });
  const staffBase = `/${useLocation().pathname.split("/")[1] || "admin"}`;
  const canAddFamily = currentRole === "super_admin" || currentRole === "registration_office";
  const rows = state.families.filter((f) => {
    const familyStudents = state.students.filter((s) => s.familyId === f.id).map((s) => s.legalName).join(" ");
    const haystack = `${f.id} ${f.name} ${f.parents.map((p) => p.name).join(" ")} ${familyStudents} ${f.phone} ${f.email}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) && (status === "All" || f.status === status);
  });
  const updateForm = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const saveFamily = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!canAddFamily) return setError("Your role cannot create family records.");
    if (!form.family_code.trim()) return setError("Family ID/code is required.");
    if (!form.family_name.trim()) return setError("Family name is required.");
    if (!form.guardian_email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.guardian_email.trim())) return setError("Enter a valid guardian email.");
    if (!supabase) return setError("Supabase is not configured.");

    setSaving(true);
    const guardian = {
      name: form.guardian_name.trim(),
      relationship: "Guardian",
      phone: form.primary_phone.trim(),
      email: form.guardian_email.trim().toLowerCase(),
      employer: "",
    };
    const { data, error: insertError } = await supabase
      .from("families")
      .insert({
        family_code: form.family_code.trim(),
        family_name: form.family_name.trim(),
        address_line1: form.address_line1.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        postal_code: form.postal_code.trim(),
        primary_email: form.guardian_email.trim().toLowerCase(),
        primary_phone: form.primary_phone.trim(),
        shul: form.shul.trim(),
        guardians: [guardian],
        registration_status: "in_progress",
        registration_percent: 0,
      })
      .select("id,family_code,family_name,address_line1,city,state,postal_code,primary_email,primary_phone,shul,guardians,registration_status,registration_percent")
      .single();
    setSaving(false);

    if (insertError || !data) return setError(insertError?.message || "Family could not be created.");

    const newFamily: Family = {
      id: data.family_code ?? data.id,
      dbId: data.id,
      code: data.family_code ?? data.id,
      name: data.family_name,
      address: data.address_line1 ?? "",
      city: data.city ?? "",
      state: data.state ?? "",
      zip: data.postal_code ?? "",
      phone: data.primary_phone ?? "",
      email: data.primary_email ?? "",
      shul: data.shul ?? "",
      emergencyContacts: [],
      maternalGrandparents: "",
      paternalGrandparents: "",
      parents: Array.isArray(data.guardians) ? data.guardians : [guardian],
      status: toRegistrationStatus(data.registration_status),
      registrationPercent: data.registration_percent ?? 0,
    };

    if (currentRole === "super_admin") {
      await supabase.from("tuition_accounts").insert({
        family_id: data.id,
        annual_tuition: 0,
        fees: 0,
        transportation: 0,
        registration_fee: 0,
        discounts: 0,
        scholarships: 0,
        credits: 0,
        paid: 0,
        plan_name: "Custom arrangement",
      });
    }

    setState((current) => ({
      ...current,
      families: [newFamily, ...current.families.filter((family) => family.id !== newFamily.id)],
      tuition: current.tuition.some((account) => account.familyId === newFamily.id) ? current.tuition : [zeroTuitionAccount(newFamily.id), ...current.tuition],
    }));
    notify(`${newFamily.name} family record created.`);
    setForm({ family_code: "", family_name: "", guardian_name: "", guardian_email: "", primary_phone: "", address_line1: "", city: "", state: "NJ", postal_code: "", shul: "" });
    setShowAdd(false);
  };

  return (
    <div className="space-y-6">
      <PageTitle title="Families" subtitle="Search by family, parent, student, phone, email, or family ID." />
      {canAddFamily && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-navy">Create family record</h3>
              <p className="mt-1 text-sm text-slate-600">Add a family here first, then invite parent/guardian accounts from Users & Access.</p>
            </div>
            <button onClick={() => setShowAdd((value) => !value)} className="rounded-xl bg-burgundy px-5 py-3 font-bold text-white hover:bg-burgundy-dark">{showAdd ? "Close" : "Add Family"}</button>
          </div>
          {showAdd && (
            <form onSubmit={saveFamily} className="mt-5 grid gap-4">
              {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <label className="text-sm font-semibold text-slate-700">Family ID / Code<input className="mt-1 w-full rounded-xl border px-4 py-3" value={form.family_code} onChange={(event) => updateForm("family_code", event.target.value)} placeholder="FAM-1002" /></label>
                <label className="text-sm font-semibold text-slate-700">Family name<input className="mt-1 w-full rounded-xl border px-4 py-3" value={form.family_name} onChange={(event) => updateForm("family_name", event.target.value)} placeholder="Cohen Family" /></label>
                <label className="text-sm font-semibold text-slate-700">Guardian name<input className="mt-1 w-full rounded-xl border px-4 py-3" value={form.guardian_name} onChange={(event) => updateForm("guardian_name", event.target.value)} placeholder="Mrs. Cohen" /></label>
                <label className="text-sm font-semibold text-slate-700">Guardian email<input className="mt-1 w-full rounded-xl border px-4 py-3" type="email" value={form.guardian_email} onChange={(event) => updateForm("guardian_email", event.target.value)} /></label>
                <label className="text-sm font-semibold text-slate-700">Phone<input className="mt-1 w-full rounded-xl border px-4 py-3" value={form.primary_phone} onChange={(event) => updateForm("primary_phone", event.target.value)} /></label>
                <label className="text-sm font-semibold text-slate-700">Shul<input className="mt-1 w-full rounded-xl border px-4 py-3" value={form.shul} onChange={(event) => updateForm("shul", event.target.value)} /></label>
                <label className="text-sm font-semibold text-slate-700 md:col-span-2">Address<input className="mt-1 w-full rounded-xl border px-4 py-3" value={form.address_line1} onChange={(event) => updateForm("address_line1", event.target.value)} /></label>
                <label className="text-sm font-semibold text-slate-700">City<input className="mt-1 w-full rounded-xl border px-4 py-3" value={form.city} onChange={(event) => updateForm("city", event.target.value)} /></label>
                <label className="text-sm font-semibold text-slate-700">State<input className="mt-1 w-full rounded-xl border px-4 py-3" value={form.state} onChange={(event) => updateForm("state", event.target.value)} /></label>
                <label className="text-sm font-semibold text-slate-700">ZIP<input className="mt-1 w-full rounded-xl border px-4 py-3" value={form.postal_code} onChange={(event) => updateForm("postal_code", event.target.value)} /></label>
              </div>
              <button disabled={saving} className="w-fit rounded-xl bg-navy px-5 py-3 font-bold text-white hover:bg-navy/90 disabled:opacity-60">{saving ? "Creating..." : "Create Family"}</button>
            </form>
          )}
        </Card>
      )}
      <SearchBar query={query} setQuery={setQuery} />
      <FilterBar value={status} setValue={setStatus} options={["All", ...Array.from(new Set(state.families.map((f) => f.status)))]} />
      <Table headers={["Family ID", "Family", "Parents", "Address", "Children", "Registration", "Balance", "Status", ""]}>
        {rows.map((f) => {
          const account = state.tuition.find((a) => a.familyId === f.id) ?? zeroTuitionAccount(f.id);
          return <tr key={f.id}><td>{f.id}</td><td>{f.name}</td><td>{f.parents.map((p) => p.name).join(", ")}</td><td>{f.address}</td><td>{state.students.filter((s) => s.familyId === f.id).length}</td><td>{f.registrationPercent}%</td><td>{currency(total(account) - account.paid)}</td><td><StatusBadge status={f.status} /></td><td><Link to={`${staffBase}/families/${f.id}`} className="text-navy font-bold">View</Link></td></tr>;
        })}
      </Table>
    </div>
  );
}

function StudentsTable({ state, setState, currentRole, notify }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>>; currentRole: Role; notify: (message: string) => void }) {
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const blankStudentForm = {
    familyId: "",
    legalName: "",
    preferredName: "",
    dob: "",
    gender: "",
    grade: "",
    program: "General Studies",
    newReturning: "New" as Student["newReturning"],
    transportation: "To be confirmed",
    previousSchool: "",
    medicalAlerts: "None",
    physicianName: "",
    physicianPhone: "",
    emergencyInfo: "",
    authorizedPickup: "",
  };
  const [form, setForm] = useState(blankStudentForm);
  const staffBase = `/${useLocation().pathname.split("/")[1] || "admin"}`;
  const canManageStudents = currentRole === "super_admin" || currentRole === "registration_office";
  const familyName = (familyId: string) => {
    const family = state.families.find((item) => item.id === familyId);
    return family ? `${family.name} · ${family.code ?? family.id}` : familyId;
  };
  const rows = state.students.filter((s) => `${s.preferredName} ${s.legalName} ${s.grade} ${familyName(s.familyId)} ${s.program}`.toLowerCase().includes(query.toLowerCase()) && (grade === "All" || s.grade === grade));
  const selectedFamily = state.families.find((family) => family.id === form.familyId);
  const updateForm = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const resetForm = () => {
    setForm(blankStudentForm);
    setEditingId(null);
    setShowAdd(false);
    setError("");
  };
  const openCreate = () => {
    setForm(blankStudentForm);
    setEditingId(null);
    setShowAdd((value) => !value);
    setError("");
  };
  const openEdit = (student: Student) => {
    setForm({
      familyId: student.familyId,
      legalName: student.legalName,
      preferredName: student.preferredName,
      dob: student.dob,
      gender: student.gender,
      grade: student.grade,
      program: student.program || "General Studies",
      newReturning: student.newReturning,
      transportation: student.transportation,
      previousSchool: student.previousSchool,
      medicalAlerts: student.medicalAlerts,
      physicianName: student.physicianName,
      physicianPhone: student.physicianPhone,
      emergencyInfo: student.emergencyInfo,
      authorizedPickup: student.authorizedPickup,
    });
    setEditingId(student.id);
    setShowAdd(true);
    setError("");
  };
  const saveStudent = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!canManageStudents) return setError("Your role cannot create or edit student records.");
    if (!selectedFamily) return setError("Choose a family before saving the student.");
    if (!form.legalName.trim()) return setError("Legal name is required.");
    if (!form.grade.trim()) return setError("Grade is required.");
    if (!supabase) return setError("Supabase is not configured.");

    setSaving(true);
    const duplicate = !editingId
      ? state.students.some((student) => student.familyId === selectedFamily.id && student.legalName.trim().toLowerCase() === form.legalName.trim().toLowerCase() && (!form.dob || student.dob === form.dob))
      : false;
    if (duplicate) {
      setSaving(false);
      return setError("This family already has a student with that name and date of birth.");
    }

    const existingStudent = editingId ? state.students.find((student) => student.id === editingId) : null;
    const dbStatus = (value: string) => value.toLowerCase().replaceAll(" ", "_");
    const studentPayload = {
      family_id: selectedFamily.dbId ?? selectedFamily.id,
      legal_name: form.legalName.trim(),
      preferred_name: form.preferredName.trim() || form.legalName.trim(),
      date_of_birth: form.dob || null,
      gender: form.gender.trim() || null,
      grade: form.grade.trim(),
      program: form.program.trim(),
      new_returning: form.newReturning,
      registration_status: existingStudent ? dbStatus(existingStudent.registrationStatus) : "in_progress",
      document_status: existingStudent ? dbStatus(existingStudent.documentStatus) : "missing",
      tuition_status: existingStudent ? dbStatus(existingStudent.tuitionStatus) : "current",
      transportation: form.transportation.trim(),
      previous_school: form.previousSchool.trim() || null,
      medical_alerts: form.medicalAlerts.trim() || "None",
      physician_name: form.physicianName.trim() || null,
      physician_phone: form.physicianPhone.trim() || null,
      emergency_info: form.emergencyInfo.trim() || null,
      authorized_pickup: form.authorizedPickup.split(",").map((item) => item.trim()).filter(Boolean),
      progress: editingId ? state.students.find((student) => student.id === editingId)?.progress ?? 0 : 0,
    };

    const mutation = editingId
      ? supabase.from("students").update(studentPayload).eq("id", editingId)
      : supabase.from("students").insert(studentPayload);
    const { data, error: saveError } = await mutation
      .select("id,family_id,legal_name,preferred_name,date_of_birth,gender,grade,program,new_returning,registration_status,document_status,tuition_status,transportation,previous_school,medical_alerts,physician_name,physician_phone,emergency_info,authorized_pickup,progress")
      .single();
    setSaving(false);
    if (saveError || !data) return setError(saveError?.message || "Student record could not be saved.");

    const savedStudent: Student = {
      id: data.id,
      familyId: selectedFamily.id,
      preferredName: data.preferred_name ?? data.legal_name,
      legalName: data.legal_name,
      dob: data.date_of_birth ?? "",
      grade: data.grade ?? "",
      gender: data.gender ?? "",
      program: data.program ?? "",
      newReturning: data.new_returning === "Returning" ? "Returning" : "New",
      registrationStatus: toRegistrationStatus(data.registration_status),
      documentStatus: toDocStatus(data.document_status),
      tuitionStatus: toTuitionStatus(data.tuition_status),
      medicalAlerts: data.medical_alerts ?? "None",
      previousSchool: data.previous_school ?? "",
      physicianName: data.physician_name ?? "",
      physicianPhone: data.physician_phone ?? "",
      emergencyInfo: data.emergency_info ?? "",
      authorizedPickup: Array.isArray(data.authorized_pickup) ? data.authorized_pickup.join(", ") : "",
      transportation: data.transportation ?? "",
      progress: data.progress ?? 0,
    };
    setState((current) => ({ ...current, students: [savedStudent, ...current.students.filter((student) => student.id !== savedStudent.id)] }));
    notify(`${savedStudent.legalName} student record ${editingId ? "updated" : "created"}.`);
    resetForm();
  };
  return (
    <div className="space-y-6">
      <PageTitle title="Students" subtitle="Student roster with enrollment, medical, transportation, document, and tuition status." />
      {canManageStudents && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-navy">{editingId ? "Edit student record" : "Create student record"}</h3>
              <p className="mt-1 text-sm text-slate-600">Attach students to families and keep profile, medical, transportation, and registration details in Supabase.</p>
            </div>
            <button onClick={openCreate} className="rounded-xl bg-burgundy px-5 py-3 font-bold text-white hover:bg-burgundy-dark">{showAdd && !editingId ? "Close" : "Add Student"}</button>
          </div>
          {showAdd && (
            <form onSubmit={saveStudent} className="mt-5 grid gap-4">
              {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <label className="text-sm font-semibold text-slate-700">Family<select className="mt-1 w-full rounded-xl border px-4 py-3" value={form.familyId} onChange={(event) => updateForm("familyId", event.target.value)}>
                  <option value="">Choose family...</option>
                  {state.families.map((family) => <option key={family.id} value={family.id}>{family.name} · {family.code ?? family.id}</option>)}
                </select></label>
                <label className="text-sm font-semibold text-slate-700">Legal name<input className="mt-1 w-full rounded-xl border px-4 py-3" value={form.legalName} onChange={(event) => updateForm("legalName", event.target.value)} /></label>
                <label className="text-sm font-semibold text-slate-700">Preferred name<input className="mt-1 w-full rounded-xl border px-4 py-3" value={form.preferredName} onChange={(event) => updateForm("preferredName", event.target.value)} /></label>
                <label className="text-sm font-semibold text-slate-700">Date of birth<input className="mt-1 w-full rounded-xl border px-4 py-3" type="date" value={form.dob} onChange={(event) => updateForm("dob", event.target.value)} /></label>
                <label className="text-sm font-semibold text-slate-700">Grade<input className="mt-1 w-full rounded-xl border px-4 py-3" value={form.grade} onChange={(event) => updateForm("grade", event.target.value)} placeholder="Pre-1A" /></label>
                <label className="text-sm font-semibold text-slate-700">Program<input className="mt-1 w-full rounded-xl border px-4 py-3" value={form.program} onChange={(event) => updateForm("program", event.target.value)} /></label>
                <label className="text-sm font-semibold text-slate-700">Gender<input className="mt-1 w-full rounded-xl border px-4 py-3" value={form.gender} onChange={(event) => updateForm("gender", event.target.value)} /></label>
                <label className="text-sm font-semibold text-slate-700">Student type<select className="mt-1 w-full rounded-xl border px-4 py-3" value={form.newReturning} onChange={(event) => updateForm("newReturning", event.target.value)}>
                  <option>New</option>
                  <option>Returning</option>
                </select></label>
                <label className="text-sm font-semibold text-slate-700">Transportation<input className="mt-1 w-full rounded-xl border px-4 py-3" value={form.transportation} onChange={(event) => updateForm("transportation", event.target.value)} /></label>
                <label className="text-sm font-semibold text-slate-700">Previous school<input className="mt-1 w-full rounded-xl border px-4 py-3" value={form.previousSchool} onChange={(event) => updateForm("previousSchool", event.target.value)} /></label>
                <label className="text-sm font-semibold text-slate-700">Medical alerts<input className="mt-1 w-full rounded-xl border px-4 py-3" value={form.medicalAlerts} onChange={(event) => updateForm("medicalAlerts", event.target.value)} placeholder="None, allergies, asthma..." /></label>
                <label className="text-sm font-semibold text-slate-700">Physician name<input className="mt-1 w-full rounded-xl border px-4 py-3" value={form.physicianName} onChange={(event) => updateForm("physicianName", event.target.value)} /></label>
                <label className="text-sm font-semibold text-slate-700">Physician phone<input className="mt-1 w-full rounded-xl border px-4 py-3" value={form.physicianPhone} onChange={(event) => updateForm("physicianPhone", event.target.value)} /></label>
              </div>
              <label className="text-sm font-semibold text-slate-700">Emergency information<textarea className="mt-1 min-h-24 w-full rounded-xl border px-4 py-3" value={form.emergencyInfo} onChange={(event) => updateForm("emergencyInfo", event.target.value)} placeholder="Emergency notes, allergies, medications, or important care instructions." /></label>
              <label className="text-sm font-semibold text-slate-700">Authorized pickup contacts<textarea className="mt-1 min-h-20 w-full rounded-xl border px-4 py-3" value={form.authorizedPickup} onChange={(event) => updateForm("authorizedPickup", event.target.value)} placeholder="Separate names with commas." /></label>
              <div className="flex flex-wrap gap-3">
                <button disabled={saving} className="rounded-xl bg-navy px-5 py-3 font-bold text-white hover:bg-navy/90 disabled:opacity-60">{saving ? "Saving..." : editingId ? "Save Student" : "Create Student"}</button>
                <button type="button" onClick={resetForm} className="rounded-xl border px-5 py-3 font-bold text-navy hover:bg-ivory">Cancel</button>
              </div>
            </form>
          )}
        </Card>
      )}
      <SearchBar query={query} setQuery={setQuery} />
      <FilterBar value={grade} setValue={setGrade} options={["All", ...Array.from(new Set(state.students.map((s) => s.grade)))]} />
      <Table headers={["Student", "Family", "Grade", "Program", "Medical", "Registration", "Documents", "Tuition", "Actions"]}>
        {rows.map((s) => (
          <tr key={s.id}>
            <td><p className="font-bold text-navy">{s.legalName}</p><p className="text-xs text-slate-500">{s.preferredName !== s.legalName ? s.preferredName : s.newReturning}</p></td>
            <td>{familyName(s.familyId)}</td>
            <td>{s.grade || "—"}</td>
            <td>{s.program || "—"}</td>
            <td>{s.medicalAlerts || "None"}</td>
            <td><StatusBadge status={s.registrationStatus} /></td>
            <td><StatusBadge status={s.documentStatus} /></td>
            <td><StatusBadge status={s.tuitionStatus} /></td>
            <td><div className="flex flex-wrap gap-2"><Link to={`${staffBase}/students/${s.id}`} className="font-bold text-navy">View</Link>{canManageStudents && <button type="button" onClick={() => openEdit(s)} className="font-bold text-burgundy hover:text-burgundy-dark">Edit</button>}</div></td>
          </tr>
        ))}
      </Table>
      {!rows.length && <Empty title="No students found" text="Try a different search or add the first student for a family." />}
    </div>
  );
}

function FamilyDetail({ state }: { state: AppState }) {
  const { familyId } = useParams();
  const family = state.families.find((f) => f.id === familyId);
  if (!family) return <Empty />;
  const students = state.students.filter((s) => s.familyId === family.id);
  const account = state.tuition.find((a) => a.familyId === family.id)!;
  const tabs = ["Overview", "Parents and Guardians", "Students", "Registration", "Documents", "Agreements", "Tuition", "Payments", "Notes", "Activity History"];
  return (
    <div className="space-y-6">
      <PageTitle title={`${family.name} Family`} subtitle={`${family.id} · ${family.address}, ${family.city}, ${family.state}`} />
      <Card className="bg-navy text-white"><div className="grid gap-3 md:grid-cols-4"><Info label="Family status" value={family.status} light /><Info label="Registration" value={`${family.registrationPercent}%`} light /><Info label="Students" value={String(students.length)} light /><Info label="Tuition balance" value={currency(total(account) - account.paid)} light /></div></Card>
      <div className="flex flex-wrap gap-2">{tabs.map((tab) => <span key={tab} className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-navy shadow-sm">{tab}</span>)}</div>
      <div className="grid gap-4 lg:grid-cols-2"><Card><h3 className="font-bold text-navy">Parents and Guardians</h3>{family.parents.map((p) => <p key={p.email} className="mt-2 text-slate-600">{p.name} · {p.email} · {p.employer}</p>)}</Card><Card><h3 className="font-bold text-navy">Activity History</h3><p className="mt-2 text-slate-600">Registration autosaved, document replacement requested, tuition note reviewed.</p></Card></div>
    </div>
  );
}

function StudentDetail({ state, admin = false }: { state: AppState; admin?: boolean }) {
  const { studentId } = useParams();
  const student = state.students.find((s) => s.id === studentId);
  if (!student) return <Empty />;
  const family = state.families.find((f) => f.id === student.familyId)!;
  return (
    <div className="space-y-6">
      <PageTitle title={student.legalName} subtitle={`${student.program} · Grade ${student.grade} · ${family.name} family`} />
      <Card className="grid gap-4 md:grid-cols-3">
        <Info label="Preferred name" value={student.preferredName} /><Info label="Date of birth" value={formatDate(student.dob)} /><Info label="Gender" value={student.gender || "—"} /><Info label="Enrollment status" value={student.registrationStatus} /><Info label="Student type" value={student.newReturning} /><Info label="Previous school" value={student.previousSchool || "—"} /><Info label="Medical alerts" value={student.medicalAlerts || "None"} /><Info label="Physician" value={student.physicianName || "—"} /><Info label="Physician phone" value={student.physicianPhone || "—"} /><Info label="Transportation" value={student.transportation || "—"} />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><h3 className="font-bold text-navy">Required forms & documents</h3>{state.documents.filter((d) => d.familyId === student.familyId).slice(0, 6).map((d) => <p className="mt-2 flex justify-between" key={d.id}>{d.type}<StatusBadge status={d.status} /></p>)}</Card>
        <Card><h3 className="font-bold text-navy">Emergency contacts & authorized pickup</h3><p className="mt-2 text-slate-600">{family.emergencyContacts.join(" • ") || "No family emergency contacts saved yet."}</p><p className="mt-3 text-slate-600">Student emergency notes: {student.emergencyInfo || "None"}</p><p className="mt-3 text-slate-600">Authorized pickup: {student.authorizedPickup || "Parents, listed grandparents, and approved carpool contacts."}</p></Card>
      </div>
      {admin && <Card><h3 className="font-bold text-navy">Internal notes</h3><p className="mt-2 text-slate-600">Office note: verify medical plan before final enrollment packet is released.</p></Card>}
    </div>
  );
}

function RegistrationQueue({ state, setState, currentRole, notify }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>>; currentRole: Role; notify: (message: string) => void }) {
  return <FamiliesTable state={{ ...state, families: state.families.filter((f) => f.status !== "Fully Enrolled") }} setState={setState} currentRole={currentRole} notify={notify} />;
}

function Admissions({ state, setState, notify }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>>; notify: (message: string) => void }) {
  const setStatus = (familyId: string, status: RegistrationStatus) => {
    setState({ ...state, families: state.families.map((f) => (f.id === familyId ? { ...f, status } : f)) });
    notify(`Admissions status changed to ${status}.`);
  };
  return (
    <div className="space-y-6">
      <PageTitle title="Admissions Review" subtitle="Move families through submitted, incomplete, interview, accepted, waitlisted, contract, deposit, and enrolled states." />
      {state.families.map((f) => <Card key={f.id}><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h3 className="font-bold text-navy">{f.name} family</h3><StatusBadge status={f.status} /></div><select className="rounded-xl border px-3 py-2" value={f.status} onChange={(e) => setStatus(f.id, e.target.value as RegistrationStatus)}>{["Not Started", "In Progress", "Submitted", "Incomplete", "Under Review", "Interview Required", "Accepted", "Waitlisted", "Declined", "Contract Pending", "Deposit Pending", "Fully Enrolled"].map((s) => <option key={s}>{s}</option>)}</select></div></Card>)}
    </div>
  );
}

function Payments({ state, familyId }: { state: AppState; familyId?: string }) {
  const accounts = state.tuition.filter((a) => !familyId || a.familyId === familyId);
  return (
    <div className="space-y-6">
      <PageTitle title="Payments" subtitle="Invoices, receipts, payment history, overdue balances, failed payments, aging, and collection notes." />
      <Table headers={["Family", "Plan", "Paid", "Remaining", "Next Due", "Failed", "Notes"]}>
        {accounts.map((a) => <tr key={a.familyId}><td>{a.familyId}</td><td>{a.plan}</td><td>{currency(a.paid)}</td><td>{currency(total(a) - a.paid)}</td><td>{upcomingPayment(a)}</td><td>{a.failedPayments}</td><td>{a.collectionNotes.join(" ") || "—"}</td></tr>)}
      </Table>
    </div>
  );
}

function Reports({ state, notify }: { state: AppState; notify: (message: string) => void }) {
  const reports = ["Enrollment by grade", "Registration status", "Missing documents", "Medical-document status", "Tuition charged", "Tuition collected", "Outstanding balances", "30/60/90-day aging", "Discounts and scholarships", "Deposits received", "Monthly collection report"];
  const exportCsv = (name: string) => {
    const csv = ["Report,Value", `${name},${new Date().toISOString()}`, `Families,${state.families.length}`, `Students,${state.students.length}`].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = `${name.toLowerCase().replaceAll(" ", "-")}.csv`;
    link.click();
    notify("CSV export generated.");
  };
  return (
    <div className="space-y-6">
      <PageTitle title="Reports" subtitle="Operational and tuition reports with filters and CSV exports." />
      <FilterBar value="2026-2027" setValue={() => notify("Academic-year filter applied.")} options={["2026-2027", "Preschool", "Elementary", "Middle School"]} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{reports.map((report) => <Card key={report}><h3 className="font-bold text-navy">{report}</h3><p className="mt-2 text-sm text-slate-600">Filtered summary generated for the selected report.</p><button className="mt-4 rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white" onClick={() => exportCsv(report)}><Download className="mr-2 inline h-4 w-4" aria-hidden="true" />Export CSV</button></Card>)}</div>
    </div>
  );
}

function Messages({ state, familyId, notify }: { state: AppState; familyId?: string; notify: (message: string) => void }) {
  const messages = state.messages.filter((m) => !familyId || m.familyId === familyId);
  return <div className="space-y-6"><PageTitle title="Messages" subtitle="Recent school communication and office notes." />{messages.map((m) => <Card key={m.id}><p className="font-bold text-navy">{m.subject}</p><p className="text-sm text-slate-500">{formatDate(m.date)} · {m.familyId}</p><p className="mt-2 text-slate-600">{m.body}</p><button className="mt-4 rounded-xl border px-4 py-2 font-semibold hover:bg-ivory" onClick={() => notify("Reply draft saved.")}>Reply</button></Card>)}{!messages.length && <Empty />}</div>;
}

function AccountSettings({ notify }: { notify: (message: string) => void }) {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [textNotifications, setTextNotifications] = useState(false);
  const [language, setLanguage] = useState("English");
  return (
    <div className="space-y-6">
      <PageTitle title="Account Settings" subtitle="Manage communication preferences, password access, language readiness, and parent notification defaults." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h3 className="text-lg font-bold text-navy">Communication</h3>
          <div className="mt-4 space-y-3">
            <ToggleRow label="Email notifications" description="Registration, documents, tuition, and school messages." checked={emailNotifications} onChange={setEmailNotifications} />
            <ToggleRow label="Text message alerts" description="Urgent missing items and office reminders." checked={textNotifications} onChange={setTextNotifications} />
          </div>
        </Card>
        <Card>
          <h3 className="text-lg font-bold text-navy">Language</h3>
          <label className="mt-4 block text-sm font-semibold text-slate-700">
            Preferred portal language
            <select className="mt-1 w-full rounded-xl border px-4 py-3" value={language} onChange={(event) => setLanguage(event.target.value)}>
              <option>English</option>
              <option>Yiddish</option>
            </select>
          </label>
          <p className="mt-3 text-sm text-slate-600">Full translation and RTL layout are planned; this stores the user preference structure now.</p>
        </Card>
        <Card>
          <h3 className="text-lg font-bold text-navy">Security</h3>
          <p className="mt-3 text-sm text-slate-600">Use password reset if your account was invited or you need a new password.</p>
          <Link to="/reset-password" className="mt-4 inline-flex rounded-xl bg-navy px-4 py-2 font-bold text-white hover:bg-burgundy">Change password</Link>
        </Card>
      </div>
      <button className="rounded-xl bg-burgundy px-5 py-3 font-bold text-white hover:bg-burgundy-dark" onClick={() => notify("Account preferences saved for this session.")}>Save preferences</button>
    </div>
  );
}

function SchoolSettings({ role, notify }: { role: Role; notify: (message: string) => void }) {
  const readOnly = role === "school_management";
  const settingsGroups = [
    {
      title: "Academic year",
      description: "Current year label, registration open dates, grade progression, and enrollment caps.",
      items: ["School Year 2026–2027 / תשפ״ז", "Registration season: Open", "Default grade progression enabled"],
    },
    {
      title: "Document requirements",
      description: "Birth certificates, immunization forms, medical consents, handbook acknowledgments, and waiver rules.",
      items: ["Birth certificate required", "Medical consent required", "Parent handbook review required"],
    },
    {
      title: "Tuition defaults",
      description: "Payment plans, registration fees, discounts, scholarship tracking, and overdue reminders.",
      items: ["10 monthly payments", "Upcoming payment reminders enabled", "Scholarship review workflow enabled"],
    },
    {
      title: "Security & access",
      description: "Role permissions, invitation policy, disabled-account handling, and private document storage.",
      items: ["Super Admin controls staff roles", "Registration Office may invite parents", "Documents remain private"],
    },
  ];
  return (
    <div className="space-y-6">
      <PageTitle title="School Settings" subtitle="A central control room for the school year, requirements, tuition defaults, permissions, and parent-facing portal behavior." />
      {readOnly && <p className="rounded-xl border border-gold/40 bg-gold/10 p-3 text-sm font-semibold text-navy">School Management has read-only access to settings. Super Admin can make changes.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {settingsGroups.map((group) => (
          <Card key={group.title}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-navy">{group.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{group.description}</p>
              </div>
              <StatusBadge status={readOnly ? "Read-only" : "Ready"} />
            </div>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {group.items.map((item) => <li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />{item}</li>)}
            </ul>
            <button disabled={readOnly} className="mt-5 rounded-xl border border-slate-200 px-4 py-2 font-bold text-navy hover:bg-ivory disabled:opacity-50" onClick={() => notify(`${group.title} settings saved for this session.`)}>
              Configure
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-slate-200 p-3 hover:bg-ivory">
      <span>
        <span className="block font-bold text-navy">{label}</span>
        <span className="mt-1 block text-sm text-slate-600">{description}</span>
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-5 w-5 accent-burgundy" />
    </label>
  );
}

function SimplePage({ title, description }: { title: string; description: string }) {
  return <div className="space-y-6"><PageTitle title={title} subtitle={description} /><Card><p className="text-slate-600">This section is available for school configuration and future workflow settings.</p></Card></div>;
}

type AccessUser = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  status: AccountStatus;
  created_at: string;
};

type FamilyOption = {
  id: string;
  family_name: string;
  family_code: string;
};

function UsersAccess({ currentRole, notify }: { currentRole: Role; notify: (message: string) => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Role | "all">("all");
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [families, setFamilies] = useState<FamilyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSetupLink, setInviteSetupLink] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AccessUser | null>(null);
  const [accessDraft, setAccessDraft] = useState<{ role: Role; status: AccountStatus }>({ role: "parent", status: "active" });
  const [accessSaving, setAccessSaving] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);
  const [invite, setInvite] = useState({
    email: "",
    first_name: "",
    last_name: "",
    phone: "",
    role: "parent" as Role,
    family_id: "",
  });

  const canInviteStaff = currentRole === "super_admin";
  const allowedInviteRoles: Role[] = useMemo(
    () => (canInviteStaff ? ["parent", "registration_office", "tuition_office", "school_management", "super_admin"] : ["parent"]),
    [canInviteStaff],
  );

  const refreshUsers = async () => {
    if (!supabase) return;
    setLoading(true);
    const [{ data: profileRows }, { data: familyRows }] = await Promise.all([
      supabase.from("profiles").select("id,email,first_name,last_name,role,status,created_at").order("created_at", { ascending: false }),
      supabase.from("families").select("id,family_name,family_code").order("family_name"),
    ]);
    setUsers((profileRows ?? []) as AccessUser[]);
    setFamilies((familyRows ?? []) as FamilyOption[]);
    setLoading(false);
  };

  useEffect(() => {
    void refreshUsers();
  }, []);

  useEffect(() => {
    if (!allowedInviteRoles.includes(invite.role)) setInvite((value) => ({ ...value, role: "parent" }));
  }, [allowedInviteRoles, invite.role]);

  const filteredUsers = users.filter((user) => {
    const haystack = `${user.first_name} ${user.last_name} ${user.email}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) && (filter === "all" || user.role === filter);
  });

  const selectedFamily = families.find((family) => family.id === invite.family_id);

  const openAccessEditor = (user: AccessUser) => {
    setSelectedUser(user);
    setAccessDraft({ role: user.role, status: user.status });
    setAccessError(null);
    setAccessMessage(null);
  };

  const validateInvite = () => {
    if (!invite.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invite.email.trim())) return "Enter a valid email address.";
    if (!invite.first_name.trim()) return "First name is required.";
    if (!invite.last_name.trim()) return "Last name is required.";
    if (!allowedInviteRoles.includes(invite.role)) return "You do not have permission to invite that role.";
    if (invite.role === "parent" && !invite.family_id) return "Choose a family before inviting a parent.";
    return "";
  };

  const submitInvite = async (event: FormEvent) => {
    event.preventDefault();
    setInviteError(null);
    setInviteMessage(null);
    setInviteSetupLink(null);
    const validationError = validateInvite();
    if (validationError) return setInviteError(validationError);
    if (!supabase) return setInviteError("Supabase is not configured.");
    const { data: sessionData } = await supabase.auth.getSession();
    const { data: refreshedSessionData } = await supabase.auth.refreshSession();
    const accessToken = refreshedSessionData.session?.access_token ?? sessionData.session?.access_token;
    if (!accessToken) return setInviteError("Your session expired. Please sign out and sign in again.");

    setInviting(true);
    const { data, error } = await supabase.functions.invoke("invite-user", {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: {
        email: invite.email.trim(),
        first_name: invite.first_name.trim(),
        last_name: invite.last_name.trim(),
        phone: invite.phone.trim(),
        role: invite.role,
        family_id: invite.role === "parent" ? invite.family_id : undefined,
      },
    });
    setInviting(false);

    if (error) {
      const context = error.context as { json?: () => Promise<unknown>; text?: () => Promise<string> } | undefined;
      let safeFunctionError = "";
      try {
        const json = await context?.json?.();
        if (json && typeof json === "object" && "error" in json && typeof json.error === "string") safeFunctionError = json.error;
      } catch {
        try {
          const text = await context?.text?.();
          if (text) {
            const parsed = JSON.parse(text) as { error?: unknown };
            if (typeof parsed.error === "string") safeFunctionError = parsed.error;
          }
        } catch {
          // Keep the generic fallback below.
        }
      }
      const message = typeof data?.error === "string" ? data.error : safeFunctionError || error.message || "Invitation failed. Please try again.";
      return setInviteError(message);
    }

    const setupLink = typeof data?.setup_url === "string" && data.setup_url ? data.setup_url : null;
    const success = setupLink
      ? selectedFamily
        ? `Invitation created for ${invite.email.trim()} for ${selectedFamily.family_name}. Copy the setup link below.`
        : `Invitation created for ${invite.email.trim()}. Copy the setup link below.`
      : typeof data?.message === "string"
        ? data.message
        : selectedFamily
          ? `Invitation sent to ${invite.email.trim()} for ${selectedFamily.family_name}.`
          : `Invitation sent to ${invite.email.trim()}.`;
    setInviteMessage(success);
    setInviteSetupLink(setupLink);
    notify(setupLink ? `Invitation setup link created for ${invite.email.trim()}.` : `Invitation sent to ${invite.email.trim()}.`);
    setInvite({ email: "", first_name: "", last_name: "", phone: "", role: "parent", family_id: "" });
    await refreshUsers();
  };

  const saveAccessChanges = async () => {
    setAccessError(null);
    setAccessMessage(null);
    if (!selectedUser) return;
    if (currentRole !== "super_admin") return setAccessError("Only System Administration can change roles or account status.");
    if (!supabase) return setAccessError("Supabase is not configured.");
    const { data: sessionData } = await supabase.auth.getSession();
    const { data: refreshedSessionData } = await supabase.auth.refreshSession();
    const accessToken = refreshedSessionData.session?.access_token ?? sessionData.session?.access_token;
    if (!accessToken) return setAccessError("Your session expired. Please sign out and sign in again.");

    setAccessSaving(true);
    const { data, error } = await supabase.functions.invoke("update-user-access", {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: {
        userId: selectedUser.id,
        role: accessDraft.role,
        status: accessDraft.status,
      },
    });
    setAccessSaving(false);

    if (error || data?.error) {
      return setAccessError(typeof data?.error === "string" ? data.error : error?.message || "User access could not be updated.");
    }

    setAccessMessage("User access updated.");
    notify("User access updated.");
    await refreshUsers();
    setSelectedUser((current) => current ? { ...current, role: accessDraft.role, status: accessDraft.status } : current);
  };

  return (
    <div className="space-y-6">
      <PageTitle title="Users & Access" subtitle="Invite users, assign roles, disable accounts, reactivate access, and review recent activity." />
      <Card>
        <form onSubmit={submitInvite} className="grid gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-navy">Invite a portal user</h3>
              <p className="mt-1 text-sm text-slate-600">{canInviteStaff ? "Super Admin may invite parent and staff accounts." : "Registration Office may invite parent accounts only."}</p>
            </div>
            <button disabled={inviting} className="rounded-xl bg-burgundy px-5 py-3 font-bold text-white hover:bg-burgundy-dark disabled:cursor-not-allowed disabled:opacity-60">
              {inviting ? "Sending..." : "Invite User"}
            </button>
          </div>
          {inviteMessage && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{inviteMessage}</p>}
          {inviteError && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{inviteError}</p>}
          {inviteSetupLink && (
            <div className="rounded-xl border border-gold/40 bg-gold/10 p-3 text-sm text-navy">
              <p className="font-bold">One-time password setup link</p>
              <p className="mt-1 text-slate-700">Share this only with the invited user. It expires and can be used once.</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input readOnly value={inviteSetupLink} className="min-w-0 flex-1 rounded-xl border border-gold/40 bg-white px-3 py-2 text-xs text-slate-700" aria-label="Invitation setup link" />
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(inviteSetupLink).then(() => notify("Setup link copied."))}
                  className="rounded-xl bg-navy px-4 py-2 font-bold text-white hover:bg-slate-800"
                >
                  Copy setup link
                </button>
              </div>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label className="text-sm font-semibold text-slate-700">Email<input className="mt-1 w-full rounded-xl border px-4 py-3" type="email" value={invite.email} onChange={(event) => setInvite({ ...invite, email: event.target.value })} /></label>
            <label className="text-sm font-semibold text-slate-700">First name<input className="mt-1 w-full rounded-xl border px-4 py-3" value={invite.first_name} onChange={(event) => setInvite({ ...invite, first_name: event.target.value })} /></label>
            <label className="text-sm font-semibold text-slate-700">Last name<input className="mt-1 w-full rounded-xl border px-4 py-3" value={invite.last_name} onChange={(event) => setInvite({ ...invite, last_name: event.target.value })} /></label>
            <label className="text-sm font-semibold text-slate-700">Phone<input className="mt-1 w-full rounded-xl border px-4 py-3" value={invite.phone} onChange={(event) => setInvite({ ...invite, phone: event.target.value })} /></label>
            <label className="text-sm font-semibold text-slate-700">Role<select className="mt-1 w-full rounded-xl border px-4 py-3" value={invite.role} onChange={(event) => setInvite({ ...invite, role: event.target.value as Role, family_id: event.target.value === "parent" ? invite.family_id : "" })}>
              {allowedInviteRoles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
            </select></label>
            {invite.role === "parent" && (
              <label className="text-sm font-semibold text-slate-700">Family<select className="mt-1 w-full rounded-xl border px-4 py-3" value={invite.family_id} onChange={(event) => setInvite({ ...invite, family_id: event.target.value })}>
                <option value="">Choose family...</option>
                {families.map((family) => <option key={family.id} value={family.id}>{family.family_name} · {family.family_code}</option>)}
              </select></label>
            )}
          </div>
          {invite.role === "parent" && selectedFamily && <p className="text-sm font-semibold text-navy">Parent will be connected to {selectedFamily.family_name}.</p>}
        </form>
      </Card>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-1 flex-wrap gap-3">
            <label className="sr-only" htmlFor="user-search">Search users</label>
            <input id="user-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or email" className="min-w-[220px] flex-1 rounded-xl border px-4 py-3" />
            <label className="sr-only" htmlFor="role-filter">Filter by role</label>
            <select id="role-filter" value={filter} onChange={(event) => setFilter(event.target.value as Role | "all")} className="rounded-xl border px-4 py-3">
              <option value="all">All roles</option>
              <option value="parent">Parent</option>
              <option value="registration_office">Registration Office</option>
              <option value="tuition_office">Tuition Office</option>
              <option value="school_management">School Management</option>
              <option value="super_admin">System Administration</option>
            </select>
          </div>
        </div>
      </Card>
      <Table headers={["User", "Role", "Status", "Created", "Actions"]}>
        {filteredUsers.map((user) => (
          <tr key={user.id}>
            <td><p className="font-bold text-navy">{[user.first_name, user.last_name].filter(Boolean).join(" ") || user.email}</p><p className="text-sm text-slate-500">{user.email}</p></td>
            <td>{roleLabels[user.role]}</td>
            <td><StatusBadge status={accountStatusLabels[user.status] ?? user.status} /></td>
            <td className="text-slate-600">{formatDate(user.created_at?.slice(0, 10))}</td>
            <td><button onClick={() => openAccessEditor(user)} className="rounded-lg border px-3 py-1.5 text-sm font-semibold hover:bg-ivory">Manage</button></td>
          </tr>
        ))}
      </Table>
      {!loading && !filteredUsers.length && <Empty />}
      {selectedUser && (
        <Card className="border-gold/50">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-navy">Manage user access</h3>
              <p className="mt-1 text-sm text-slate-600">{[selectedUser.first_name, selectedUser.last_name].filter(Boolean).join(" ") || selectedUser.email} · {selectedUser.email}</p>
            </div>
            <button className="rounded-xl border px-3 py-2 text-sm font-bold text-slate-600 hover:bg-ivory" onClick={() => setSelectedUser(null)}>Close</button>
          </div>
          {currentRole !== "super_admin" && <p className="mt-4 rounded-xl border border-gold/40 bg-gold/10 p-3 text-sm font-semibold text-navy">Only System Administration can change roles or account status.</p>}
          {accessError && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{accessError}</p>}
          {accessMessage && <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{accessMessage}</p>}
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Role
              <select disabled={currentRole !== "super_admin" || accessSaving} className="mt-1 w-full rounded-xl border px-4 py-3 disabled:bg-slate-50" value={accessDraft.role} onChange={(event) => setAccessDraft({ ...accessDraft, role: event.target.value as Role })}>
                <option value="parent">Parent Portal</option>
                <option value="registration_office">Registration Office</option>
                <option value="tuition_office">Tuition Office</option>
                <option value="school_management">School Management</option>
                <option value="super_admin">System Administration</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Account status
              <select disabled={currentRole !== "super_admin" || accessSaving} className="mt-1 w-full rounded-xl border px-4 py-3 disabled:bg-slate-50" value={accessDraft.status} onChange={(event) => setAccessDraft({ ...accessDraft, status: event.target.value as AccountStatus })}>
                <option value="active">Active</option>
                <option value="invited">Invited</option>
                <option value="pending_verification">Pending verification</option>
                <option value="disabled">Disabled</option>
              </select>
            </label>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button disabled={currentRole !== "super_admin" || accessSaving} className="rounded-xl bg-burgundy px-5 py-3 font-bold text-white hover:bg-burgundy-dark disabled:opacity-50" onClick={() => void saveAccessChanges()}>
              {accessSaving ? "Saving..." : "Save access changes"}
            </button>
            <button className="rounded-xl border border-slate-200 px-5 py-3 font-bold text-navy hover:bg-ivory" onClick={() => setAccessDraft({ role: selectedUser.role, status: selectedUser.status })}>Reset changes</button>
          </div>
        </Card>
      )}
    </div>
  );
}

function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div><h2 className="text-3xl font-bold text-navy">{title}</h2><p className="mt-2 max-w-3xl text-slate-600">{subtitle}</p></div>;
}

function Info({ label, value, light = false }: { label: string; value: string; light?: boolean }) {
  return <div className={light ? "text-white" : ""}><dt className={`text-xs font-bold uppercase tracking-wide ${light ? "text-ivory/70" : "text-slate-500"}`}>{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>;
}

function SearchBar({ query, setQuery }: { query: string; setQuery: (value: string) => void }) {
  return <label className="relative block"><Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" aria-hidden="true" /><input className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 shadow-sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search..." /></label>;
}

function FilterBar({ value, setValue, options }: { value: string; setValue: (value: string) => void; options: string[] }) {
  return <div className="flex flex-wrap gap-2">{options.map((option) => <button key={option} className={`rounded-full px-3 py-2 text-sm font-semibold ${value === option ? "bg-navy text-white" : "bg-white text-slate-600"}`} onClick={() => setValue(option)}>{option}</button>)}</div>;
}

function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return <Card className="overflow-x-auto p-0"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-navy text-white"><tr>{headers.map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead><tbody className="[&_td]:border-t [&_td]:border-slate-100 [&_td]:px-4 [&_td]:py-3">{children}</tbody></table></Card>;
}

function MiniChart({ title, data }: { title: string; data: Record<string, number> }) {
  const max = Math.max(1, ...Object.values(data));
  return <Card><h3 className="font-bold text-navy">{title}</h3><div className="mt-4 space-y-3">{Object.entries(data).map(([label, value]) => <div key={label}><div className="mb-1 flex justify-between text-sm"><span>{label}</span><span className="font-bold">{typeof value === "number" && value > 1000 ? currency(value) : value}</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-gold" style={{ width: `${(value / max) * 100}%` }} /></div></div>)}</div></Card>;
}

function Empty({ title = "No matching records found.", text }: { title?: string; text?: string } = {}) {
  return <Card><div className="flex items-start gap-3 text-slate-600"><AlertCircle className="mt-0.5 text-gold-dark" /><div><p className="font-semibold text-navy">{title}</p>{text && <p className="mt-1 text-sm">{text}</p>}</div></div></Card>;
}

function countBy<T extends Record<string, unknown>>(items: T[], key: keyof T) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const label = String(item[key]);
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
}

export default App;
