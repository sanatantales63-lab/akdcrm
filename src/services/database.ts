import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { uploadToCloudinary, isCloudinaryConfigured } from '@/lib/cloudinary';
import {
  Client,
  Enquiry,
  Project,
  Payment,
  Expense,
  BusinessSettings,
  ActivityLog,
  OwnerProfile,
  DEFAULT_PROJECT_CATEGORIES,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_LEAD_SOURCES,
  DEFAULT_QUOTATION_PDF_SECTIONS,
  QuotationPDFSections,
  NoteLogEntry,
  Quotation,
  QuotationItem,
  TeamMember,
  ProjectTeamAssignment,
  ProjectWorkUpdate,
  ProjectPhoto,
  PublicClientTrackingData,
  WorkStage,
  QuotationStatus,
  TeamMemberRole,
} from '@/types/crm';
import { fromPaise, toPaise, safeAdd, safeSubtract, todayISO } from '@/lib/formatters';

const STORAGE_DB_KEY = 'akd_interior_crm_vault_v1';
const STORAGE_AUTH_KEY = 'akd_interior_crm_owner_auth_v1';
const STORAGE_SESSION_KEY = 'akd_interior_crm_session_v1';

interface LocalDatabaseState {
  settings: BusinessSettings;
  clients: Client[];
  enquiries: Enquiry[];
  projects: Project[];
  payments: Payment[];
  expenses: Expense[];
  activity_logs: ActivityLog[];
  quotations: Quotation[];
  team_members: TeamMember[];
  project_team_assignments: ProjectTeamAssignment[];
  project_work_updates: ProjectWorkUpdate[];
  project_photos: ProjectPhoto[];
  counters: {
    client: number;
    enquiry: number;
    project: number;
    payment: number;
    expense: number;
    quotation: number;
  };
}

interface StoredOwnerRecord {
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
  recovery_key_hash: string;
  salt: string;
  created_at: string;
  updated_at: string;
}

export interface SessionState {
  user: OwnerProfile;
  token: string;
  expires_at: number;
  mode: 'supabase' | 'local_vault';
}

const DEFAULT_SETTINGS: BusinessSettings = {
  id: '00000000-0000-4000-8000-000000000001',
  business_name: 'ALL KIND DECOR INTERIOR',
  authorized_signatory: 'Sk Subrati Amin',
  logo_url: '/logo.png',
  phone: '+91 7602772338, 9332961522',
  email: 'allkindsdecorinterior@gmail.com',
  address: 'Inda North Vidyasagarpur, Kharagpur, Paschim Medinipur, West Bengal - 721305',
  website: 'https://www.akdinterior.in/',
  gstin: '',
  bank_account_name: 'Sk Subrati Amin',
  bank_name: 'Canara Bank',
  bank_account_number: '110135860623',
  bank_ifsc_code: 'CNRB0004983',
  bank_branch: 'I floor pirbaba tower Inda OT Road',
  bank_upi_id: '',
  signature_url: '',
  default_payment_terms:
    '1. 50% advance with order confirmation.\n2. 30% upon mid-execution / carpentry fabrication milestone.\n3. 20% upon completion and site handover.',
  default_terms_and_conditions:
    '1. Material specifications and finishes are strictly as per the approved BOQ.\n2. Any additional civil, electrical, or custom carpentry changes requested during execution will be billed separately.\n3. This quotation is valid until the specified validity date.',
  default_quotation_validity_days: 30,
  quotation_pdf_defaults: { ...DEFAULT_QUOTATION_PDF_SECTIONS },
  currency: 'INR',
  date_format: 'dd MMM yyyy',
  financial_year_start_month: 4,
  project_categories: [...DEFAULT_PROJECT_CATEGORIES],
  expense_categories: [...DEFAULT_EXPENSE_CATEGORIES],
  lead_sources: [...DEFAULT_LEAD_SOURCES],
  updated_at: new Date().toISOString(),
};

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function generateSecureSharingToken(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `akd_${hex}`;
  }
  return `akd_${generateUUID().replace(/-/g, '')}${generateUUID().replace(/-/g, '').slice(0, 16)}`;
}

function reconcileProjectsWithLatestUpdates(
  projects: Project[],
  workUpdates: ProjectWorkUpdate[]
): Project[] {
  if (!Array.isArray(projects) || !Array.isArray(workUpdates) || workUpdates.length === 0) {
    return projects;
  }
  return projects.map((project) => {
    const updatesForProject = workUpdates
      .filter((u) => u.project_id === project.id)
      .sort((a, b) => {
        const dateCmp = (b.update_date || '').localeCompare(a.update_date || '');
        if (dateCmp !== 0) return dateCmp;
        return (b.created_at || '').localeCompare(a.created_at || '');
      });
    if (updatesForProject.length === 0) return project;
    const latest = updatesForProject[0];
    const latestProgress = Math.min(
      100,
      Math.max(0, Math.round(Number(latest.progress_percentage) || 0))
    );
    const latestStage = latest.work_stage || project.current_work_stage || project.status;

    const latestUpdateTimestamp = latest.updated_at || latest.created_at || '';
    const projectTimestamp = project.updated_at || project.created_at || '';
    const wasAffectedByStaleWrite =
      latestUpdateTimestamp >= projectTimestamp ||
      (project.status !== 'Completed' && project.progress_percentage === 100 && latestProgress < 100);

    if (
      wasAffectedByStaleWrite &&
      (project.progress_percentage !== latestProgress ||
        project.current_work_stage !== latestStage)
    ) {
      return {
        ...project,
        progress_percentage: latestProgress,
        current_work_stage: latestStage,
      };
    }
    return project;
  });
}

async function sha256Hash(input: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${input}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getInitialLocalDB(): LocalDatabaseState {
  return {
    settings: { ...DEFAULT_SETTINGS },
    clients: [],
    enquiries: [],
    projects: [],
    payments: [],
    expenses: [],
    activity_logs: [],
    quotations: [],
    team_members: [],
    project_team_assignments: [],
    project_work_updates: [],
    project_photos: [],
    counters: {
      client: 0,
      enquiry: 0,
      project: 0,
      payment: 0,
      expense: 0,
      quotation: 0,
    },
  };
}

function readLocalDB(): LocalDatabaseState {
  try {
    const raw = localStorage.getItem(STORAGE_DB_KEY);
    if (!raw) {
      const initial = getInitialLocalDB();
      localStorage.setItem(STORAGE_DB_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw) as Partial<LocalDatabaseState>;
    const rawWorkUpdates = Array.isArray(parsed.project_work_updates)
      ? parsed.project_work_updates
      : [];
    const rawProjects = Array.isArray(parsed.projects) ? parsed.projects : [];
    const reconciledProjects = reconcileProjectsWithLatestUpdates(rawProjects, rawWorkUpdates);
    const rawQuotations = Array.isArray(parsed.quotations)
      ? parsed.quotations.map((q) => ({
          ...q,
          items: Array.isArray(q.items)
            ? [...q.items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            : [],
        }))
      : [];

    const savedSettings = parsed.settings || ({} as Partial<BusinessSettings>);
    const hasSavedBankDetails = Boolean(
      savedSettings.bank_account_name ||
        savedSettings.bank_name ||
        savedSettings.bank_account_number ||
        savedSettings.bank_ifsc_code ||
        savedSettings.bank_branch ||
        savedSettings.bank_upi_id
    );

    return {
      settings: {
        ...DEFAULT_SETTINGS,
        ...savedSettings,
        bank_account_name: hasSavedBankDetails
          ? savedSettings.bank_account_name ?? ''
          : DEFAULT_SETTINGS.bank_account_name,
        bank_name: hasSavedBankDetails
          ? savedSettings.bank_name ?? ''
          : DEFAULT_SETTINGS.bank_name,
        bank_account_number: hasSavedBankDetails
          ? savedSettings.bank_account_number ?? ''
          : DEFAULT_SETTINGS.bank_account_number,
        bank_ifsc_code: hasSavedBankDetails
          ? savedSettings.bank_ifsc_code ?? ''
          : DEFAULT_SETTINGS.bank_ifsc_code,
        bank_branch: hasSavedBankDetails
          ? savedSettings.bank_branch ?? ''
          : DEFAULT_SETTINGS.bank_branch,
        quotation_pdf_defaults: {
          ...DEFAULT_QUOTATION_PDF_SECTIONS,
          ...(savedSettings.quotation_pdf_defaults || {}),
        },
      },
      clients: Array.isArray(parsed.clients) ? parsed.clients : [],
      enquiries: Array.isArray(parsed.enquiries) ? parsed.enquiries : [],
      projects: reconciledProjects,
      payments: Array.isArray(parsed.payments) ? parsed.payments : [],
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      activity_logs: Array.isArray(parsed.activity_logs) ? parsed.activity_logs : [],
      quotations: rawQuotations,
      team_members: Array.isArray(parsed.team_members) ? parsed.team_members : [],
      project_team_assignments: Array.isArray(parsed.project_team_assignments)
        ? parsed.project_team_assignments
        : [],
      project_work_updates: rawWorkUpdates,
      project_photos: Array.isArray(parsed.project_photos) ? parsed.project_photos : [],
      counters: {
        client: parsed.counters?.client ?? (parsed.clients?.length || 0),
        enquiry: parsed.counters?.enquiry ?? (parsed.enquiries?.length || 0),
        project: parsed.counters?.project ?? (parsed.projects?.length || 0),
        payment: parsed.counters?.payment ?? (parsed.payments?.length || 0),
        expense: parsed.counters?.expense ?? (parsed.expenses?.length || 0),
        quotation: parsed.counters?.quotation ?? (parsed.quotations?.length || 0),
      },
    };
  } catch {
    return getInitialLocalDB();
  }
}

function writeLocalDB(state: LocalDatabaseState): void {
  localStorage.setItem(STORAGE_DB_KEY, JSON.stringify(state));
}

function appendActivityLog(
  db: LocalDatabaseState,
  entity_type: ActivityLog['entity_type'],
  action: string,
  description: string,
  entity_id?: string
) {
  const entry: ActivityLog = {
    id: generateUUID(),
    entity_type,
    entity_id,
    action,
    description,
    created_at: new Date().toISOString(),
  };
  db.activity_logs = [entry, ...db.activity_logs.slice(0, 249)];
}

// ============================================================================
// OWNER AUTHENTICATION & PROVISIONING SERVICE
// ============================================================================

export const authService = {
  isOwnerProvisioned(): boolean {
    if (isSupabaseConfigured) {
      // In Supabase mode, owner provisioning is managed via Supabase Auth
      return true;
    }
    try {
      const raw = localStorage.getItem(STORAGE_AUTH_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as StoredOwnerRecord;
      return Boolean(parsed && parsed.email && parsed.password_hash);
    } catch {
      return false;
    }
  },

  getProvisionedOwnerEmail(): string | null {
    try {
      const raw = localStorage.getItem(STORAGE_AUTH_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredOwnerRecord;
      return parsed.email || null;
    } catch {
      return null;
    }
  },

  async provisionInitialOwner(input: {
    fullName: string;
    email: string;
    password: string;
    recoveryKey: string;
  }): Promise<SessionState> {
    if (this.isOwnerProvisioned() && !isSupabaseConfigured) {
      throw new Error('Owner account is already provisioned. Public registration is disabled.');
    }

    const cleanEmail = input.email.trim().toLowerCase();
    const cleanName = input.fullName.trim() || 'Studio Owner';
    const cleanRecovery = input.recoveryKey.trim().toUpperCase();

    if (input.password.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }
    if (cleanRecovery.length < 6) {
      throw new Error('Recovery security key must be at least 6 characters.');
    }

    const salt = generateUUID();
    const password_hash = await sha256Hash(input.password, salt);
    const recovery_key_hash = await sha256Hash(cleanRecovery, salt);
    const now = new Date().toISOString();

    const ownerRecord: StoredOwnerRecord = {
      id: generateUUID(),
      email: cleanEmail,
      full_name: cleanName,
      password_hash,
      recovery_key_hash,
      salt,
      created_at: now,
      updated_at: now,
    };

    localStorage.setItem(STORAGE_AUTH_KEY, JSON.stringify(ownerRecord));

    // Also update business settings email if default
    const db = readLocalDB();
    appendActivityLog(
      db,
      'auth',
      'Owner Provisioned',
      `Initial owner account provisioned for ${cleanEmail}`
    );
    writeLocalDB(db);

    const session: SessionState = {
      user: {
        id: ownerRecord.id,
        email: ownerRecord.email,
        full_name: ownerRecord.full_name,
        role: 'owner',
        created_at: ownerRecord.created_at,
      },
      token: generateUUID(),
      expires_at: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
      mode: 'local_vault',
    };

    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
    return session;
  },

  async signIn(email: string, password: string): Promise<SessionState> {
    const cleanEmail = email.trim().toLowerCase();

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error || !data.user || !data.session) {
        throw new Error(error?.message || 'Invalid owner email or password.');
      }

      const configuredOwnerEmail = (import.meta.env.VITE_OWNER_EMAIL as string | undefined)
        ?.trim()
        .toLowerCase();
      if (
        configuredOwnerEmail &&
        configuredOwnerEmail !== 'owner@akdstudio.com' &&
        data.user.email?.toLowerCase() !== configuredOwnerEmail
      ) {
        await supabase.auth.signOut();
        throw new Error('Unauthorized: This account is not authorized as the studio owner.');
      }

      const session: SessionState = {
        user: {
          id: data.user.id,
          email: data.user.email || cleanEmail,
          full_name:
            (data.user.user_metadata?.full_name as string) || 'AKD Studio Principal',
          role: 'owner',
          created_at: data.user.created_at,
        },
        token: data.session.access_token,
        expires_at: (data.session.expires_at || Math.floor(Date.now() / 1000) + 86400) * 1000,
        mode: 'supabase',
      };
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
      return session;
    }

    // Local Vault verification
    const raw = localStorage.getItem(STORAGE_AUTH_KEY);
    if (!raw) {
      throw new Error('Owner account has not been provisioned yet. Complete initial setup first.');
    }

    const record = JSON.parse(raw) as StoredOwnerRecord;
    const candidateHash = await sha256Hash(password, record.salt);

    if (record.email.toLowerCase() !== cleanEmail || candidateHash !== record.password_hash) {
      throw new Error('Invalid email address or password. Access is restricted to the studio owner.');
    }

    const session: SessionState = {
      user: {
        id: record.id,
        email: record.email,
        full_name: record.full_name,
        role: 'owner',
        created_at: record.created_at,
      },
      token: generateUUID(),
      expires_at: Date.now() + 1000 * 60 * 60 * 24 * 7,
      mode: 'local_vault',
    };

    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));

    const db = readLocalDB();
    appendActivityLog(db, 'auth', 'Owner Sign In', `Authenticated owner session started`);
    writeLocalDB(db);

    return session;
  },

  async getSession(): Promise<SessionState | null> {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        return {
          user: {
            id: data.session.user.id,
            email: data.session.user.email || '',
            full_name:
              (data.session.user.user_metadata?.full_name as string) || 'AKD Studio Principal',
            role: 'owner',
            created_at: data.session.user.created_at,
          },
          token: data.session.access_token,
          expires_at:
            (data.session.expires_at || Math.floor(Date.now() / 1000) + 86400) * 1000,
          mode: 'supabase',
        };
      }
    }

    try {
      const raw = localStorage.getItem(STORAGE_SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw) as SessionState;
      if (!session || Date.now() > session.expires_at) {
        localStorage.removeItem(STORAGE_SESSION_KEY);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  },

  async signOut(): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem(STORAGE_SESSION_KEY);
  },

  async requestPasswordReset(input: {
    email: string;
    recoveryKey?: string;
    newPassword?: string;
  }): Promise<{ message: string }> {
    const cleanEmail = input.email.trim().toLowerCase();

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/login?reset=true`,
      });
      if (error) {
        throw new Error(error.message);
      }
      return {
        message: 'Password reset link has been sent to the registered owner email address.',
      };
    }

    const raw = localStorage.getItem(STORAGE_AUTH_KEY);
    if (!raw) {
      throw new Error('No owner account is provisioned on this device.');
    }

    const record = JSON.parse(raw) as StoredOwnerRecord;
    if (record.email.toLowerCase() !== cleanEmail) {
      throw new Error('The email address entered does not match the registered studio owner.');
    }

    if (!input.recoveryKey || !input.newPassword) {
      throw new Error('Please provide your Owner Recovery Key and a new password.');
    }

    if (input.newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long.');
    }

    const recoveryCandidate = await sha256Hash(
      input.recoveryKey.trim().toUpperCase(),
      record.salt
    );
    if (recoveryCandidate !== record.recovery_key_hash) {
      throw new Error('Invalid Owner Recovery Key. Password reset denied.');
    }

    const newSalt = generateUUID();
    record.password_hash = await sha256Hash(input.newPassword, newSalt);
    record.recovery_key_hash = await sha256Hash(
      input.recoveryKey.trim().toUpperCase(),
      newSalt
    );
    record.salt = newSalt;
    record.updated_at = new Date().toISOString();

    localStorage.setItem(STORAGE_AUTH_KEY, JSON.stringify(record));
    localStorage.removeItem(STORAGE_SESSION_KEY);

    const db = readLocalDB();
    appendActivityLog(db, 'auth', 'Password Reset', 'Owner password was reset via recovery key');
    writeLocalDB(db);

    return {
      message: 'Owner password has been securely updated. You may now sign in.',
    };
  },

  async changePassword(input: {
    currentPassword: string;
    newPassword: string;
    fullName?: string;
  }): Promise<void> {
    if (input.newPassword && input.newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long.');
    }

    if (isSupabaseConfigured && supabase) {
      const updates: { password?: string; data?: { full_name?: string } } = {};
      if (input.newPassword) updates.password = input.newPassword;
      if (input.fullName) updates.data = { full_name: input.fullName.trim() };

      const { error } = await supabase.auth.updateUser(updates);
      if (error) throw new Error(error.message);
      return;
    }

    const raw = localStorage.getItem(STORAGE_AUTH_KEY);
    if (!raw) throw new Error('Owner record not found.');
    const record = JSON.parse(raw) as StoredOwnerRecord;

    const currentHash = await sha256Hash(input.currentPassword, record.salt);
    if (currentHash !== record.password_hash) {
      throw new Error('Current password is incorrect.');
    }

    if (input.newPassword) {
      record.password_hash = await sha256Hash(input.newPassword, record.salt);
    }
    if (input.fullName?.trim()) {
      record.full_name = input.fullName.trim();
    }
    record.updated_at = new Date().toISOString();
    localStorage.setItem(STORAGE_AUTH_KEY, JSON.stringify(record));

    // Update current session if active
    const sessionRaw = localStorage.getItem(STORAGE_SESSION_KEY);
    if (sessionRaw) {
      const session = JSON.parse(sessionRaw) as SessionState;
      session.user.full_name = record.full_name;
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
    }
  },
};

// ============================================================================
// CRM REPOSITORY — CLIENTS, ENQUIRIES, PROJECTS, PAYMENTS, EXPENSES, SETTINGS
// ============================================================================

export async function compressImageFile(
  file: File,
  maxWidth = 1280,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        try {
          const webpData = canvas.toDataURL('image/webp', quality);
          if (webpData.startsWith('data:image/webp')) {
            resolve(webpData);
            return;
          }
        } catch {}
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Failed to load image for processing'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function computeQuotationTotals(
  items: Array<{ quantity: number; rate: number }>,
  discountPercentage: number,
  taxRate: number
) {
  const subtotalPaise = items.reduce((acc, it) => {
    const qty = Math.max(0, Number(it.quantity) || 0);
    const rate = Math.max(0, fromPaise(toPaise(Number(it.rate) || 0)));
    return acc + toPaise(qty * rate);
  }, 0);
  const cleanSubtotal = fromPaise(subtotalPaise);
  const cleanDiscountPct = Math.min(100, Math.max(0, Number(discountPercentage) || 0));
  const discountPaise = Math.max(0, Math.round(subtotalPaise * (cleanDiscountPct / 100)));
  const discountAmount = fromPaise(discountPaise);
  const taxableAmount = Math.max(0, safeSubtract(cleanSubtotal, discountAmount));
  const cleanTaxRate = Math.max(0, Number(taxRate) || 0);
  const taxAmount = fromPaise(Math.max(0, Math.round(toPaise(taxableAmount) * (cleanTaxRate / 100))));
  const totalAmount = safeAdd(taxableAmount, taxAmount);

  return {
    subtotal: cleanSubtotal,
    discount_amount: discountAmount,
    tax_amount: taxAmount,
    total_amount: totalAmount,
  };
}

export interface CRMDataSnapshot {
  settings: BusinessSettings;
  clients: Client[];
  enquiries: Enquiry[];
  projects: Project[];
  payments: Payment[];
  expenses: Expense[];
  activityLogs: ActivityLog[];
  quotations: Quotation[];
  teamMembers: TeamMember[];
  teamAssignments: ProjectTeamAssignment[];
  workUpdates: ProjectWorkUpdate[];
  projectPhotos: ProjectPhoto[];
}

export const crmRepository = {
  async fetchAll(): Promise<CRMDataSnapshot> {
    if (isSupabaseConfigured && supabase) {
      try {
        const [
          settingsRes,
          clientsRes,
          enquiriesRes,
          projectsRes,
          paymentsRes,
          expensesRes,
          logsRes,
          quotesRes,
          teamRes,
          assignRes,
          updatesRes,
          photosRes,
        ] = await Promise.all([
          supabase.from('business_settings').select('*').limit(1).maybeSingle(),
          supabase
            .from('clients')
            .select('*')
            .eq('is_archived', false)
            .order('created_at', { ascending: false }),
          supabase
            .from('enquiries')
            .select('*')
            .eq('is_archived', false)
            .order('created_at', { ascending: false }),
          supabase
            .from('projects')
            .select('*')
            .eq('is_archived', false)
            .order('created_at', { ascending: false }),
          supabase
            .from('payments')
            .select('*')
            .eq('is_archived', false)
            .order('payment_date', { ascending: false }),
          supabase
            .from('expenses')
            .select('*')
            .eq('is_archived', false)
            .order('expense_date', { ascending: false }),
          supabase
            .from('activity_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100),
          supabase
            .from('quotations')
            .select('*, items:quotation_items(*)')
            .eq('is_archived', false)
            .order('created_at', { ascending: false }),
          supabase
            .from('team_members')
            .select('*')
            .order('created_at', { ascending: false }),
          supabase
            .from('project_team_assignments')
            .select('*, member:team_members(*)'),
          supabase
            .from('project_work_updates')
            .select('*, photos:project_photos(*)')
            .order('update_date', { ascending: false }),
          supabase
            .from('project_photos')
            .select('*')
            .order('upload_date', { ascending: false }),
        ]);

        // If Supabase tables exist and responded cleanly, return live cloud data
        if (!clientsRes.error && !projectsRes.error) {
          const teamMembersList: TeamMember[] = (teamRes.data || []) as TeamMember[];
          const workUpdatesList = (updatesRes.data || []) as ProjectWorkUpdate[];
          const rawProjects = (projectsRes.data || []).map((p: any) => ({
            ...p,
            total_value: Number(p.total_value || 0),
            progress_percentage: Number(p.progress_percentage || 0),
          })) as Project[];

          return {
            settings: settingsRes.data
              ? {
                  ...DEFAULT_SETTINGS,
                  ...settingsRes.data,
                  project_categories:
                    settingsRes.data.project_categories || DEFAULT_PROJECT_CATEGORIES,
                  expense_categories:
                    settingsRes.data.expense_categories || DEFAULT_EXPENSE_CATEGORIES,
                  lead_sources: settingsRes.data.lead_sources || DEFAULT_LEAD_SOURCES,
                  quotation_pdf_defaults: {
                    ...DEFAULT_QUOTATION_PDF_SECTIONS,
                    ...(settingsRes.data.quotation_pdf_defaults || {}),
                  },
                }
              : DEFAULT_SETTINGS,
            clients: (clientsRes.data || []).map((c: any) => ({
              ...c,
              project_budget: c.project_budget !== null ? Number(c.project_budget) : null,
              client_notes_log: Array.isArray(c.client_notes_log || c.client_noteslog)
                ? c.client_notes_log || c.client_noteslog
                : [],
            })),
            enquiries: (enquiriesRes.data || []).map((e: any) => ({
              ...e,
              estimated_budget: e.estimated_budget !== null ? Number(e.estimated_budget) : null,
              follow_up_history: Array.isArray(e.follow_up_history) ? e.follow_up_history : [],
            })),
            projects: reconcileProjectsWithLatestUpdates(rawProjects, workUpdatesList),
            payments: (paymentsRes.data || []).map((pay: any) => ({
              ...pay,
              amount: Number(pay.amount || 0),
            })),
            expenses: (expensesRes.data || []).map((exp: any) => ({
              ...exp,
              amount: Number(exp.amount || 0),
            })),
            activityLogs: (logsRes.data || []) as ActivityLog[],
            quotations: (quotesRes.data || []).map((q: any) => ({
              ...q,
              subtotal: Number(q.subtotal || 0),
              discount_amount: Number(q.discount_amount || 0),
              discount_percentage: Number(q.discount_percentage || 0),
              tax_rate: Number(q.tax_rate || 0),
              tax_amount: Number(q.tax_amount || 0),
              total_amount: Number(q.total_amount || 0),
              items: (q.items || [])
                .map((it: any) => ({
                  ...it,
                  quantity: Number(it.quantity || 1),
                  rate: Number(it.rate || 0),
                  amount: Number(it.amount || 0),
                  sort_order: Number(it.sort_order ?? 0),
                }))
                .sort((a: any, b: any) => a.sort_order - b.sort_order),
            })),
            teamMembers: teamMembersList,
            teamAssignments: (assignRes.data || []).map((a: any) => ({
              ...a,
              member: a.member || teamMembersList.find((m) => m.id === a.team_member_id),
            })),
            workUpdates: workUpdatesList,
            projectPhotos: (photosRes.data || []) as ProjectPhoto[],
          };
        }
      } catch {
        // Fallback to local vault if Supabase schema isn't migrated yet
      }
    }

    const db = readLocalDB();
    const teamMembersList = db.team_members || [];
    const photosList = db.project_photos || [];
    const assignmentsWithMembers = (db.project_team_assignments || []).map((a) => ({
      ...a,
      member: a.member || teamMembersList.find((m) => m.id === a.team_member_id),
    }));
    const updatesWithPhotos = (db.project_work_updates || []).map((u) => ({
      ...u,
      photos: photosList.filter((p) => p.work_update_id === u.id),
    }));

    return {
      settings: db.settings,
      clients: db.clients.filter((c) => !c.is_archived),
      enquiries: db.enquiries.filter((e) => !e.is_archived),
      projects: db.projects.filter((p) => !p.is_archived),
      payments: db.payments.filter((p) => !p.is_archived),
      expenses: db.expenses.filter((e) => !e.is_archived),
      activityLogs: db.activity_logs,
      quotations: (db.quotations || []).filter((q) => !q.is_archived),
      teamMembers: teamMembersList,
      teamAssignments: assignmentsWithMembers,
      workUpdates: updatesWithPhotos,
      projectPhotos: photosList,
    };
  },

  // --------------------------------------------------------------------------
  // CLIENTS
  // --------------------------------------------------------------------------
  async createClient(
    input: Omit<
      Client,
      'id' | 'client_code' | 'client_notes_log' | 'is_archived' | 'created_at' | 'updated_at'
    >
  ): Promise<Client> {
    const db = readLocalDB();
    db.counters.client += 1;
    const client_code = `AKD-CL-${String(db.counters.client).padStart(3, '0')}`;
    const now = new Date().toISOString();

    const initialNotesLog: NoteLogEntry[] = input.notes?.trim()
      ? [
          {
            id: generateUUID(),
            content: input.notes.trim(),
            created_at: now,
            author: 'Owner',
          },
        ]
      : [];

    const newClient: Client = {
      ...input,
      id: generateUUID(),
      client_code,
      project_budget:
        input.project_budget !== null && input.project_budget !== undefined
          ? fromPaise(toPaise(input.project_budget))
          : null,
      date_added: input.date_added || todayISO(),
      client_notes_log: initialNotesLog,
      is_archived: false,
      created_at: now,
      updated_at: now,
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          id: newClient.id,
          client_code: newClient.client_code,
          full_name: newClient.full_name,
          phone: newClient.phone,
          whatsapp: newClient.whatsapp || null,
          email: newClient.email || null,
          client_type: newClient.client_type,
          property_type: newClient.property_type || null,
          property_location: newClient.property_location || null,
          full_address: newClient.full_address || null,
          project_budget: newClient.project_budget,
          lead_source: newClient.lead_source || null,
          status: newClient.status,
          date_added: newClient.date_added,
          notes: newClient.notes || null,
          client_noteslog: newClient.client_notes_log,
          is_archived: false,
        })
        .select('*')
        .single();
      if (error) {
        throw new Error(`Database error creating client: ${error.message}`);
      }
      if (data) {
        await supabase.from('activity_logs').insert({
          entity_type: 'client',
          entity_id: newClient.id,
          action: 'Client Added',
          description: `Added client ${newClient.full_name} (${newClient.client_code})`,
        });
      }
    }

    db.clients.unshift(newClient);
    appendActivityLog(
      db,
      'client',
      'Client Added',
      `Added client ${newClient.full_name} (${newClient.client_code})`,
      newClient.id
    );
    writeLocalDB(db);
    return newClient;
  },

  async updateClient(id: string, updates: Partial<Client>): Promise<Client> {
    const db = readLocalDB();
    const index = db.clients.findIndex((c) => c.id === id);
    if (index === -1) throw new Error('Client record not found.');

    const existing = db.clients[index];
    const now = new Date().toISOString();
    const updated: Client = {
      ...existing,
      ...updates,
      id: existing.id,
      client_code: existing.client_code,
      project_budget:
        updates.project_budget !== undefined
          ? updates.project_budget !== null
            ? fromPaise(toPaise(updates.project_budget))
            : null
          : existing.project_budget,
      updated_at: now,
    };

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('clients')
        .update({
          full_name: updated.full_name,
          phone: updated.phone,
          whatsapp: updated.whatsapp || null,
          email: updated.email || null,
          client_type: updated.client_type,
          property_type: updated.property_type || null,
          property_location: updated.property_location || null,
          full_address: updated.full_address || null,
          project_budget: updated.project_budget,
          lead_source: updated.lead_source || null,
          status: updated.status,
          date_added: updated.date_added,
          notes: updated.notes || null,
          client_noteslog: updated.client_notes_log,
        })
        .eq('id', id);
      if (error) {
        throw new Error(`Database error updating client: ${error.message}`);
      }
    }

    db.clients[index] = updated;
    appendActivityLog(
      db,
      'client',
      'Client Updated',
      `Updated client ${updated.full_name} (${updated.client_code})`,
      updated.id
    );
    writeLocalDB(db);
    return updated;
  },

  async addClientNote(clientId: string, content: string): Promise<Client> {
    const db = readLocalDB();
    const client = db.clients.find((c) => c.id === clientId);
    if (!client) throw new Error('Client not found.');

    const entry: NoteLogEntry = {
      id: generateUUID(),
      content: content.trim(),
      created_at: new Date().toISOString(),
      author: 'Owner',
    };

    const nextLog = [entry, ...(client.client_notes_log || [])];
    return this.updateClient(clientId, {
      client_notes_log: nextLog,
      notes: content.trim(),
    });
  },

  async archiveClient(id: string): Promise<void> {
    const db = readLocalDB();
    const hasActiveProjects = db.projects.some(
      (p) => p.client_id === id && !p.is_archived
    );
    if (hasActiveProjects) {
      throw new Error(
        'Cannot delete a client with active associated projects. Archive or reassign their projects first.'
      );
    }

    const idx = db.clients.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('Client not found.');

    const target = db.clients[idx];
    target.is_archived = true;
    target.updated_at = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      await supabase.from('clients').update({ is_archived: true }).eq('id', id);
    }

    appendActivityLog(
      db,
      'client',
      'Client Archived',
      `Archived client ${target.full_name} (${target.client_code})`,
      id
    );
    writeLocalDB(db);
  },

  // --------------------------------------------------------------------------
  // ENQUIRIES
  // --------------------------------------------------------------------------
  async createEnquiry(
    input: Omit<
      Enquiry,
      | 'id'
      | 'enquiry_code'
      | 'follow_up_history'
      | 'is_archived'
      | 'created_at'
      | 'updated_at'
    >
  ): Promise<Enquiry> {
    const db = readLocalDB();
    db.counters.enquiry += 1;
    const enquiry_code = `AKD-ENQ-${String(db.counters.enquiry).padStart(3, '0')}`;
    const now = new Date().toISOString();

    const initialFollowUpHistory: NoteLogEntry[] = input.notes?.trim()
      ? [
          {
            id: generateUUID(),
            content: input.notes.trim(),
            created_at: now,
            author: 'Owner',
          },
        ]
      : [];

    const newEnquiry: Enquiry = {
      ...input,
      id: generateUUID(),
      enquiry_code,
      estimated_budget:
        input.estimated_budget !== null && input.estimated_budget !== undefined
          ? fromPaise(toPaise(input.estimated_budget))
          : null,
      enquiry_date: input.enquiry_date || todayISO(),
      follow_up_history: initialFollowUpHistory,
      is_archived: false,
      created_at: now,
      updated_at: now,
    };

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('enquiries').insert({
        id: newEnquiry.id,
        enquiry_code: newEnquiry.enquiry_code,
        name: newEnquiry.name,
        phone: newEnquiry.phone,
        email: newEnquiry.email || null,
        project_type: newEnquiry.project_type,
        property_location: newEnquiry.property_location || null,
        estimated_budget: newEnquiry.estimated_budget,
        lead_source: newEnquiry.lead_source || null,
        enquiry_date: newEnquiry.enquiry_date,
        follow_up_date: newEnquiry.follow_up_date || null,
        status: newEnquiry.status,
        notes: newEnquiry.notes || null,
        follow_up_history: newEnquiry.follow_up_history,
        is_archived: false,
      });
      if (error) {
        throw new Error(`Database error creating enquiry: ${error.message}`);
      }
    }

    db.enquiries.unshift(newEnquiry);
    appendActivityLog(
      db,
      'enquiry',
      'Enquiry Logged',
      `Logged enquiry from ${newEnquiry.name} (${newEnquiry.enquiry_code})`,
      newEnquiry.id
    );
    writeLocalDB(db);
    return newEnquiry;
  },

  async updateEnquiry(id: string, updates: Partial<Enquiry>): Promise<Enquiry> {
    const db = readLocalDB();
    const index = db.enquiries.findIndex((e) => e.id === id);
    if (index === -1) throw new Error('Enquiry record not found.');

    const existing = db.enquiries[index];
    const updated: Enquiry = {
      ...existing,
      ...updates,
      id: existing.id,
      enquiry_code: existing.enquiry_code,
      estimated_budget:
        updates.estimated_budget !== undefined
          ? updates.estimated_budget !== null
            ? fromPaise(toPaise(updates.estimated_budget))
            : null
          : existing.estimated_budget,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('enquiries')
        .update({
          name: updated.name,
          phone: updated.phone,
          email: updated.email || null,
          project_type: updated.project_type,
          property_location: updated.property_location || null,
          estimated_budget: updated.estimated_budget,
          lead_source: updated.lead_source || null,
          enquiry_date: updated.enquiry_date,
          follow_up_date: updated.follow_up_date || null,
          status: updated.status,
          notes: updated.notes || null,
          follow_up_history: updated.follow_up_history,
          converted_client_id: updated.converted_client_id || null,
          converted_project_id: updated.converted_project_id || null,
          converted_at: updated.converted_at || null,
        })
        .eq('id', id);
      if (error) {
        throw new Error(`Database error updating enquiry: ${error.message}`);
      }
    }

    db.enquiries[index] = updated;
    appendActivityLog(
      db,
      'enquiry',
      'Enquiry Updated',
      `Updated enquiry ${updated.name} (${updated.enquiry_code})`,
      updated.id
    );
    writeLocalDB(db);
    return updated;
  },

  async addEnquiryFollowUpNote(
    enquiryId: string,
    noteContent: string,
    nextFollowUpDate?: string
  ): Promise<Enquiry> {
    const db = readLocalDB();
    const enquiry = db.enquiries.find((e) => e.id === enquiryId);
    if (!enquiry) throw new Error('Enquiry not found.');

    const entry: NoteLogEntry = {
      id: generateUUID(),
      content: noteContent.trim(),
      created_at: new Date().toISOString(),
      author: 'Owner',
    };

    const nextHistory = [entry, ...(enquiry.follow_up_history || [])];
    return this.updateEnquiry(enquiryId, {
      follow_up_history: nextHistory,
      notes: noteContent.trim(),
      follow_up_date:
        nextFollowUpDate !== undefined ? nextFollowUpDate : enquiry.follow_up_date,
    });
  },

  async convertEnquiry(input: {
    enquiryId: string;
    existingClientId?: string | null;
    clientData: {
      full_name: string;
      phone: string;
      whatsapp?: string;
      email?: string;
      client_type: 'Residential' | 'Commercial';
      property_type?: string;
      property_location?: string;
      full_address?: string;
      project_budget?: number | null;
      lead_source?: string;
      notes?: string;
    };
    createProject: boolean;
    projectData?: {
      project_name: string;
      category: string;
      property_location: string;
      site_address?: string;
      description?: string;
      total_value: number;
      estimated_start_date?: string;
      expected_completion_date?: string;
      status: Project['status'];
      payment_terms?: string;
    };
  }): Promise<{ client: Client; project?: Project; enquiry: Enquiry }> {
    const db = readLocalDB();
    const enquiry = db.enquiries.find((e) => e.id === input.enquiryId && !e.is_archived);
    if (!enquiry) throw new Error('Enquiry not found.');

    let targetClient: Client;

    if (input.existingClientId) {
      const foundClient = db.clients.find(
        (c) => c.id === input.existingClientId && !c.is_archived
      );
      if (!foundClient) throw new Error('Selected existing client was not found.');
      targetClient = await this.updateClient(foundClient.id, {
        status: 'Active Client',
      });
    } else {
      targetClient = await this.createClient({
        full_name: input.clientData.full_name,
        phone: input.clientData.phone,
        whatsapp: input.clientData.whatsapp || input.clientData.phone,
        email: input.clientData.email,
        client_type: input.clientData.client_type,
        property_type: input.clientData.property_type,
        property_location: input.clientData.property_location,
        full_address: input.clientData.full_address,
        project_budget: input.clientData.project_budget,
        lead_source: input.clientData.lead_source || enquiry.lead_source,
        status: input.createProject ? 'Active Client' : 'Qualified',
        date_added: todayISO(),
        notes: input.clientData.notes || enquiry.notes,
      });
    }

    let createdProject: Project | undefined;
    if (input.createProject && input.projectData) {
      createdProject = await this.createProject({
        project_name: input.projectData.project_name,
        client_id: targetClient.id,
        category: input.projectData.category,
        property_location:
          input.projectData.property_location ||
          targetClient.property_location ||
          'Kharagpur',
        site_address: input.projectData.site_address || targetClient.full_address,
        description: input.projectData.description,
        total_value: input.projectData.total_value,
        estimated_start_date: input.projectData.estimated_start_date || todayISO(),
        expected_completion_date: input.projectData.expected_completion_date,
        status: input.projectData.status || 'Planning',
        progress_percentage: 0,
        payment_terms: input.projectData.payment_terms,
        internal_notes: `Converted from Enquiry ${enquiry.enquiry_code}`,
        source_enquiry_id: enquiry.id,
      });
    }

    const updatedEnquiry = await this.updateEnquiry(enquiry.id, {
      status: 'Converted',
      converted_client_id: targetClient.id,
      converted_project_id: createdProject?.id || null,
      converted_at: new Date().toISOString(),
    });

    return {
      client: targetClient,
      project: createdProject,
      enquiry: updatedEnquiry,
    };
  },

  async archiveEnquiry(id: string): Promise<void> {
    const db = readLocalDB();
    const idx = db.enquiries.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error('Enquiry not found.');

    const target = db.enquiries[idx];
    target.is_archived = true;
    target.updated_at = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      await supabase.from('enquiries').update({ is_archived: true }).eq('id', id);
    }

    appendActivityLog(
      db,
      'enquiry',
      'Enquiry Archived',
      `Archived enquiry ${target.name} (${target.enquiry_code})`,
      id
    );
    writeLocalDB(db);
  },

  // --------------------------------------------------------------------------
  // PROJECTS
  // --------------------------------------------------------------------------
  async createProject(
    input: Omit<
      Project,
      'id' | 'project_code' | 'is_archived' | 'created_at' | 'updated_at'
    >
  ): Promise<Project> {
    const db = readLocalDB();
    const client = db.clients.find((c) => c.id === input.client_id && !c.is_archived);
    if (!client) {
      throw new Error('A project must reference a valid active client.');
    }

    db.counters.project += 1;
    const project_code = `AKD-PRJ-${String(db.counters.project).padStart(3, '0')}`;
    const now = new Date().toISOString();

    const cleanProgress = Math.min(
      100,
      Math.max(0, Math.round(Number(input.progress_percentage) || 0))
    );

    const newProject: Project = {
      ...input,
      id: generateUUID(),
      project_code,
      total_value: fromPaise(toPaise(input.total_value)),
      progress_percentage: input.status === 'Completed' ? 100 : cleanProgress,
      current_work_stage: input.current_work_stage || input.status,
      sharing_token: input.sharing_token || generateSecureSharingToken(),
      is_sharing_enabled: input.is_sharing_enabled ?? false,
      sharing_token_created_at: input.is_sharing_enabled ? now : null,
      actual_completion_date:
        input.status === 'Completed' && !input.actual_completion_date
          ? todayISO()
          : input.actual_completion_date,
      is_archived: false,
      created_at: now,
      updated_at: now,
    };

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('projects').insert({
        id: newProject.id,
        project_code: newProject.project_code,
        project_name: newProject.project_name,
        client_id: newProject.client_id,
        category: newProject.category,
        property_location: newProject.property_location,
        site_address: newProject.site_address || null,
        description: newProject.description || null,
        total_value: newProject.total_value,
        estimated_start_date: newProject.estimated_start_date || null,
        expected_completion_date: newProject.expected_completion_date || null,
        actual_completion_date: newProject.actual_completion_date || null,
        status: newProject.status,
        progress_percentage: newProject.progress_percentage,
        payment_terms: newProject.payment_terms || null,
        internal_notes: newProject.internal_notes || null,
        source_enquiry_id: newProject.source_enquiry_id || null,
        sharing_token: newProject.sharing_token,
        is_sharing_enabled: newProject.is_sharing_enabled,
        sharing_token_created_at: newProject.sharing_token_created_at,
        current_work_stage: newProject.current_work_stage,
        is_archived: false,
      });
      if (error) {
        throw new Error(`Database error creating project: ${error.message}`);
      }
    }

    // Automatically mark client as Active Client if currently New/Contacted/Qualified
    if (['New', 'Contacted', 'Qualified'].includes(client.status)) {
      client.status = 'Active Client';
      client.updated_at = now;
    }

    db.projects.unshift(newProject);
    appendActivityLog(
      db,
      'project',
      'Project Created',
      `Created project "${newProject.project_name}" (${newProject.project_code}) for ${client.full_name}`,
      newProject.id
    );
    writeLocalDB(db);
    return newProject;
  },

  async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
    const db = readLocalDB();
    const index = db.projects.findIndex((p) => p.id === id);
    if (index === -1) throw new Error('Project record not found.');

    const existing = db.projects[index];
    if (updates.client_id && updates.client_id !== existing.client_id) {
      const targetClient = db.clients.find(
        (c) => c.id === updates.client_id && !c.is_archived
      );
      if (!targetClient) throw new Error('Selected client does not exist.');
      // Also keep any existing payments for this project consistent with the new client_id
      db.payments.forEach((pay) => {
        if (pay.project_id === id) {
          pay.client_id = updates.client_id!;
        }
      });
    }

    const nextStatus = updates.status ?? existing.status;
    let nextProgress =
      updates.progress_percentage !== undefined
        ? Math.min(100, Math.max(0, Math.round(Number(updates.progress_percentage))))
        : existing.progress_percentage;

    if (nextStatus === 'Completed' && updates.progress_percentage === undefined) {
      nextProgress = 100;
    }

    const updated: Project = {
      ...existing,
      ...updates,
      id: existing.id,
      project_code: existing.project_code,
      total_value:
        updates.total_value !== undefined
          ? fromPaise(toPaise(updates.total_value))
          : existing.total_value,
      status: nextStatus,
      progress_percentage: nextProgress,
      actual_completion_date:
        nextStatus === 'Completed' &&
        !updates.actual_completion_date &&
        !existing.actual_completion_date
          ? todayISO()
          : updates.actual_completion_date !== undefined
            ? updates.actual_completion_date
            : existing.actual_completion_date,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase) {
      const payload: any = {
        project_name: updated.project_name,
        client_id: updated.client_id,
        category: updated.category,
        property_location: updated.property_location,
        site_address: updated.site_address || null,
        description: updated.description || null,
        total_value: updated.total_value,
        estimated_start_date: updated.estimated_start_date || null,
        expected_completion_date: updated.expected_completion_date || null,
        actual_completion_date: updated.actual_completion_date || null,
        status: updated.status,
        progress_percentage: updated.progress_percentage,
        payment_terms: updated.payment_terms || null,
        internal_notes: updated.internal_notes || null,
      };
      if (updated.sharing_token !== undefined) payload.sharing_token = updated.sharing_token;
      if (updated.is_sharing_enabled !== undefined) payload.is_sharing_enabled = updated.is_sharing_enabled;
      if (updated.sharing_token_created_at !== undefined) payload.sharing_token_created_at = updated.sharing_token_created_at;
      if (updated.current_work_stage !== undefined) payload.current_work_stage = updated.current_work_stage;

      const { error } = await supabase
        .from('projects')
        .update(payload)
        .eq('id', id);
      if (error) {
        throw new Error(`Database error updating project: ${error.message}`);
      }
    }

    db.projects[index] = updated;
    appendActivityLog(
      db,
      'project',
      'Project Updated',
      `Updated project "${updated.project_name}" (${updated.status} • ${updated.progress_percentage}%)`,
      updated.id
    );
    writeLocalDB(db);
    return updated;
  },

  async archiveProject(id: string): Promise<void> {
    const db = readLocalDB();
    const hasPayments = db.payments.some((p) => p.project_id === id && !p.is_archived);
    if (hasPayments) {
      throw new Error(
        'Cannot delete a project that has recorded payments. Remove or archive its payment records first to preserve financial integrity.'
      );
    }

    const idx = db.projects.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error('Project not found.');

    const target = db.projects[idx];
    target.is_archived = true;
    target.updated_at = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      await supabase.from('projects').update({ is_archived: true }).eq('id', id);
    }

    appendActivityLog(
      db,
      'project',
      'Project Archived',
      `Archived project "${target.project_name}" (${target.project_code})`,
      id
    );
    writeLocalDB(db);
  },

  // --------------------------------------------------------------------------
  // PAYMENTS
  // --------------------------------------------------------------------------
  async createPayment(
    input: Omit<
      Payment,
      | 'id'
      | 'payment_code'
      | 'receipt_number'
      | 'is_archived'
      | 'created_at'
      | 'updated_at'
    >
  ): Promise<Payment> {
    const db = readLocalDB();
    const project = db.projects.find((p) => p.id === input.project_id && !p.is_archived);
    if (!project) {
      throw new Error('Payment must reference a valid active project.');
    }

    // Enforce strict client-project consistency
    const resolvedClientId = project.client_id;
    if (input.client_id && input.client_id !== resolvedClientId) {
      throw new Error('Selected client does not match the project client.');
    }

    const cleanAmount = fromPaise(toPaise(input.amount));
    if (cleanAmount <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }

    db.counters.payment += 1;
    const seq = String(db.counters.payment).padStart(3, '0');
    const year = new Date().getFullYear();
    const payment_code = `AKD-PAY-${seq}`;
    const receipt_number = `AKD-RCP-${year}-${seq}`;
    const now = new Date().toISOString();

    const newPayment: Payment = {
      ...input,
      id: generateUUID(),
      payment_code,
      receipt_number,
      client_id: resolvedClientId,
      project_id: project.id,
      amount: cleanAmount,
      payment_date: input.payment_date || todayISO(),
      is_archived: false,
      created_at: now,
      updated_at: now,
    };

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('payments').insert({
        id: newPayment.id,
        payment_code: newPayment.payment_code,
        receipt_number: newPayment.receipt_number,
        client_id: newPayment.client_id,
        project_id: newPayment.project_id,
        amount: newPayment.amount,
        payment_date: newPayment.payment_date,
        payment_method: newPayment.payment_method,
        payment_type: newPayment.payment_type,
        transaction_reference: newPayment.transaction_reference || null,
        notes: newPayment.notes || null,
        is_archived: false,
      });
      if (error) {
        throw new Error(`Database error recording payment: ${error.message}`);
      }
    }

    db.payments.unshift(newPayment);
    appendActivityLog(
      db,
      'payment',
      'Payment Recorded',
      `Recorded ${newPayment.payment_type} of ₹${newPayment.amount.toLocaleString('en-IN')} for "${project.project_name}" (${newPayment.receipt_number})`,
      newPayment.id
    );
    writeLocalDB(db);
    return newPayment;
  },

  async updatePayment(id: string, updates: Partial<Payment>): Promise<Payment> {
    const db = readLocalDB();
    const index = db.payments.findIndex((p) => p.id === id);
    if (index === -1) throw new Error('Payment record not found.');

    const existing = db.payments[index];
    const targetProjectId = updates.project_id ?? existing.project_id;
    const project = db.projects.find((p) => p.id === targetProjectId && !p.is_archived);
    if (!project) throw new Error('Referenced project does not exist.');

    const cleanAmount =
      updates.amount !== undefined ? fromPaise(toPaise(updates.amount)) : existing.amount;
    if (cleanAmount <= 0) throw new Error('Payment amount must be greater than zero.');

    const updated: Payment = {
      ...existing,
      ...updates,
      id: existing.id,
      payment_code: existing.payment_code,
      receipt_number: existing.receipt_number,
      project_id: project.id,
      client_id: project.client_id,
      amount: cleanAmount,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('payments')
        .update({
          project_id: updated.project_id,
          client_id: updated.client_id,
          amount: updated.amount,
          payment_date: updated.payment_date,
          payment_method: updated.payment_method,
          payment_type: updated.payment_type,
          transaction_reference: updated.transaction_reference || null,
          notes: updated.notes || null,
        })
        .eq('id', id);
      if (error) {
        throw new Error(`Database error updating payment: ${error.message}`);
      }
    }

    db.payments[index] = updated;
    appendActivityLog(
      db,
      'payment',
      'Payment Updated',
      `Updated payment ${updated.receipt_number} (₹${updated.amount.toLocaleString('en-IN')})`,
      updated.id
    );
    writeLocalDB(db);
    return updated;
  },

  async archivePayment(id: string): Promise<void> {
    const db = readLocalDB();
    const idx = db.payments.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error('Payment record not found.');

    const target = db.payments[idx];
    target.is_archived = true;
    target.updated_at = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('payments').update({ is_archived: true }).eq('id', id);
      if (error) throw new Error(`Database error archiving payment: ${error.message}`);
    }

    appendActivityLog(
      db,
      'payment',
      'Payment Archived',
      `Removed payment ${target.receipt_number} of ₹${target.amount.toLocaleString('en-IN')}`,
      id
    );
    writeLocalDB(db);
    return;
  },

  // --------------------------------------------------------------------------
  // EXPENSES
  // --------------------------------------------------------------------------
  async createExpense(
    input: Omit<
      Expense,
      'id' | 'expense_code' | 'is_archived' | 'created_at' | 'updated_at'
    >
  ): Promise<Expense> {
    const db = readLocalDB();
    const cleanAmount = fromPaise(toPaise(input.amount));
    if (cleanAmount <= 0) {
      throw new Error('Expense amount must be greater than zero.');
    }

    if (input.project_id) {
      const proj = db.projects.find((p) => p.id === input.project_id && !p.is_archived);
      if (!proj) throw new Error('Selected project does not exist.');
    }

    db.counters.expense += 1;
    const expense_code = `AKD-EXP-${String(db.counters.expense).padStart(3, '0')}`;
    const now = new Date().toISOString();

    const newExpense: Expense = {
      ...input,
      id: generateUUID(),
      expense_code,
      project_id: input.project_id || null,
      amount: cleanAmount,
      expense_date: input.expense_date || todayISO(),
      is_archived: false,
      created_at: now,
      updated_at: now,
    };

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('expenses').insert({
        id: newExpense.id,
        expense_code: newExpense.expense_code,
        title: newExpense.title,
        category: newExpense.category,
        project_id: newExpense.project_id || null,
        amount: newExpense.amount,
        expense_date: newExpense.expense_date,
        vendor_name: newExpense.vendor_name || null,
        payment_method: newExpense.payment_method,
        reference_number: newExpense.reference_number || null,
        notes: newExpense.notes || null,
        is_archived: false,
      });
      if (error) {
        throw new Error(`Database error recording expense: ${error.message}`);
      }
    }

    db.expenses.unshift(newExpense);
    appendActivityLog(
      db,
      'expense',
      'Expense Recorded',
      `Recorded expense "${newExpense.title}" (${newExpense.category}) of ₹${newExpense.amount.toLocaleString('en-IN')}`,
      newExpense.id
    );
    writeLocalDB(db);
    return newExpense;
  },

  async updateExpense(id: string, updates: Partial<Expense>): Promise<Expense> {
    const db = readLocalDB();
    const index = db.expenses.findIndex((e) => e.id === id);
    if (index === -1) throw new Error('Expense record not found.');

    const existing = db.expenses[index];
    const cleanAmount =
      updates.amount !== undefined ? fromPaise(toPaise(updates.amount)) : existing.amount;
    if (cleanAmount <= 0) throw new Error('Expense amount must be greater than zero.');

    const updated: Expense = {
      ...existing,
      ...updates,
      id: existing.id,
      expense_code: existing.expense_code,
      project_id:
        updates.project_id !== undefined ? updates.project_id || null : existing.project_id,
      amount: cleanAmount,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('expenses')
        .update({
          title: updated.title,
          category: updated.category,
          project_id: updated.project_id || null,
          amount: updated.amount,
          expense_date: updated.expense_date,
          vendor_name: updated.vendor_name || null,
          payment_method: updated.payment_method,
          reference_number: updated.reference_number || null,
          notes: updated.notes || null,
        })
        .eq('id', id);
      if (error) {
        throw new Error(`Database error updating expense: ${error.message}`);
      }
    }

    db.expenses[index] = updated;
    appendActivityLog(
      db,
      'expense',
      'Expense Updated',
      `Updated expense "${updated.title}" (₹${updated.amount.toLocaleString('en-IN')})`,
      updated.id
    );
    writeLocalDB(db);
    return updated;
  },

  async archiveExpense(id: string): Promise<void> {
    const db = readLocalDB();
    const idx = db.expenses.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error('Expense record not found.');

    const target = db.expenses[idx];
    target.is_archived = true;
    target.updated_at = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('expenses').update({ is_archived: true }).eq('id', id);
      if (error) throw new Error(`Database error archiving expense: ${error.message}`);
    }

    appendActivityLog(
      db,
      'expense',
      'Expense Archived',
      `Removed expense "${target.title}" (${target.expense_code})`,
      id
    );
    writeLocalDB(db);
  },

  // --------------------------------------------------------------------------
  // SETTINGS & DATA MANAGEMENT
  // --------------------------------------------------------------------------
  async updateSettings(updates: Partial<BusinessSettings>): Promise<BusinessSettings> {
    const db = readLocalDB();
    const updated: BusinessSettings = {
      ...db.settings,
      ...updates,
      id: db.settings.id,
      quotation_pdf_defaults: {
        ...DEFAULT_QUOTATION_PDF_SECTIONS,
        ...(db.settings.quotation_pdf_defaults || {}),
        ...(updates.quotation_pdf_defaults || {}),
      },
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase) {
      const corePayload = {
        id: updated.id,
        business_name: updated.business_name,
        authorized_signatory: updated.authorized_signatory,
        logo_url: updated.logo_url,
        phone: updated.phone,
        email: updated.email,
        address: updated.address,
        website: updated.website,
        currency: updated.currency,
        date_format: updated.date_format,
        financial_year_start_month: updated.financial_year_start_month,
        project_categories: updated.project_categories,
        expense_categories: updated.expense_categories,
        lead_sources: updated.lead_sources,
      };
      const extendedPayload = {
        ...corePayload,
        gstin: updated.gstin || '',
        bank_account_name: updated.bank_account_name || '',
        bank_name: updated.bank_name || '',
        bank_account_number: updated.bank_account_number || '',
        bank_ifsc_code: updated.bank_ifsc_code || '',
        bank_branch: updated.bank_branch || '',
        bank_upi_id: updated.bank_upi_id || '',
        signature_url: updated.signature_url || '',
        default_payment_terms: updated.default_payment_terms || '',
        default_terms_and_conditions: updated.default_terms_and_conditions || '',
        default_quotation_validity_days: updated.default_quotation_validity_days ?? 30,
        quotation_pdf_defaults: updated.quotation_pdf_defaults,
      };

      const { error: extErr } = await supabase.from('business_settings').upsert(extendedPayload);
      if (extErr) {
        // Fallback to core columns if migration 003 hasn't been applied on remote DB yet
        const { error: coreErr } = await supabase.from('business_settings').upsert(corePayload);
        if (coreErr) {
          throw new Error(`Database error updating business settings: ${coreErr.message}`);
        }
      }
    }

    db.settings = updated;
    appendActivityLog(
      db,
      'settings',
      'Settings Updated',
      `Updated studio profile & preferences`
    );
    writeLocalDB(db);
    return updated;
  },

  async clearAllBusinessData(): Promise<void> {
    const db = readLocalDB();
    const fresh: LocalDatabaseState = {
      settings: db.settings,
      clients: [],
      enquiries: [],
      projects: [],
      payments: [],
      expenses: [],
      activity_logs: [],
      quotations: [],
      team_members: [],
      project_team_assignments: [],
      project_work_updates: [],
      project_photos: [],
      counters: {
        client: 0,
        enquiry: 0,
        project: 0,
        payment: 0,
        expense: 0,
        quotation: 0,
      },
    };
    appendActivityLog(
      fresh,
      'settings',
      'Database Reset',
      'Cleared all records to a clean empty state'
    );
    writeLocalDB(fresh);
  },

  // --------------------------------------------------------------------------
  // QUOTATIONS & BOQ
  // --------------------------------------------------------------------------
  async createQuotation(input: {
    client_id: string;
    project_id?: string | null;
    quotation_date?: string;
    valid_until?: string;
    status?: QuotationStatus;
    scope_of_work?: string;
    payment_terms?: string;
    terms_and_conditions?: string;
    notes?: string;
    discount_percentage?: number;
    tax_rate?: number;
    pdf_sections?: QuotationPDFSections;
    items: Array<{
      item_name: string;
      description?: string;
      quantity: number;
      unit: string;
      rate: number;
      sort_order?: number;
    }>;
  }): Promise<Quotation> {
    const db = readLocalDB();
    const client = db.clients.find((c) => c.id === input.client_id && !c.is_archived);
    if (!client) {
      throw new Error('Please select a valid active client for this quotation.');
    }
    if (!input.items || input.items.length === 0) {
      throw new Error('Please add at least one BOQ line item.');
    }

    db.counters.quotation = (db.counters.quotation || 0) + 1;
    const quotation_number = `AKD-QT-${String(db.counters.quotation).padStart(3, '0')}`;
    const now = new Date().toISOString();
    const discount_percentage = Math.min(100, Math.max(0, Number(input.discount_percentage || 0)));
    const tax_rate = Math.max(0, Number(input.tax_rate || 0));

    const totals = computeQuotationTotals(input.items, discount_percentage, tax_rate);
    const quoteId = generateUUID();

    const items: QuotationItem[] = input.items
      .map((it, idx) => {
        const qty = Math.max(0.01, Number(it.quantity) || 1);
        const rate = Math.max(0, fromPaise(toPaise(Number(it.rate) || 0)));
        return {
          id: generateUUID(),
          quotation_id: quoteId,
          item_name: it.item_name.trim(),
          description: it.description?.trim() || '',
          quantity: qty,
          unit: it.unit || 'Sq. ft.',
          rate,
          amount: Math.max(0, fromPaise(toPaise(qty * rate))),
          sort_order: it.sort_order !== undefined ? it.sort_order : idx,
        };
      })
      .sort((a, b) => a.sort_order - b.sort_order);

    const qDate = input.quotation_date || todayISO();
    const defaultValidUntil = (() => {
      const d = new Date();
      d.setDate(d.getDate() + (db.settings.default_quotation_validity_days || 30));
      return d.toISOString().slice(0, 10);
    })();

    const newQuotation: Quotation = {
      id: quoteId,
      quotation_number,
      revision_number: 1,
      parent_quotation_id: null,
      project_id: input.project_id || null,
      client_id: input.client_id,
      quotation_date: qDate,
      valid_until: input.valid_until || defaultValidUntil,
      status: input.status || 'Draft',
      scope_of_work: input.scope_of_work?.trim() || '',
      payment_terms: input.payment_terms?.trim() || '',
      terms_and_conditions: input.terms_and_conditions?.trim() || '',
      notes: input.notes?.trim() || '',
      subtotal: totals.subtotal,
      discount_percentage,
      discount_amount: totals.discount_amount,
      tax_rate,
      tax_amount: totals.tax_amount,
      total_amount: totals.total_amount,
      pdf_sections: input.pdf_sections
        ? { ...DEFAULT_QUOTATION_PDF_SECTIONS, ...input.pdf_sections }
        : undefined,
      items,
      is_archived: false,
      created_at: now,
      updated_at: now,
    };

    if (isSupabaseConfigured && supabase) {
      const coreQuotePayload = {
        id: newQuotation.id,
        quotation_number: newQuotation.quotation_number,
        revision_number: newQuotation.revision_number,
        parent_quotation_id: null,
        project_id: newQuotation.project_id,
        client_id: newQuotation.client_id,
        quotation_date: newQuotation.quotation_date,
        valid_until: newQuotation.valid_until,
        status: newQuotation.status,
        scope_of_work: newQuotation.scope_of_work,
        terms_and_conditions: newQuotation.terms_and_conditions,
        notes: newQuotation.notes,
        subtotal: newQuotation.subtotal,
        discount_percentage: newQuotation.discount_percentage,
        discount_amount: newQuotation.discount_amount,
        tax_rate: newQuotation.tax_rate,
        tax_amount: newQuotation.tax_amount,
        total_amount: newQuotation.total_amount,
        is_archived: false,
      };
      const extQuotePayload = {
        ...coreQuotePayload,
        payment_terms: newQuotation.payment_terms || null,
        pdf_sections: newQuotation.pdf_sections || null,
      };

      const { error: extErr } = await supabase.from('quotations').insert(extQuotePayload);
      if (extErr) {
        const { error: coreErr } = await supabase.from('quotations').insert(coreQuotePayload);
        if (coreErr) {
          throw new Error(`Database error saving quotation: ${coreErr.message}`);
        }
      }

      if (items.length > 0) {
        const { error: itemsErr } = await supabase.from('quotation_items').insert(
          items.map((it) => ({
            id: it.id,
            quotation_id: it.quotation_id,
            item_name: it.item_name,
            description: it.description || null,
            quantity: it.quantity,
            unit: it.unit,
            rate: it.rate,
            amount: it.amount,
            sort_order: it.sort_order,
          }))
        );
        if (itemsErr) {
          throw new Error(`Database error saving quotation items: ${itemsErr.message}`);
        }
      }
    }

    if (!db.quotations) db.quotations = [];
    db.quotations.unshift(newQuotation);
    appendActivityLog(
      db,
      'quotation',
      'Quotation Created',
      `Created quotation ${newQuotation.quotation_number} (₹${newQuotation.total_amount.toLocaleString('en-IN')})`,
      newQuotation.id
    );
    writeLocalDB(db);
    return newQuotation;
  },

  async updateQuotation(
    id: string,
    updates: Partial<Quotation>,
    newItems?: Array<Omit<QuotationItem, 'id' | 'quotation_id'>>
  ): Promise<Quotation> {
    const db = readLocalDB();
    if (!db.quotations) db.quotations = [];
    const idx = db.quotations.findIndex((q) => q.id === id);
    if (idx === -1) throw new Error('Quotation not found.');

    const existing = db.quotations[idx];
    const now = new Date().toISOString();

    let items = existing.items;
    if (newItems) {
      if (newItems.length === 0) {
        throw new Error('Quotation must contain at least one BOQ line item.');
      }
      items = newItems
        .map((it, index) => {
          const qty = Math.max(0.01, Number(it.quantity) || 1);
          const rate = Math.max(0, fromPaise(toPaise(Number(it.rate) || 0)));
          return {
            id: generateUUID(),
            quotation_id: id,
            item_name: it.item_name.trim(),
            description: it.description?.trim() || '',
            quantity: qty,
            unit: it.unit || 'Sq. ft.',
            rate,
            amount: Math.max(0, fromPaise(toPaise(qty * rate))),
            sort_order: it.sort_order !== undefined ? it.sort_order : index,
          };
        })
        .sort((a, b) => a.sort_order - b.sort_order);
    }

    const discount_percentage =
      updates.discount_percentage !== undefined
        ? Math.min(100, Math.max(0, Number(updates.discount_percentage)))
        : existing.discount_percentage;
    const tax_rate =
      updates.tax_rate !== undefined
        ? Math.max(0, Number(updates.tax_rate))
        : existing.tax_rate;

    const totals = computeQuotationTotals(items, discount_percentage, tax_rate);

    const updated: Quotation = {
      ...existing,
      ...updates,
      id: existing.id,
      quotation_number: existing.quotation_number,
      revision_number: existing.revision_number,
      subtotal: totals.subtotal,
      discount_percentage,
      discount_amount: totals.discount_amount,
      tax_rate,
      tax_amount: totals.tax_amount,
      total_amount: totals.total_amount,
      items,
      updated_at: now,
    };

    if (isSupabaseConfigured && supabase) {
      const coreUpdatePayload = {
        project_id: updated.project_id || null,
        client_id: updated.client_id,
        quotation_date: updated.quotation_date,
        valid_until: updated.valid_until,
        status: updated.status,
        scope_of_work: updated.scope_of_work || null,
        terms_and_conditions: updated.terms_and_conditions || null,
        notes: updated.notes || null,
        subtotal: updated.subtotal,
        discount_percentage: updated.discount_percentage,
        discount_amount: updated.discount_amount,
        tax_rate: updated.tax_rate,
        tax_amount: updated.tax_amount,
        total_amount: updated.total_amount,
      };
      const extUpdatePayload = {
        ...coreUpdatePayload,
        payment_terms: updated.payment_terms || null,
        pdf_sections: updated.pdf_sections || null,
      };

      const { error: extErr } = await supabase
        .from('quotations')
        .update(extUpdatePayload)
        .eq('id', id);
      if (extErr) {
        const { error: coreErr } = await supabase
          .from('quotations')
          .update(coreUpdatePayload)
          .eq('id', id);
        if (coreErr) {
          throw new Error(`Database error updating quotation: ${coreErr.message}`);
        }
      }

      if (newItems) {
        const { error: delErr } = await supabase
          .from('quotation_items')
          .delete()
          .eq('quotation_id', id);
        if (delErr) {
          throw new Error(`Database error replacing quotation items: ${delErr.message}`);
        }
        if (items.length > 0) {
          const { error: itemsErr } = await supabase.from('quotation_items').insert(
            items.map((it) => ({
              id: it.id,
              quotation_id: it.quotation_id,
              item_name: it.item_name,
              description: it.description || null,
              quantity: it.quantity,
              unit: it.unit,
              rate: it.rate,
              amount: it.amount,
              sort_order: it.sort_order,
            }))
          );
          if (itemsErr) {
            throw new Error(`Database error updating quotation items: ${itemsErr.message}`);
          }
        }
      }
    }

    db.quotations[idx] = updated;
    appendActivityLog(
      db,
      'quotation',
      'Quotation Updated',
      `Updated quotation ${updated.quotation_number} (${updated.status} • ₹${updated.total_amount.toLocaleString('en-IN')})`,
      updated.id
    );
    writeLocalDB(db);
    return updated;
  },

  async createQuotationRevision(originalQuotationId: string): Promise<Quotation> {
    const db = readLocalDB();
    if (!db.quotations) db.quotations = [];
    const orig = db.quotations.find((q) => q.id === originalQuotationId);
    if (!orig) throw new Error('Original quotation not found.');

    orig.status = 'Revised';
    orig.updated_at = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      const { error: revErr } = await supabase
        .from('quotations')
        .update({ status: 'Revised' })
        .eq('id', orig.id);
      if (revErr) throw new Error(`Database error marking quotation revised: ${revErr.message}`);
    }

    const baseCode = orig.quotation_number.replace(/-R\d+$/, '');
    const highestRevForBase = db.quotations
      .filter((q) => q.quotation_number.replace(/-R\d+$/, '') === baseCode)
      .reduce((maxRev, q) => Math.max(maxRev, Number(q.revision_number) || 1), orig.revision_number || 1);

    const nextRev = highestRevForBase + 1;
    const newQuoteNumber = `${baseCode}-R${nextRev}`;
    const newQuoteId = generateUUID();
    const now = new Date().toISOString();

    const validUntilDate = (() => {
      const d = new Date();
      d.setDate(d.getDate() + (db.settings.default_quotation_validity_days || 30));
      return d.toISOString().slice(0, 10);
    })();

    const clonedItems: QuotationItem[] = [...orig.items]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((it, idx) => ({
        ...it,
        id: generateUUID(),
        quotation_id: newQuoteId,
        sort_order: it.sort_order !== undefined ? it.sort_order : idx,
      }));

    const revisedQuotation: Quotation = {
      ...orig,
      id: newQuoteId,
      quotation_number: newQuoteNumber,
      revision_number: nextRev,
      parent_quotation_id: orig.id,
      status: 'Draft',
      quotation_date: todayISO(),
      valid_until: validUntilDate,
      items: clonedItems,
      created_at: now,
      updated_at: now,
    };

    if (isSupabaseConfigured && supabase) {
      const coreRevPayload = {
        id: revisedQuotation.id,
        quotation_number: revisedQuotation.quotation_number,
        revision_number: revisedQuotation.revision_number,
        parent_quotation_id: revisedQuotation.parent_quotation_id,
        project_id: revisedQuotation.project_id,
        client_id: revisedQuotation.client_id,
        quotation_date: revisedQuotation.quotation_date,
        valid_until: revisedQuotation.valid_until,
        status: revisedQuotation.status,
        scope_of_work: revisedQuotation.scope_of_work,
        terms_and_conditions: revisedQuotation.terms_and_conditions,
        notes: revisedQuotation.notes,
        subtotal: revisedQuotation.subtotal,
        discount_percentage: revisedQuotation.discount_percentage,
        discount_amount: revisedQuotation.discount_amount,
        tax_rate: revisedQuotation.tax_rate,
        tax_amount: revisedQuotation.tax_amount,
        total_amount: revisedQuotation.total_amount,
        is_archived: false,
      };
      const extRevPayload = {
        ...coreRevPayload,
        payment_terms: revisedQuotation.payment_terms || null,
        pdf_sections: revisedQuotation.pdf_sections || null,
      };

      const { error: extErr } = await supabase.from('quotations').insert(extRevPayload);
      if (extErr) {
        const { error: coreErr } = await supabase.from('quotations').insert(coreRevPayload);
        if (coreErr) throw new Error(`Database error creating revision: ${coreErr.message}`);
      }

      if (clonedItems.length > 0) {
        const { error: itemsErr } = await supabase.from('quotation_items').insert(
          clonedItems.map((it) => ({
            id: it.id,
            quotation_id: it.quotation_id,
            item_name: it.item_name,
            description: it.description || null,
            quantity: it.quantity,
            unit: it.unit,
            rate: it.rate,
            amount: it.amount,
            sort_order: it.sort_order,
          }))
        );
        if (itemsErr) throw new Error(`Database error cloning revision items: ${itemsErr.message}`);
      }
    }

    db.quotations.unshift(revisedQuotation);
    appendActivityLog(
      db,
      'quotation',
      'Quotation Revision Created',
      `Created revision ${revisedQuotation.quotation_number} from ${orig.quotation_number}`,
      revisedQuotation.id
    );
    writeLocalDB(db);
    return revisedQuotation;
  },

  async archiveQuotation(id: string): Promise<void> {
    const db = readLocalDB();
    if (!db.quotations) db.quotations = [];
    const idx = db.quotations.findIndex((q) => q.id === id);
    if (idx === -1) throw new Error('Quotation not found.');
    db.quotations[idx].is_archived = true;
    db.quotations[idx].updated_at = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('quotations').update({ is_archived: true }).eq('id', id);
      if (error) throw new Error(`Database error archiving quotation: ${error.message}`);
    }
    appendActivityLog(
      db,
      'quotation',
      'Quotation Archived',
      `Archived quotation ${db.quotations[idx].quotation_number}`,
      id
    );
    writeLocalDB(db);
  },

  async createProjectFromQuotation(
    quotationId: string,
    projectData?: {
      project_name?: string;
      category?: string;
      property_location?: string;
      site_address?: string;
      estimated_start_date?: string;
      expected_completion_date?: string;
    }
  ): Promise<Project> {
    const db = readLocalDB();
    const quote = (db.quotations || []).find((q) => q.id === quotationId);
    if (!quote) throw new Error('Quotation not found.');

    if (quote.project_id) {
      const existingProject = db.projects.find((p) => p.id === quote.project_id && !p.is_archived);
      if (existingProject) {
        throw new Error(
          `Quotation is already linked to project "${existingProject.project_name}". Duplicate creation prevented.`
        );
      }
    }

    const client = db.clients.find((c) => c.id === quote.client_id && !c.is_archived);
    if (!client) throw new Error('Associated client not found.');

    const newProject = await this.createProject({
      project_name: projectData?.project_name || `${client.full_name} Interior Project`,
      client_id: client.id,
      category: projectData?.category || 'Residential Interior',
      property_location:
        projectData?.property_location || client.property_location || 'Kharagpur',
      site_address: projectData?.site_address || client.full_address || '',
      description: quote.scope_of_work || '',
      total_value: quote.total_amount,
      estimated_start_date: projectData?.estimated_start_date || todayISO(),
      expected_completion_date: projectData?.expected_completion_date,
      status: 'Approved',
      progress_percentage: 0,
      payment_terms: quote.payment_terms || quote.terms_and_conditions || '',
      internal_notes: `Created from accepted quotation ${quote.quotation_number}`,
    });

    await this.updateQuotation(quote.id, {
      project_id: newProject.id,
      status: 'Accepted',
    });

    return newProject;
  },

  // --------------------------------------------------------------------------
  // TEAM DIRECTORY & PROJECT ASSIGNMENTS
  // --------------------------------------------------------------------------
  async createTeamMember(
    input: Omit<TeamMember, 'id' | 'created_at' | 'updated_at'>
  ): Promise<TeamMember> {
    const db = readLocalDB();
    if (!db.team_members) db.team_members = [];
    const now = new Date().toISOString();
    const newMember: TeamMember = {
      ...input,
      id: generateUUID(),
      created_at: now,
      updated_at: now,
    };

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('team_members').insert({
        id: newMember.id,
        full_name: newMember.full_name,
        phone: newMember.phone,
        role: newMember.role,
        skill: newMember.skill || null,
        notes: newMember.notes || null,
        is_active: newMember.is_active,
      });
      if (error) throw new Error(`Database error creating team member: ${error.message}`);
    }

    db.team_members.unshift(newMember);
    appendActivityLog(
      db,
      'team',
      'Team Member Added',
      `Added ${newMember.full_name} (${newMember.role})`,
      newMember.id
    );
    writeLocalDB(db);
    return newMember;
  },

  async updateTeamMember(id: string, updates: Partial<TeamMember>): Promise<TeamMember> {
    const db = readLocalDB();
    if (!db.team_members) db.team_members = [];
    const idx = db.team_members.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error('Team member not found.');

    const updated: TeamMember = {
      ...db.team_members[idx],
      ...updates,
      id,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('team_members')
        .update({
          full_name: updated.full_name,
          phone: updated.phone,
          role: updated.role,
          skill: updated.skill || null,
          notes: updated.notes || null,
          is_active: updated.is_active,
        })
        .eq('id', id);
      if (error) throw new Error(`Database error updating team member: ${error.message}`);
    }

    db.team_members[idx] = updated;
    if (db.project_team_assignments) {
      db.project_team_assignments = db.project_team_assignments.map((a) =>
        a.team_member_id === id ? { ...a, member: updated } : a
      );
    }
    writeLocalDB(db);
    return updated;
  },

  async deleteTeamMember(id: string): Promise<void> {
    const db = readLocalDB();
    if (!db.team_members) db.team_members = [];
    db.team_members = db.team_members.filter((m) => m.id !== id);
    if (!db.project_team_assignments) db.project_team_assignments = [];
    db.project_team_assignments = db.project_team_assignments.filter((a) => a.team_member_id !== id);

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('team_members').delete().eq('id', id);
      if (error) throw new Error(`Database error deleting team member: ${error.message}`);
    }
    writeLocalDB(db);
  },

  async assignTeamMember(
    projectId: string,
    teamMemberId: string,
    roleOnProject?: string,
    notes?: string
  ): Promise<ProjectTeamAssignment> {
    const db = readLocalDB();
    if (!db.project_team_assignments) db.project_team_assignments = [];
    if (!db.team_members) db.team_members = [];

    const member = db.team_members.find((m) => m.id === teamMemberId);
    if (!member) throw new Error('Team member not found.');

    const existing = db.project_team_assignments.find(
      (a) => a.project_id === projectId && a.team_member_id === teamMemberId
    );
    if (existing) {
      throw new Error(`${member.full_name} is already assigned to this project.`);
    }

    const newAssignment: ProjectTeamAssignment = {
      id: generateUUID(),
      project_id: projectId,
      team_member_id: teamMemberId,
      role_on_project: roleOnProject?.trim() || member.role,
      assigned_date: todayISO(),
      notes: notes?.trim() || '',
      member,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('project_team_assignments').insert({
        id: newAssignment.id,
        project_id: newAssignment.project_id,
        team_member_id: newAssignment.team_member_id,
        role_on_project: newAssignment.role_on_project,
        assigned_date: newAssignment.assigned_date,
        notes: newAssignment.notes,
      });
      if (error) throw new Error(`Database error assigning team member: ${error.message}`);
    }

    db.project_team_assignments.push(newAssignment);
    appendActivityLog(
      db,
      'team',
      'Team Member Assigned',
      `Assigned ${member.full_name} (${newAssignment.role_on_project}) to project`,
      projectId
    );
    writeLocalDB(db);
    return newAssignment;
  },

  async updateTeamAssignment(
    assignmentId: string,
    updates: { role_on_project?: string; notes?: string; assigned_date?: string }
  ): Promise<ProjectTeamAssignment> {
    const db = readLocalDB();
    if (!db.project_team_assignments) db.project_team_assignments = [];
    const idx = db.project_team_assignments.findIndex((a) => a.id === assignmentId);
    if (idx === -1) throw new Error('Team assignment not found.');

    const existing = db.project_team_assignments[idx];
    const updated: ProjectTeamAssignment = {
      ...existing,
      role_on_project:
        updates.role_on_project !== undefined
          ? updates.role_on_project.trim()
          : existing.role_on_project,
      notes: updates.notes !== undefined ? updates.notes.trim() : existing.notes,
      assigned_date: updates.assigned_date || existing.assigned_date,
    };

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('project_team_assignments')
        .update({
          role_on_project: updated.role_on_project || null,
          notes: updated.notes || null,
          assigned_date: updated.assigned_date,
        })
        .eq('id', assignmentId);
      if (error) throw new Error(`Database error updating team assignment: ${error.message}`);
    }

    db.project_team_assignments[idx] = updated;
    writeLocalDB(db);
    return updated;
  },

  async removeTeamAssignment(assignmentId: string): Promise<void> {
    const db = readLocalDB();
    if (!db.project_team_assignments) db.project_team_assignments = [];
    db.project_team_assignments = db.project_team_assignments.filter((a) => a.id !== assignmentId);

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('project_team_assignments')
        .delete()
        .eq('id', assignmentId);
      if (error) throw new Error(`Database error removing team assignment: ${error.message}`);
    }
    writeLocalDB(db);
  },

  // --------------------------------------------------------------------------
  // WORK UPDATES & TIMELINE
  // --------------------------------------------------------------------------
  async createWorkUpdate(input: {
    project_id: string;
    update_date?: string;
    work_stage: WorkStage;
    work_completed: string;
    progress_percentage: number;
    work_remaining?: string;
    client_note?: string;
    internal_note?: string;
    is_visible_to_client: boolean;
    photo_ids?: string[];
  }): Promise<ProjectWorkUpdate> {
    const db = readLocalDB();
    if (!db.project_work_updates) db.project_work_updates = [];
    if (!db.project_photos) db.project_photos = [];

    const now = new Date().toISOString();
    const cleanProgress = Math.min(
      100,
      Math.max(0, Math.round(Number(input.progress_percentage) || 0))
    );

    const newUpdate: ProjectWorkUpdate = {
      id: generateUUID(),
      project_id: input.project_id,
      update_date: input.update_date || todayISO(),
      work_stage: input.work_stage,
      work_completed: input.work_completed.trim(),
      progress_percentage: cleanProgress,
      work_remaining: input.work_remaining?.trim() || '',
      client_note: input.client_note?.trim() || '',
      internal_note: input.internal_note?.trim() || '',
      is_visible_to_client: input.is_visible_to_client,
      photos: [],
      created_at: now,
      updated_at: now,
    };

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('project_work_updates').insert({
        id: newUpdate.id,
        project_id: newUpdate.project_id,
        update_date: newUpdate.update_date,
        work_stage: newUpdate.work_stage,
        work_completed: newUpdate.work_completed,
        progress_percentage: newUpdate.progress_percentage,
        work_remaining: newUpdate.work_remaining || null,
        client_note: newUpdate.client_note || null,
        internal_note: newUpdate.internal_note || null,
        is_visible_to_client: newUpdate.is_visible_to_client,
      });
      if (error) throw new Error(`Database error creating work update: ${error.message}`);
    }

    // Link attached photos
    if (input.photo_ids && input.photo_ids.length > 0) {
      for (const ph of db.project_photos) {
        if (input.photo_ids.includes(ph.id)) {
          ph.work_update_id = newUpdate.id;
        }
      }
      if (isSupabaseConfigured && supabase) {
        const { error: photoLinkErr } = await supabase
          .from('project_photos')
          .update({ work_update_id: newUpdate.id })
          .in('id', input.photo_ids);
        if (photoLinkErr) {
          throw new Error(`Database error linking photos to update: ${photoLinkErr.message}`);
        }
      }
    }

    newUpdate.photos = db.project_photos.filter((p) => p.work_update_id === newUpdate.id);
    db.project_work_updates.unshift(newUpdate);

    // Synchronize project's progress percentage & work stage with the chronological latest update
    const allProjectUpdates = db.project_work_updates
      .filter((u) => u.project_id === input.project_id)
      .sort((a, b) => {
        const d = (b.update_date || '').localeCompare(a.update_date || '');
        return d !== 0 ? d : (b.created_at || '').localeCompare(a.created_at || '');
      });
    const latestUpdate = allProjectUpdates[0] || newUpdate;
    const syncedProgress = Math.min(
      100,
      Math.max(0, Math.round(Number(latestUpdate.progress_percentage) || 0))
    );
    const syncedStage = latestUpdate.work_stage;

    const projIdx = db.projects.findIndex((p) => p.id === input.project_id);
    if (projIdx !== -1) {
      db.projects[projIdx] = {
        ...db.projects[projIdx],
        progress_percentage: syncedProgress,
        current_work_stage: syncedStage,
        updated_at: now,
      };
    }

    if (isSupabaseConfigured && supabase) {
      const { error: projErr } = await supabase
        .from('projects')
        .update({
          progress_percentage: syncedProgress,
          current_work_stage: syncedStage,
        })
        .eq('id', input.project_id);
      if (projErr) {
        throw new Error(`Database error syncing project progress: ${projErr.message}`);
      }
    }

    appendActivityLog(
      db,
      'work_update',
      'Work Update Recorded',
      `Recorded progress update: ${input.work_stage} (${cleanProgress}%)`,
      input.project_id
    );
    writeLocalDB(db);
    return newUpdate;
  },

  async updateWorkUpdate(
    id: string,
    updates: Partial<ProjectWorkUpdate>
  ): Promise<ProjectWorkUpdate> {
    const db = readLocalDB();
    if (!db.project_work_updates) db.project_work_updates = [];
    const idx = db.project_work_updates.findIndex((u) => u.id === id);
    if (idx === -1) throw new Error('Work update not found.');

    const now = new Date().toISOString();
    const cleanProgress =
      updates.progress_percentage !== undefined
        ? Math.min(100, Math.max(0, Math.round(Number(updates.progress_percentage) || 0)))
        : db.project_work_updates[idx].progress_percentage;

    const updated: ProjectWorkUpdate = {
      ...db.project_work_updates[idx],
      ...updates,
      progress_percentage: cleanProgress,
      id,
      updated_at: now,
    };

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('project_work_updates')
        .update({
          update_date: updated.update_date,
          work_stage: updated.work_stage,
          work_completed: updated.work_completed,
          progress_percentage: updated.progress_percentage,
          work_remaining: updated.work_remaining || null,
          client_note: updated.client_note || null,
          internal_note: updated.internal_note || null,
          is_visible_to_client: updated.is_visible_to_client,
        })
        .eq('id', id);
      if (error) throw new Error(`Database error updating work update: ${error.message}`);
    }

    db.project_work_updates[idx] = updated;

    // Synchronize project progress with the latest update for this project
    const allProjectUpdates = db.project_work_updates
      .filter((u) => u.project_id === updated.project_id)
      .sort((a, b) => {
        const d = (b.update_date || '').localeCompare(a.update_date || '');
        return d !== 0 ? d : (b.created_at || '').localeCompare(a.created_at || '');
      });
    const latestUpdate = allProjectUpdates[0];
    if (latestUpdate) {
      const syncedProgress = Math.min(
        100,
        Math.max(0, Math.round(Number(latestUpdate.progress_percentage) || 0))
      );
      const syncedStage = latestUpdate.work_stage;
      const projIdx = db.projects.findIndex((p) => p.id === updated.project_id);
      if (projIdx !== -1) {
        db.projects[projIdx] = {
          ...db.projects[projIdx],
          progress_percentage: syncedProgress,
          current_work_stage: syncedStage,
          updated_at: now,
        };
      }
      if (isSupabaseConfigured && supabase) {
        await supabase
          .from('projects')
          .update({
            progress_percentage: syncedProgress,
            current_work_stage: syncedStage,
          })
          .eq('id', updated.project_id);
      }
    }

    updated.photos = (db.project_photos || []).filter((p) => p.work_update_id === id);
    writeLocalDB(db);
    return updated;
  },

  async deleteWorkUpdate(id: string): Promise<void> {
    const db = readLocalDB();
    if (!db.project_work_updates) db.project_work_updates = [];
    const targetUpdate = db.project_work_updates.find((u) => u.id === id);
    const projectId = targetUpdate?.project_id;

    db.project_work_updates = db.project_work_updates.filter((u) => u.id !== id);
    if (db.project_photos) {
      for (const ph of db.project_photos) {
        if (ph.work_update_id === id) ph.work_update_id = null;
      }
    }

    if (isSupabaseConfigured && supabase) {
      await supabase.from('project_photos').update({ work_update_id: null }).eq('work_update_id', id);
      const { error } = await supabase.from('project_work_updates').delete().eq('id', id);
      if (error) throw new Error(`Database error deleting work update: ${error.message}`);
    }

    if (projectId) {
      const remainingUpdates = db.project_work_updates
        .filter((u) => u.project_id === projectId)
        .sort((a, b) => {
          const d = (b.update_date || '').localeCompare(a.update_date || '');
          return d !== 0 ? d : (b.created_at || '').localeCompare(a.created_at || '');
        });
      const latestUpdate = remainingUpdates[0];
      if (latestUpdate) {
        const syncedProgress = Math.min(
          100,
          Math.max(0, Math.round(Number(latestUpdate.progress_percentage) || 0))
        );
        const syncedStage = latestUpdate.work_stage;
        const projIdx = db.projects.findIndex((p) => p.id === projectId);
        if (projIdx !== -1) {
          db.projects[projIdx] = {
            ...db.projects[projIdx],
            progress_percentage: syncedProgress,
            current_work_stage: syncedStage,
            updated_at: new Date().toISOString(),
          };
        }
        if (isSupabaseConfigured && supabase) {
          await supabase
            .from('projects')
            .update({
              progress_percentage: syncedProgress,
              current_work_stage: syncedStage,
            })
            .eq('id', projectId);
        }
      }
    }

    writeLocalDB(db);
  },

  // --------------------------------------------------------------------------
  // PROJECT PHOTOGRAPHS
  // --------------------------------------------------------------------------
  async uploadProjectPhoto(
    projectId: string,
    file: File,
    options?: {
      caption?: string;
      workUpdateId?: string;
      isVisibleToClient?: boolean;
    }
  ): Promise<ProjectPhoto> {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Only JPG, PNG, and WebP images are supported.');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('Image size must be under 10MB.');
    }

    const photoId = generateUUID();
    const now = new Date().toISOString();
    let photoUrl = '';
    let storagePath = '';

    // ─── Cloudinary Upload (Primary — 25GB free storage) ────────────────────
    if (isCloudinaryConfigured) {
      const folder = `akd-crm/projects/${projectId}`;
      const result = await uploadToCloudinary(file, folder);
      photoUrl = result.secure_url;
      storagePath = result.public_id; // store public_id so we can reference it later
    }
    // ─── Supabase Storage Fallback ───────────────────────────────────────────
    else if (isSupabaseConfigured && supabase) {
      const fileExt = file.name.split('.').pop() || 'jpg';
      storagePath = `projects/${projectId}/${photoId}.${fileExt}`;
      const { error: uploadErr } = await supabase.storage
        .from('project-photos')
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadErr) {
        throw new Error(`Storage upload failed: ${uploadErr.message}`);
      }

      const { data: urlData } = supabase.storage
        .from('project-photos')
        .getPublicUrl(storagePath);
      photoUrl = urlData.publicUrl;
    }
    // ─── Local Base64 Fallback (offline / dev mode) ──────────────────────────
    else {
      photoUrl = await compressImageFile(file, 1280, 0.82);
    }

    const newPhoto: ProjectPhoto = {
      id: photoId,
      project_id: projectId,
      work_update_id: options?.workUpdateId || null,
      photo_url: photoUrl,
      storage_path: storagePath || undefined,
      caption: options?.caption?.trim() || '',
      file_size: file.size,
      file_type: file.type,
      is_visible_to_client: options?.isVisibleToClient !== false,
      upload_date: now,
      created_at: now,
    };

    if (isSupabaseConfigured && supabase) {
      const { error: insertErr } = await supabase.from('project_photos').insert({
        id: newPhoto.id,
        project_id: newPhoto.project_id,
        work_update_id: newPhoto.work_update_id,
        photo_url: newPhoto.photo_url,
        storage_path: newPhoto.storage_path,
        caption: newPhoto.caption,
        file_size: newPhoto.file_size,
        file_type: newPhoto.file_type,
        is_visible_to_client: newPhoto.is_visible_to_client,
        upload_date: newPhoto.upload_date,
      });
      if (insertErr) throw new Error(`Database error saving photo record: ${insertErr.message}`);
    }

    const db = readLocalDB();
    if (!db.project_photos) db.project_photos = [];
    db.project_photos.unshift(newPhoto);
    writeLocalDB(db);
    return newPhoto;
  },

  async updateProjectPhoto(
    photoId: string,
    updates: Partial<ProjectPhoto>
  ): Promise<ProjectPhoto> {
    const db = readLocalDB();
    if (!db.project_photos) db.project_photos = [];
    const idx = db.project_photos.findIndex((p) => p.id === photoId);
    if (idx === -1) throw new Error('Photo not found.');

    const updated: ProjectPhoto = {
      ...db.project_photos[idx],
      ...updates,
      id: photoId,
    };

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('project_photos')
        .update({
          caption: updated.caption,
          is_visible_to_client: updated.is_visible_to_client,
          work_update_id: updated.work_update_id,
        })
        .eq('id', photoId);
      if (error) throw new Error(`Database error updating photo: ${error.message}`);
    }

    db.project_photos[idx] = updated;
    writeLocalDB(db);
    return updated;
  },

  async deleteProjectPhoto(photoId: string): Promise<void> {
    const db = readLocalDB();
    if (!db.project_photos) db.project_photos = [];
    const photo = db.project_photos.find((p) => p.id === photoId);
    if (!photo) return;

    if (isSupabaseConfigured && supabase) {
      if (photo.storage_path) {
        await supabase.storage.from('project-photos').remove([photo.storage_path]);
      }
      const { error } = await supabase.from('project_photos').delete().eq('id', photoId);
      if (error) throw new Error(`Database error deleting photo: ${error.message}`);
    }

    db.project_photos = db.project_photos.filter((p) => p.id !== photoId);
    writeLocalDB(db);
  },

  // --------------------------------------------------------------------------
  // PRIVATE CLIENT PROJECT SHARING & PUBLIC ACCESS
  // --------------------------------------------------------------------------
  async generateProjectSharingToken(
    projectId: string
  ): Promise<{ project: Project; sharingToken: string }> {
    const token = generateSecureSharingToken();
    const updated = await this.updateProject(projectId, {
      sharing_token: token,
      is_sharing_enabled: true,
      sharing_token_created_at: new Date().toISOString(),
    });
    return { project: updated, sharingToken: token };
  },

  async toggleProjectSharing(projectId: string, enabled: boolean): Promise<Project> {
    return this.updateProject(projectId, {
      is_sharing_enabled: enabled,
    });
  },

  async revokeAndRegenerateProjectSharingToken(
    projectId: string
  ): Promise<{ project: Project; sharingToken: string }> {
    const newToken = generateSecureSharingToken();
    const updated = await this.updateProject(projectId, {
      sharing_token: newToken,
      is_sharing_enabled: true,
      sharing_token_created_at: new Date().toISOString(),
    });
    return { project: updated, sharingToken: newToken };
  },

  async getPublicProjectTracking(token: string): Promise<PublicClientTrackingData | null> {
    const cleanToken = token?.trim() || '';
    if (!cleanToken || cleanToken.length < 12) return null;

    const db = readLocalDB();
    const safeLocalStudio = {
      business_name: db.settings.business_name,
      logo_url: db.settings.logo_url,
      phone: db.settings.phone,
      email: db.settings.email,
      address: db.settings.address,
      website: db.settings.website,
      date_format: db.settings.date_format,
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.rpc('get_public_project_tracking', {
          p_token: cleanToken,
        });
        if (!error && data) {
          const result = data as PublicClientTrackingData;
          return {
            ...result,
            studio:
              result.studio && result.studio.business_name
                ? result.studio
                : safeLocalStudio,
          };
        }
      } catch {
        // Fallback to local DB check
      }
    }

    // Local Vault implementation (strictly filters private info!)
    const project = (db.projects || []).find(
      (p) => p.sharing_token === cleanToken && p.is_sharing_enabled && !p.is_archived
    );
    if (!project) return null;

    const client = (db.clients || []).find((c) => c.id === project.client_id && !c.is_archived);
    if (!client) return null;

    const projectUpdates = (db.project_work_updates || [])
      .filter((u) => u.project_id === project.id && u.is_visible_to_client)
      .sort((a, b) => {
        const dateCmp = (b.update_date || '').localeCompare(a.update_date || '');
        if (dateCmp !== 0) return dateCmp;
        return (b.created_at || '').localeCompare(a.created_at || '');
      });

    const photosList = db.project_photos || [];

    const formattedUpdates = projectUpdates.map((u) => ({
      id: u.id,
      update_date: u.update_date,
      work_stage: u.work_stage,
      work_completed: u.work_completed,
      progress_percentage: u.progress_percentage,
      work_remaining: u.work_remaining || undefined,
      client_note: u.client_note || undefined,
      photos: photosList
        .filter((ph) => ph.work_update_id === u.id && ph.is_visible_to_client)
        .map((ph) => ({
          id: ph.id,
          photo_url: ph.photo_url,
          caption: ph.caption || undefined,
          upload_date: ph.upload_date,
        })),
    }));

    const standalonePhotos = photosList
      .filter((ph) => ph.project_id === project.id && !ph.work_update_id && ph.is_visible_to_client)
      .map((ph) => ({
        id: ph.id,
        photo_url: ph.photo_url,
        caption: ph.caption || undefined,
        upload_date: ph.upload_date,
      }));

    return {
      project_name: project.project_name,
      property_location: project.property_location,
      site_address: project.site_address,
      category: project.category,
      status: project.status,
      current_work_stage:
        projectUpdates[0]?.work_stage ||
        (project.current_work_stage as string) ||
        project.status,
      progress_percentage: project.progress_percentage,
      estimated_start_date: project.estimated_start_date,
      expected_completion_date: project.expected_completion_date,
      client_name: client.full_name,
      studio: safeLocalStudio,
      updates: formattedUpdates,
      standalone_photos: standalonePhotos,
    };
  },
};
