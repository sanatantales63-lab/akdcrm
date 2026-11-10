export type ClientType = 'Residential' | 'Commercial';

export type ClientStatus =
  | 'New'
  | 'Contacted'
  | 'Qualified'
  | 'Active Client'
  | 'Completed'
  | 'Lost';

export const CLIENT_STATUSES: ClientStatus[] = [
  'New',
  'Contacted',
  'Qualified',
  'Active Client',
  'Completed',
  'Lost',
];

export type ProjectStatus =
  | 'Planning'
  | 'Design'
  | 'Quotation'
  | 'Approved'
  | 'In Progress'
  | 'On Hold'
  | 'Completed'
  | 'Cancelled';

export const PROJECT_STATUSES: ProjectStatus[] = [
  'Planning',
  'Design',
  'Quotation',
  'Approved',
  'In Progress',
  'On Hold',
  'Completed',
  'Cancelled',
];

export const ACTIVE_PROJECT_STATUSES: ProjectStatus[] = [
  'Planning',
  'Design',
  'Quotation',
  'Approved',
  'In Progress',
];

export type WorkStage =
  | 'Planning'
  | 'Design'
  | 'Material Preparation'
  | 'Work in Progress'
  | 'Finishing'
  | 'Completed';

export const WORK_STAGES: WorkStage[] = [
  'Planning',
  'Design',
  'Material Preparation',
  'Work in Progress',
  'Finishing',
  'Completed',
];

export type QuotationStatus =
  | 'Draft'
  | 'Sent'
  | 'Accepted'
  | 'Rejected'
  | 'Expired'
  | 'Revised';

export const QUOTATION_STATUSES: QuotationStatus[] = [
  'Draft',
  'Sent',
  'Accepted',
  'Rejected',
  'Expired',
  'Revised',
];

export const COMMON_BOQ_UNITS = [
  'Sq. ft.',
  'Running ft.',
  'Piece',
  'Set',
  'Lump sum',
  'Nos.',
  'Meter',
  'Lot',
  'Sheet',
  'Box',
  'Kg',
  'Litre',
  'Bag',
  'Roll',
] as const;

export const COMMON_MATERIAL_UNITS = [
  'Piece',
  'Sheet',
  'Sq. ft.',
  'Running ft.',
  'Box',
  'Set',
  'Nos.',
  'Kg',
  'Litre',
  'Bag',
  'Roll',
  'Meter',
  'Lot',
] as const;

export const MATERIAL_CATEGORIES = [
  'Plywood & Boards',
  'Laminates & Veneers',
  'Hardware & Fittings',
  'Electrical & Lighting',
  'Paint & Polish',
  'Civil & Adhesive',
  'Glass & Mirror',
  'Plumbing & Sanitary',
  'Fabrics & Soft Furnishing',
  'Other',
] as const;

export type AttendanceStatus = 'Present' | 'Half Day' | 'Absent';

export const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  'Present',
  'Half Day',
  'Absent',
];

export type MaterialTransactionType = 'purchase' | 'usage' | 'adjustment';

export type PurchaseBillPaymentStatus = 'Paid' | 'Pending' | 'Partial';

export const PURCHASE_BILL_PAYMENT_STATUSES: PurchaseBillPaymentStatus[] = [
  'Paid',
  'Pending',
  'Partial',
];

export type TeamMemberRole =
  | 'Supervisor'
  | 'Carpenter'
  | 'Electrician'
  | 'Painter'
  | 'Plumber'
  | 'Interior Designer'
  | 'Contractor'
  | 'Other';

export const TEAM_MEMBER_ROLES: TeamMemberRole[] = [
  'Supervisor',
  'Carpenter',
  'Electrician',
  'Painter',
  'Plumber',
  'Interior Designer',
  'Contractor',
  'Other',
];

export type EnquiryStatus =
  | 'New'
  | 'Contacted'
  | 'Follow-up Required'
  | 'Site Visit'
  | 'Quotation Sent'
  | 'Converted'
  | 'Lost';

export const ENQUIRY_STATUSES: EnquiryStatus[] = [
  'New',
  'Contacted',
  'Follow-up Required',
  'Site Visit',
  'Quotation Sent',
  'Converted',
  'Lost',
];

export type PaymentMethod =
  | 'Cash'
  | 'Bank Transfer'
  | 'UPI'
  | 'Cheque'
  | 'Other';

export const PAYMENT_METHODS: PaymentMethod[] = [
  'Cash',
  'Bank Transfer',
  'UPI',
  'Cheque',
  'Other',
];

export type PaymentType =
  | 'Advance'
  | 'Instalment'
  | 'Milestone Payment'
  | 'Final Payment'
  | 'Other';

export const PAYMENT_TYPES: PaymentType[] = [
  'Advance',
  'Instalment',
  'Milestone Payment',
  'Final Payment',
  'Other',
];

export const DEFAULT_PROJECT_CATEGORIES: string[] = [
  'Residential Interior',
  'Commercial Interior',
  'Office Interior',
  'Modular Kitchen',
  'Renovation',
  'Turnkey Project',
  'Other',
];

export const DEFAULT_EXPENSE_CATEGORIES: string[] = [
  'Materials',
  'Labour',
  'Contractor',
  'Transportation',
  'Site Expenses',
  'Design and Software',
  'Office Expenses',
  'Marketing',
  'Other',
];

export const DEFAULT_LEAD_SOURCES: string[] = [
  'Website (akdinterior.in)',
  'Client Referral',
  'Google Search / Maps',
  'Instagram / Social',
  'Walk-in Studio',
  'Architect Partner',
  'Direct Call / WhatsApp',
  'Other',
];

export interface NoteLogEntry {
  id: string;
  content: string;
  created_at: string;
  author: string;
}

export interface Client {
  id: string;
  client_code: string;
  full_name: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  client_type: ClientType;
  property_type?: string;
  property_location?: string;
  full_address?: string;
  project_budget?: number | null;
  lead_source?: string;
  status: ClientStatus;
  date_added: string; // YYYY-MM-DD
  notes?: string;
  client_notes_log: NoteLogEntry[];
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Enquiry {
  id: string;
  enquiry_code: string;
  name: string;
  phone: string;
  email?: string;
  project_type: string;
  property_location?: string;
  estimated_budget?: number | null;
  lead_source?: string;
  enquiry_date: string; // YYYY-MM-DD
  follow_up_date?: string; // YYYY-MM-DD
  status: EnquiryStatus;
  notes?: string;
  follow_up_history: NoteLogEntry[];
  converted_client_id?: string | null;
  converted_project_id?: string | null;
  converted_at?: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  project_code: string;
  project_name: string;
  client_id: string;
  category: string;
  property_location: string;
  site_address?: string;
  description?: string;
  total_value: number;
  estimated_start_date?: string; // YYYY-MM-DD
  expected_completion_date?: string; // YYYY-MM-DD
  actual_completion_date?: string; // YYYY-MM-DD
  status: ProjectStatus;
  progress_percentage: number;
  payment_terms?: string;
  internal_notes?: string;
  source_enquiry_id?: string | null;
  current_work_stage?: WorkStage | string;
  sharing_token?: string | null;
  is_sharing_enabled?: boolean;
  sharing_token_created_at?: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuotationPDFSections {
  showBusinessDetails: boolean;
  showClientDetails: boolean;
  showProjectDetails: boolean;
  showBoqTable: boolean;
  showRateQtyAmount: boolean;
  showDiscount: boolean;
  showTax: boolean;
  showScopeOfWork: boolean;
  showPaymentTerms: boolean;
  showTermsAndConditions: boolean;
  showNotes: boolean;
  showBankDetails: boolean;
  showSignature: boolean;
}

export const DEFAULT_QUOTATION_PDF_SECTIONS: QuotationPDFSections = {
  showBusinessDetails: true,
  showClientDetails: true,
  showProjectDetails: true,
  showBoqTable: true,
  showRateQtyAmount: true,
  showDiscount: true,
  showTax: true,
  showScopeOfWork: true,
  showPaymentTerms: true,
  showTermsAndConditions: true,
  showNotes: true,
  showBankDetails: true,
  showSignature: true,
};

export interface QuotationItem {
  id: string;
  quotation_id: string;
  material_id?: string | null;
  item_name: string;
  description?: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  sort_order: number;
}

export interface Quotation {
  id: string;
  quotation_number: string;
  revision_number: number;
  parent_quotation_id?: string | null;
  project_id?: string | null;
  client_id: string;
  quotation_date: string; // YYYY-MM-DD
  valid_until: string; // YYYY-MM-DD
  status: QuotationStatus;
  scope_of_work?: string;
  payment_terms?: string;
  terms_and_conditions?: string;
  notes?: string;
  subtotal: number;
  discount_percentage: number;
  discount_amount: number;
  tax_rate: number; // e.g. 0, 5, 12, 18
  tax_amount: number;
  total_amount: number;
  pdf_sections?: QuotationPDFSections;
  items: QuotationItem[];
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  full_name: string;
  phone: string;
  role: TeamMemberRole;
  skill?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectTeamAssignment {
  id: string;
  project_id: string;
  team_member_id: string;
  role_on_project?: string;
  assigned_date: string; // YYYY-MM-DD
  notes?: string;
  member?: TeamMember;
  created_at: string;
}

export interface TeamAttendance {
  id: string;
  team_member_id: string;
  project_id: string;
  attendance_date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  in_time?: string | null; // HH:mm
  out_time?: string | null; // HH:mm
  working_hours: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Material {
  id: string;
  material_code: string;
  item_name: string;
  category: string;
  unit: string;
  available_quantity: number;
  purchase_rate: number;
  supplier?: string;
  low_stock_level: number;
  notes?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface MaterialTransaction {
  id: string;
  material_id: string;
  project_id?: string | null;
  purchase_bill_id?: string | null;
  transaction_type: MaterialTransactionType;
  quantity: number;
  unit_rate: number;
  total_amount: number;
  supplier?: string;
  transaction_date: string; // YYYY-MM-DD
  reference_number?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PurchaseBillItem {
  id: string;
  purchase_bill_id: string;
  material_id?: string | null;
  item_name: string;
  description?: string;
  unit: string;
  quantity: number;
  rate: number;
  amount: number;
  update_stock: boolean;
  sort_order: number;
}

export interface PurchaseBill {
  id: string;
  bill_number: string;
  invoice_reference?: string;
  supplier_name: string;
  supplier_phone?: string;
  project_id?: string | null;
  bill_date: string; // YYYY-MM-DD
  payment_status: PurchaseBillPaymentStatus;
  payment_method: PaymentMethod;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  notes?: string;
  linked_expense_id?: string | null;
  items: PurchaseBillItem[];
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectPhoto {
  id: string;
  project_id: string;
  work_update_id?: string | null;
  photo_url: string;
  storage_path?: string;
  caption?: string;
  file_size?: number;
  file_type?: string;
  is_visible_to_client: boolean;
  upload_date: string;
  created_at: string;
}

export interface ProjectWorkUpdate {
  id: string;
  project_id: string;
  update_date: string; // YYYY-MM-DD
  work_stage: WorkStage;
  work_completed: string;
  progress_percentage: number;
  work_remaining?: string;
  client_note?: string;
  internal_note?: string;
  is_visible_to_client: boolean;
  photos?: ProjectPhoto[];
  created_at: string;
  updated_at: string;
}

export interface PublicStudioBranding {
  business_name: string;
  logo_url: string;
  phone: string;
  email: string;
  address: string;
  website: string;
  date_format?: 'dd MMM yyyy' | 'dd/MM/yyyy' | 'yyyy-MM-dd';
}

export interface PublicClientTrackingData {
  project_name: string;
  property_location: string;
  site_address?: string;
  category?: string;
  status: ProjectStatus;
  current_work_stage: string;
  progress_percentage: number;
  estimated_start_date?: string;
  expected_completion_date?: string;
  client_name: string;
  studio?: PublicStudioBranding;
  updates: Array<{
    id: string;
    update_date: string;
    work_stage: string;
    work_completed: string;
    progress_percentage: number;
    work_remaining?: string;
    client_note?: string;
    photos: Array<{
      id: string;
      photo_url: string;
      caption?: string;
      upload_date: string;
    }>;
  }>;
  standalone_photos: Array<{
    id: string;
    photo_url: string;
    caption?: string;
    upload_date: string;
  }>;
}

export interface Payment {
  id: string;
  payment_code: string;
  receipt_number: string;
  client_id: string;
  project_id: string;
  amount: number;
  payment_date: string; // YYYY-MM-DD
  payment_method: PaymentMethod;
  payment_type: PaymentType;
  transaction_reference?: string;
  notes?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  expense_code: string;
  title: string;
  category: string;
  project_id?: string | null;
  amount: number;
  expense_date: string; // YYYY-MM-DD
  vendor_name?: string;
  payment_method: PaymentMethod;
  reference_number?: string;
  notes?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusinessSettings {
  id: string;
  business_name: string;
  authorized_signatory: string;
  logo_url: string;
  phone: string;
  email: string;
  address: string;
  website: string;
  gstin?: string;
  bank_account_name?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_ifsc_code?: string;
  bank_branch?: string;
  bank_upi_id?: string;
  signature_url?: string;
  default_payment_terms?: string;
  default_terms_and_conditions?: string;
  default_quotation_validity_days?: number;
  quotation_pdf_defaults?: QuotationPDFSections;
  currency: string;
  date_format: 'dd MMM yyyy' | 'dd/MM/yyyy' | 'yyyy-MM-dd';
  financial_year_start_month: number; // 4 = April
  project_categories: string[];
  expense_categories: string[];
  lead_sources: string[];
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  entity_type:
    | 'client'
    | 'project'
    | 'enquiry'
    | 'payment'
    | 'expense'
    | 'settings'
    | 'auth'
    | 'quotation'
    | 'team'
    | 'work_update'
    | 'attendance'
    | 'material'
    | 'purchase_bill';
  entity_id?: string;
  action: string;
  description: string;
  created_at: string;
}

export interface OwnerProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'owner';
  created_at: string;
}

export interface ProjectFinancialSummary {
  project: Project;
  client?: Client;
  totalValue: number;
  paymentsReceived: number;
  outstandingBalance: number;
  recordedExpenses: number;
  paymentCount: number;
  expenseCount: number;
  collectionPercentage: number;
}

export interface ClientFinancialSummary {
  client: Client;
  projectCount: number;
  activeProjectCount: number;
  totalProjectValue: number;
  totalPaymentsReceived: number;
  outstandingBalance: number;
}

export type DatePreset = '30d' | '90d' | 'fy' | 'all' | 'custom';

export interface DateFilterRange {
  preset: DatePreset;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
}
