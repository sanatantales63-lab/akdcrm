import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  ActivityLog,
  ACTIVE_PROJECT_STATUSES,
  BusinessSettings,
  Client,
  ClientFinancialSummary,
  Enquiry,
  Expense,
  Payment,
  Project,
  ProjectFinancialSummary,
  Quotation,
  QuotationItem,
  TeamMember,
  ProjectTeamAssignment,
  TeamAttendance,
  Material,
  MaterialTransaction,
  PurchaseBill,
  ProjectWorkUpdate,
  ProjectPhoto,
} from '@/types/crm';
import { crmRepository } from '@/services/database';
import {
  normalizeEmail,
  normalizePhone,
  safePercentage,
  safeSubtract,
  safeSum,
  todayISO,
} from '@/lib/formatters';
import { useAuth } from '@/context/AuthContext';
import { format, subDays, addDays } from 'date-fns';

export type QuickModalType = 'client' | 'enquiry' | 'project' | 'payment' | 'expense' | null;

export interface QuickModalPayload {
  type: QuickModalType;
  clientId?: string;
  projectId?: string;
  editClient?: Client;
  editEnquiry?: Enquiry;
  editProject?: Project;
  editPayment?: Payment;
  editExpense?: Expense;
}

interface CRMContextValue {
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
  teamAttendance: TeamAttendance[];
  materials: Material[];
  materialTransactions: MaterialTransaction[];
  purchaseBills: PurchaseBill[];
  workUpdates: ProjectWorkUpdate[];
  projectPhotos: ProjectPhoto[];
  isLoading: boolean;

  // Derived Financial Maps & Summaries
  projectFinancials: ProjectFinancialSummary[];
  projectFinancialMap: Map<string, ProjectFinancialSummary>;
  clientFinancials: ClientFinancialSummary[];
  clientFinancialMap: Map<string, ClientFinancialSummary>;

  // Duplicate Detection
  findDuplicateClients: (phone?: string, email?: string, excludeClientId?: string) => Client[];
  findMatchingClientForEnquiry: (enquiry: Enquiry) => Client | undefined;

  // Quick Action Modals
  quickModal: QuickModalPayload;
  openQuickModal: (payload: QuickModalPayload) => void;
  closeQuickModal: () => void;

  // Data Mutations
  refreshData: () => Promise<void>;
  createClient: (
    data: Omit<
      Client,
      'id' | 'client_code' | 'client_notes_log' | 'is_archived' | 'created_at' | 'updated_at'
    >
  ) => Promise<Client>;
  updateClient: (id: string, updates: Partial<Client>) => Promise<Client>;
  addClientNote: (clientId: string, content: string) => Promise<Client>;
  archiveClient: (id: string) => Promise<void>;

  createEnquiry: (
    data: Omit<
      Enquiry,
      | 'id'
      | 'enquiry_code'
      | 'follow_up_history'
      | 'is_archived'
      | 'created_at'
      | 'updated_at'
    >
  ) => Promise<Enquiry>;
  updateEnquiry: (id: string, updates: Partial<Enquiry>) => Promise<Enquiry>;
  addEnquiryFollowUpNote: (
    enquiryId: string,
    noteContent: string,
    nextFollowUpDate?: string
  ) => Promise<Enquiry>;
  convertEnquiry: (
    params: Parameters<typeof crmRepository.convertEnquiry>[0]
  ) => Promise<{ client: Client; project?: Project; enquiry: Enquiry }>;
  archiveEnquiry: (id: string) => Promise<void>;

  createProject: (
    data: Omit<Project, 'id' | 'project_code' | 'is_archived' | 'created_at' | 'updated_at'>
  ) => Promise<Project>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<Project>;
  archiveProject: (id: string) => Promise<void>;

  createPayment: (
    data: Omit<
      Payment,
      | 'id'
      | 'payment_code'
      | 'receipt_number'
      | 'is_archived'
      | 'created_at'
      | 'updated_at'
    >
  ) => Promise<Payment>;
  updatePayment: (id: string, updates: Partial<Payment>) => Promise<Payment>;
  archivePayment: (id: string) => Promise<void>;

  createExpense: (
    data: Omit<Expense, 'id' | 'expense_code' | 'is_archived' | 'created_at' | 'updated_at'>
  ) => Promise<Expense>;
  updateExpense: (id: string, updates: Partial<Expense>) => Promise<Expense>;
  archiveExpense: (id: string) => Promise<void>;

  createQuotation: (
    input: Parameters<typeof crmRepository.createQuotation>[0]
  ) => Promise<Quotation>;
  updateQuotation: (
    id: string,
    updates: Partial<Quotation>,
    newItems?: Array<Omit<QuotationItem, 'id' | 'quotation_id'>>
  ) => Promise<Quotation>;
  createQuotationRevision: (originalQuotationId: string) => Promise<Quotation>;
  archiveQuotation: (id: string) => Promise<void>;
  createProjectFromQuotation: (
    quotationId: string,
    projectData?: Parameters<typeof crmRepository.createProjectFromQuotation>[1]
  ) => Promise<Project>;

  createTeamMember: (
    input: Parameters<typeof crmRepository.createTeamMember>[0]
  ) => Promise<TeamMember>;
  updateTeamMember: (
    id: string,
    updates: Partial<TeamMember>
  ) => Promise<TeamMember>;
  deleteTeamMember: (id: string) => Promise<void>;
  assignTeamMember: (
    projectId: string,
    teamMemberId: string,
    roleOnProject?: string,
    notes?: string
  ) => Promise<ProjectTeamAssignment>;
  updateTeamAssignment: (
    assignmentId: string,
    updates: { role_on_project?: string; notes?: string; assigned_date?: string }
  ) => Promise<ProjectTeamAssignment>;
  removeTeamAssignment: (assignmentId: string) => Promise<void>;

  createAttendance: (
    input: Parameters<typeof crmRepository.createAttendance>[0]
  ) => Promise<TeamAttendance>;
  updateAttendance: (
    id: string,
    updates: Parameters<typeof crmRepository.updateAttendance>[1]
  ) => Promise<TeamAttendance>;
  deleteAttendance: (id: string) => Promise<void>;

  createMaterial: (
    input: Parameters<typeof crmRepository.createMaterial>[0]
  ) => Promise<Material>;
  updateMaterial: (
    id: string,
    updates: Partial<Material>
  ) => Promise<Material>;
  archiveMaterial: (id: string) => Promise<void>;
  recordMaterialTransaction: (
    input: Parameters<typeof crmRepository.recordMaterialTransaction>[0]
  ) => Promise<{ transaction: MaterialTransaction; material: Material }>;
  deleteMaterialTransaction: (id: string) => Promise<void>;

  createPurchaseBill: (
    input: Parameters<typeof crmRepository.createPurchaseBill>[0]
  ) => Promise<PurchaseBill>;
  archivePurchaseBill: (id: string) => Promise<void>;

  createWorkUpdate: (
    input: Parameters<typeof crmRepository.createWorkUpdate>[0]
  ) => Promise<ProjectWorkUpdate>;
  updateWorkUpdate: (
    id: string,
    updates: Partial<ProjectWorkUpdate>
  ) => Promise<ProjectWorkUpdate>;
  deleteWorkUpdate: (id: string) => Promise<void>;

  uploadProjectPhoto: (
    projectId: string,
    file: File,
    options?: Parameters<typeof crmRepository.uploadProjectPhoto>[2]
  ) => Promise<ProjectPhoto>;
  updateProjectPhoto: (
    photoId: string,
    updates: Partial<ProjectPhoto>
  ) => Promise<ProjectPhoto>;
  deleteProjectPhoto: (photoId: string) => Promise<void>;

  generateProjectSharingToken: (
    projectId: string
  ) => Promise<{ project: Project; sharingToken: string }>;
  toggleProjectSharing: (
    projectId: string,
    enabled: boolean
  ) => Promise<Project>;
  revokeAndRegenerateProjectSharingToken: (
    projectId: string
  ) => Promise<{ project: Project; sharingToken: string }>;

  updateSettings: (updates: Partial<BusinessSettings>) => Promise<BusinessSettings>;
  clearAllBusinessData: () => Promise<void>;
  seedFictionalSampleData: () => Promise<void>;
}

const CRMContext = createContext<CRMContextValue | null>(null);

export const CRMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<BusinessSettings>({
    id: '00000000-0000-4000-8000-000000000001',
    business_name: 'ALL KIND DECOR INTERIOR',
    authorized_signatory: 'Sk Subrati Amin',
    logo_url: '/logo.png',
    signature_url: '',
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
    currency: 'INR',
    date_format: 'dd MMM yyyy',
    financial_year_start_month: 4,
    project_categories: [
      'Residential Interior',
      'Commercial Interior',
      'Office Interior',
      'Modular Kitchen',
      'Renovation',
      'Turnkey Project',
      'Other',
    ],
    expense_categories: [
      'Materials',
      'Labour',
      'Contractor',
      'Transportation',
      'Site Expenses',
      'Design and Software',
      'Office Expenses',
      'Marketing',
      'Other',
    ],
    lead_sources: [
      'Website (akdinterior.in)',
      'Client Referral',
      'Google Search / Maps',
      'Instagram / Social',
      'Walk-in Studio',
      'Architect Partner',
      'Direct Call / WhatsApp',
      'Other',
    ],
    updated_at: new Date().toISOString(),
  });

  const [clients, setClients] = useState<Client[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamAssignments, setTeamAssignments] = useState<ProjectTeamAssignment[]>([]);
  const [teamAttendance, setTeamAttendance] = useState<TeamAttendance[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialTransactions, setMaterialTransactions] = useState<MaterialTransaction[]>([]);
  const [purchaseBills, setPurchaseBills] = useState<PurchaseBill[]>([]);
  const [workUpdates, setWorkUpdates] = useState<ProjectWorkUpdate[]>([]);
  const [projectPhotos, setProjectPhotos] = useState<ProjectPhoto[]>([]);
  const [quickModal, setQuickModal] = useState<QuickModalPayload>({ type: null });

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const snapshot = await crmRepository.fetchAll();
      setSettings(snapshot.settings);
      setClients(snapshot.clients);
      setEnquiries(snapshot.enquiries);
      setProjects(snapshot.projects);
      setPayments(snapshot.payments);
      setExpenses(snapshot.expenses);
      setActivityLogs(snapshot.activityLogs);
      setQuotations(snapshot.quotations || []);
      setTeamMembers(snapshot.teamMembers || []);
      setTeamAssignments(snapshot.teamAssignments || []);
      setTeamAttendance(snapshot.teamAttendance || []);
      setMaterials(snapshot.materials || []);
      setMaterialTransactions(snapshot.materialTransactions || []);
      setPurchaseBills(snapshot.purchaseBills || []);
      setWorkUpdates(snapshot.workUpdates || []);
      setProjectPhotos(snapshot.projectPhotos || []);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData, session?.user.id]);

  // --------------------------------------------------------------------------
  // DERIVED PROJECT FINANCIAL SUMMARIES (DECIMAL-SAFE)
  // Total Project Value - Confirmed Payments Received = Outstanding Project Balance
  // Recorded Expenses are tracked per project but NEVER subtracted from client balance
  // --------------------------------------------------------------------------
  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const projectFinancials = useMemo<ProjectFinancialSummary[]>(() => {
    return projects.map((project) => {
      const projPayments = payments.filter(
        (pay) => pay.project_id === project.id && !pay.is_archived
      );
      const projExpenses = expenses.filter(
        (exp) => exp.project_id === project.id && !exp.is_archived
      );

      const isCancelled = project.status === 'Cancelled';
      const totalValue = isCancelled ? 0 : project.total_value;
      const paymentsReceived = safeSum(projPayments.map((p) => p.amount));
      const outstandingBalance = isCancelled
        ? 0
        : Math.max(0, safeSubtract(totalValue, paymentsReceived));
      const recordedExpenses = safeSum(projExpenses.map((e) => e.amount));
      const collectionPercentage = safePercentage(paymentsReceived, totalValue);

      return {
        project,
        client: clientMap.get(project.client_id),
        totalValue,
        paymentsReceived,
        outstandingBalance,
        recordedExpenses,
        paymentCount: projPayments.length,
        expenseCount: projExpenses.length,
        collectionPercentage,
      };
    });
  }, [projects, payments, expenses, clientMap]);

  const projectFinancialMap = useMemo(
    () => new Map(projectFinancials.map((pf) => [pf.project.id, pf])),
    [projectFinancials]
  );

  // --------------------------------------------------------------------------
  // DERIVED CLIENT FINANCIAL SUMMARIES (NO DUPLICATE COUNTING)
  // --------------------------------------------------------------------------
  const clientFinancials = useMemo<ClientFinancialSummary[]>(() => {
    return clients.map((client) => {
      const clientProjects = projectFinancials.filter(
        (pf) => pf.project.client_id === client.id
      );
      const activeProjectCount = clientProjects.filter((pf) =>
        ACTIVE_PROJECT_STATUSES.includes(pf.project.status)
      ).length;

      const totalProjectValue = safeSum(clientProjects.map((pf) => pf.totalValue));
      const totalPaymentsReceived = safeSum(clientProjects.map((pf) => pf.paymentsReceived));
      const outstandingBalance = safeSum(clientProjects.map((pf) => pf.outstandingBalance));

      return {
        client,
        projectCount: clientProjects.length,
        activeProjectCount,
        totalProjectValue,
        totalPaymentsReceived,
        outstandingBalance,
      };
    });
  }, [clients, projectFinancials]);

  const clientFinancialMap = useMemo(
    () => new Map(clientFinancials.map((cf) => [cf.client.id, cf])),
    [clientFinancials]
  );

  // --------------------------------------------------------------------------
  // DUPLICATE DETECTION
  // --------------------------------------------------------------------------
  const findDuplicateClients = useCallback(
    (phone?: string, email?: string, excludeClientId?: string): Client[] => {
      const normPhone = normalizePhone(phone);
      const normEmail = normalizeEmail(email);
      if (!normPhone && !normEmail) return [];

      return clients.filter((c) => {
        if (excludeClientId && c.id === excludeClientId) return false;
        const cPhone = normalizePhone(c.phone);
        const cWhatsapp = normalizePhone(c.whatsapp);
        const cEmail = normalizeEmail(c.email);

        const phoneMatch =
          normPhone.length >= 8 && (cPhone === normPhone || cWhatsapp === normPhone);
        const emailMatch = normEmail.length >= 4 && cEmail === normEmail;
        return phoneMatch || emailMatch;
      });
    },
    [clients]
  );

  const findMatchingClientForEnquiry = useCallback(
    (enquiry: Enquiry): Client | undefined => {
      if (enquiry.converted_client_id) {
        const direct = clientMap.get(enquiry.converted_client_id);
        if (direct) return direct;
      }
      const matches = findDuplicateClients(enquiry.phone, enquiry.email);
      return matches[0];
    },
    [clientMap, findDuplicateClients]
  );

  // --------------------------------------------------------------------------
  // MODAL CONTROLS
  // --------------------------------------------------------------------------
  const openQuickModal = useCallback((payload: QuickModalPayload) => {
    setQuickModal(payload);
  }, []);

  const closeQuickModal = useCallback(() => {
    setQuickModal({ type: null });
  }, []);

  // --------------------------------------------------------------------------
  // MUTATION WRAPPERS
  // --------------------------------------------------------------------------
  const createClient = useCallback(
    async (
      data: Omit<
        Client,
        'id' | 'client_code' | 'client_notes_log' | 'is_archived' | 'created_at' | 'updated_at'
      >
    ) => {
      const res = await crmRepository.createClient(data);
      await refreshData();
      return res;
    },
    [refreshData]
  );

  const updateClient = useCallback(
    async (id: string, updates: Partial<Client>) => {
      const res = await crmRepository.updateClient(id, updates);
      await refreshData();
      return res;
    },
    [refreshData]
  );

  const addClientNote = useCallback(
    async (clientId: string, content: string) => {
      const res = await crmRepository.addClientNote(clientId, content);
      await refreshData();
      return res;
    },
    [refreshData]
  );

  const archiveClient = useCallback(
    async (id: string) => {
      await crmRepository.archiveClient(id);
      await refreshData();
    },
    [refreshData]
  );

  const createEnquiry = useCallback(
    async (
      data: Omit<
        Enquiry,
        | 'id'
        | 'enquiry_code'
        | 'follow_up_history'
        | 'is_archived'
        | 'created_at'
        | 'updated_at'
      >
    ) => {
      const res = await crmRepository.createEnquiry(data);
      await refreshData();
      return res;
    },
    [refreshData]
  );

  const updateEnquiry = useCallback(
    async (id: string, updates: Partial<Enquiry>) => {
      const res = await crmRepository.updateEnquiry(id, updates);
      await refreshData();
      return res;
    },
    [refreshData]
  );

  const addEnquiryFollowUpNote = useCallback(
    async (enquiryId: string, noteContent: string, nextFollowUpDate?: string) => {
      const res = await crmRepository.addEnquiryFollowUpNote(
        enquiryId,
        noteContent,
        nextFollowUpDate
      );
      await refreshData();
      return res;
    },
    [refreshData]
  );

  const convertEnquiry = useCallback(
    async (params: Parameters<typeof crmRepository.convertEnquiry>[0]) => {
      const res = await crmRepository.convertEnquiry(params);
      await refreshData();
      return res;
    },
    [refreshData]
  );

  const archiveEnquiry = useCallback(
    async (id: string) => {
      await crmRepository.archiveEnquiry(id);
      await refreshData();
    },
    [refreshData]
  );

  const createProject = useCallback(
    async (
      data: Omit<Project, 'id' | 'project_code' | 'is_archived' | 'created_at' | 'updated_at'>
    ) => {
      const res = await crmRepository.createProject(data);
      await refreshData();
      return res;
    },
    [refreshData]
  );

  const updateProject = useCallback(
    async (id: string, updates: Partial<Project>) => {
      const res = await crmRepository.updateProject(id, updates);
      await refreshData();
      return res;
    },
    [refreshData]
  );

  const archiveProject = useCallback(
    async (id: string) => {
      await crmRepository.archiveProject(id);
      await refreshData();
    },
    [refreshData]
  );

  const createPayment = useCallback(
    async (
      data: Omit<
        Payment,
        | 'id'
        | 'payment_code'
        | 'receipt_number'
        | 'is_archived'
        | 'created_at'
        | 'updated_at'
      >
    ) => {
      const res = await crmRepository.createPayment(data);
      await refreshData();
      return res;
    },
    [refreshData]
  );

  const updatePayment = useCallback(
    async (id: string, updates: Partial<Payment>) => {
      const res = await crmRepository.updatePayment(id, updates);
      await refreshData();
      return res;
    },
    [refreshData]
  );

  const archivePayment = useCallback(
    async (id: string) => {
      await crmRepository.archivePayment(id);
      await refreshData();
    },
    [refreshData]
  );

  const createExpense = useCallback(
    async (
      data: Omit<Expense, 'id' | 'expense_code' | 'is_archived' | 'created_at' | 'updated_at'>
    ) => {
      const res = await crmRepository.createExpense(data);
      await refreshData();
      return res;
    },
    [refreshData]
  );

  const updateExpense = useCallback(
    async (id: string, updates: Partial<Expense>) => {
      const res = await crmRepository.updateExpense(id, updates);
      await refreshData();
      return res;
    },
    [refreshData]
  );

  const archiveExpense = useCallback(
    async (id: string) => {
      await crmRepository.archiveExpense(id);
      await refreshData();
    },
    [refreshData]
  );

  // --------------------------------------------------------------------------
  // QUOTATIONS & BOQ
  // --------------------------------------------------------------------------
  const createQuotation = useCallback(
    async (input: Parameters<typeof crmRepository.createQuotation>[0]) => {
      const res = await crmRepository.createQuotation(input);
      await refreshData();
      return res;
    },
    [refreshData]
  );

  const updateQuotation = useCallback(
    async (
      id: string,
      updates: Partial<Quotation>,
      newItems?: Array<Omit<QuotationItem, 'id' | 'quotation_id'>>
    ) => {
      const res = await crmRepository.updateQuotation(id, updates, newItems);
      await refreshData();
      return res;
    },
    [refreshData]
  );

  const createQuotationRevision = useCallback(
    async (originalQuotationId: string) => {
      const res = await crmRepository.createQuotationRevision(originalQuotationId);
      await refreshData();
      return res;
    },
    [refreshData]
  );

  const archiveQuotation = useCallback(
    async (id: string) => {
      await crmRepository.archiveQuotation(id);
      await refreshData();
    },
    [refreshData]
  );

  const createProjectFromQuotation = useCallback(
    async (
      quotationId: string,
      projectData?: Parameters<typeof crmRepository.createProjectFromQuotation>[1]
    ) => {
      const res = await crmRepository.createProjectFromQuotation(quotationId, projectData);
      await refreshData();
      return res;
    },
    [refreshData]
  );

  // --------------------------------------------------------------------------
  // TEAM MANAGEMENT & ASSIGNMENTS
  // --------------------------------------------------------------------------
  const createTeamMember = useCallback(
    async (input: Parameters<typeof crmRepository.createTeamMember>[0]) => {
      const res = await crmRepository.createTeamMember(input);
      await refreshData();
      return res;
    },
    [refreshData]
  );

  const updateTeamMember = useCallback(
    async (id: string, updates: Partial<TeamMember>) => {
      const res = await crmRepository.updateTeamMember(id, updates);
      await refreshData();
      return res;
    },
    [refreshData]
  );

  const deleteTeamMember = useCallback(
    async (id: string) => {
      await crmRepository.deleteTeamMember(id);
      await refreshData();
    },
    [refreshData]
  );

  const assignTeamMember = useCallback(
    async (
      projectId: string,
      teamMemberId: string,
      roleOnProject?: string,
      notes?: string
    ) => {
      const res = await crmRepository.assignTeamMember(
        projectId,
        teamMemberId,
        roleOnProject,
        notes
      );
      await refreshData();
      return res;
    },
    [refreshData]
  );

  const updateTeamAssignment = useCallback(
    async (
      assignmentId: string,
      updates: { role_on_project?: string; notes?: string; assigned_date?: string }
    ) => {
      const res = await crmRepository.updateTeamAssignment(assignmentId, updates);
      await refreshData();
      return res;
    },
    [refreshData]
  );

  const removeTeamAssignment = useCallback(
    async (assignmentId: string) => {
      await crmRepository.removeTeamAssignment(assignmentId);
      await refreshData();
    },
    [refreshData]
  );

  // --------------------------------------------------------------------------
  // TEAM ATTENDANCE
  // --------------------------------------------------------------------------
  const createAttendance = useCallback(
    async (input: Parameters<typeof crmRepository.createAttendance>[0]) => {
      const res = await crmRepository.createAttendance(input);
      await refreshData();
      return res;
    },
    [refreshData]
  );

  const updateAttendance = useCallback(
    async (id: string, updates: Parameters<typeof crmRepository.updateAttendance>[1]) => {
      const res = await crmRepository.updateAttendance(id, updates);
      await refreshData();
      return res;
    },
    [refreshData]
  );

  const deleteAttendance = useCallback(
    async (id: string) => {
      await crmRepository.deleteAttendance(id);
      await refreshData();
    },
    [refreshData]
  );

  // --------------------------------------------------------------------------
  // MATERIALS, STOCK & PURCHASE BILLS
  // --------------------------------------------------------------------------
  const createMaterial = useCallback(
    async (input: Parameters<typeof crmRepository.createMaterial>[0]) => {
      const res = await crmRepository.createMaterial(input);
      await refreshData();
      return res;
    },
    [refreshData]
  );

  const updateMaterial = useCallback(
    async (id: string, updates: Partial<Material>) => {
      const res = await crmRepository.updateMaterial(id, updates);
      await refreshData();
      return res;
    },
    [refreshData]
  );

  const archiveMaterial = useCallback(
    async (id: string) => {
      await crmRepository.archiveMaterial(id);
      await refreshData();
    },
    [refreshData]
  );

  const recordMaterialTransaction = useCallback(
    async (input: Parameters<typeof crmRepository.recordMaterialTransaction>[0]) => {
      const res = await crmRepository.recordMaterialTransaction(input);
      await refreshData();
      return res;
    },
    [refreshData]
  );

  const deleteMaterialTransaction = useCallback(
    async (id: string) => {
      await crmRepository.deleteMaterialTransaction(id);
      await refreshData();
    },
    [refreshData]
  );

  const createPurchaseBill = useCallback(
    async (input: Parameters<typeof crmRepository.createPurchaseBill>[0]) => {
      const res = await crmRepository.createPurchaseBill(input);
      await refreshData();
      return res;
    },
    [refreshData]
  );

  const archivePurchaseBill = useCallback(
    async (id: string) => {
      await crmRepository.archivePurchaseBill(id);
      await refreshData();
    },
    [refreshData]
  );

  // --------------------------------------------------------------------------
  // WORK UPDATES & TIMELINE
  // --------------------------------------------------------------------------
  const createWorkUpdate = useCallback(
    async (input: Parameters<typeof crmRepository.createWorkUpdate>[0]) => {
      const res = await crmRepository.createWorkUpdate(input);
      await refreshData();
      return res;
    },
    [refreshData]
  );

  const updateWorkUpdate = useCallback(
    async (id: string, updates: Partial<ProjectWorkUpdate>) => {
      const res = await crmRepository.updateWorkUpdate(id, updates);
      await refreshData();
      return res;
    },
    [refreshData]
  );

  const deleteWorkUpdate = useCallback(
    async (id: string) => {
      await crmRepository.deleteWorkUpdate(id);
      await refreshData();
    },
    [refreshData]
  );

  // --------------------------------------------------------------------------
  // PROJECT PHOTOS
  // --------------------------------------------------------------------------
  const uploadProjectPhoto = useCallback(
    async (
      projectId: string,
      file: File,
      options?: Parameters<typeof crmRepository.uploadProjectPhoto>[2]
    ) => {
      const res = await crmRepository.uploadProjectPhoto(projectId, file, options);
      await refreshData();
      return res;
    },
    [refreshData]
  );

  const updateProjectPhoto = useCallback(
    async (photoId: string, updates: Partial<ProjectPhoto>) => {
      const res = await crmRepository.updateProjectPhoto(photoId, updates);
      await refreshData();
      return res;
    },
    [refreshData]
  );

  const deleteProjectPhoto = useCallback(
    async (photoId: string) => {
      await crmRepository.deleteProjectPhoto(photoId);
      await refreshData();
    },
    [refreshData]
  );

  // --------------------------------------------------------------------------
  // PROJECT SHARING & CLIENT PORTAL
  // --------------------------------------------------------------------------
  const generateProjectSharingToken = useCallback(
    async (projectId: string) => {
      const res = await crmRepository.generateProjectSharingToken(projectId);
      await refreshData();
      return res;
    },
    [refreshData]
  );

  const toggleProjectSharing = useCallback(
    async (projectId: string, enabled: boolean) => {
      const res = await crmRepository.toggleProjectSharing(projectId, enabled);
      await refreshData();
      return res;
    },
    [refreshData]
  );

  const revokeAndRegenerateProjectSharingToken = useCallback(
    async (projectId: string) => {
      const res = await crmRepository.revokeAndRegenerateProjectSharingToken(projectId);
      await refreshData();
      return res;
    },
    [refreshData]
  );

  const updateSettings = useCallback(
    async (updates: Partial<BusinessSettings>) => {
      const res = await crmRepository.updateSettings(updates);
      await refreshData();
      return res;
    },
    [refreshData]
  );

  const clearAllBusinessData = useCallback(async () => {
    await crmRepository.clearAllBusinessData();
    await refreshData();
  }, [refreshData]);

  // --------------------------------------------------------------------------
  // EXPLICIT FICTIONAL DEVELOPMENT SEED HELPER
  // Never executed automatically. Only callable if owner chooses to load
  // fictional demo records for testing from Settings -> Data Management.
  // --------------------------------------------------------------------------
  const seedFictionalSampleData = useCallback(async () => {
    const now = new Date();
    const d = (offsetDays: number) =>
      format(
        offsetDays >= 0 ? addDays(now, offsetDays) : subDays(now, Math.abs(offsetDays)),
        'yyyy-MM-dd'
      );

    const c1 = await crmRepository.createClient({
      full_name: '[DEMO] Vikramaditya Sengupta',
      phone: '+91 98300 11001',
      whatsapp: '+91 98300 11001',
      email: 'vikram.demo@example.com',
      client_type: 'Residential',
      property_type: '3BHK Duplex Residence',
      property_location: 'Inda, Kharagpur',
      full_address: 'Flat 4B, Heritage Residency, OT Road, Inda, Kharagpur, WB 721305',
      project_budget: 1850000,
      lead_source: 'Website (akdinterior.in)',
      status: 'Active Client',
      date_added: d(-50),
      notes:
        'Fictional sample record: Full turnkey residential interior with walnut veneer panelling, PU modular kitchen, and warm architectural cove lighting.',
    });

    const c2 = await crmRepository.createClient({
      full_name: '[DEMO] Dr. Ananya Chatterjee',
      phone: '+91 98300 22002',
      whatsapp: '+91 98300 22002',
      email: 'ananya.demo@example.com',
      client_type: 'Commercial',
      property_type: 'Aesthetics & Dental Suite',
      property_location: 'Malancha Road, Kharagpur',
      full_address: '2nd Floor, Aurelia Plaza, Malancha Main Road, Kharagpur, WB 721301',
      project_budget: 1240000,
      lead_source: 'Client Referral',
      status: 'Active Client',
      date_added: d(-35),
      notes:
        'Fictional sample record: Acoustic glass partitions, sterile cabinetry, and travertine reception lounge.',
    });

    const c3 = await crmRepository.createClient({
      full_name: '[DEMO] Subhajit & Poulomi Mukherjee',
      phone: '+91 98300 33003',
      whatsapp: '+91 98300 33003',
      email: 'mukherjee.demo@example.com',
      client_type: 'Residential',
      property_type: 'Independent Villa Kitchen & Dining',
      property_location: 'Hijli Co-operative, Kharagpur',
      full_address: 'Plot 118, Hijli Co-operative Society, Prembazar, Kharagpur, WB 721306',
      project_budget: 680000,
      lead_source: 'Google Search / Maps',
      status: 'Completed',
      date_added: d(-85),
      notes: 'Fictional sample record: L-shaped acrylic modular kitchen with Hettich hardware.',
    });

    const p1 = await crmRepository.createProject({
      project_name: '[DEMO] Sengupta 3BHK Turnkey Residence',
      client_id: c1.id,
      category: 'Turnkey Project',
      property_location: 'Inda, Kharagpur',
      site_address: c1.full_address,
      description:
        'Complete turnkey execution including false ceiling, modular kitchen, 3 wardrobes, TV console, and Italian marble foyer.',
      total_value: 1850000,
      estimated_start_date: d(-42),
      expected_completion_date: d(9),
      status: 'In Progress',
      progress_percentage: 72,
      payment_terms: '30% Advance, 40% Carpentry Milestone, 20% Finishing, 10% Handover',
      internal_notes: 'Carpentry completed; veneer polishing and lighting fixture installation underway.',
    });

    const p2 = await crmRepository.createProject({
      project_name: '[DEMO] Aurelia Dental & Aesthetics Studio',
      client_id: c2.id,
      category: 'Commercial Interior',
      property_location: 'Malancha Road, Kharagpur',
      site_address: c2.full_address,
      description: 'Reception lounge, 3 consultation suites, acoustic glass partitions, and lighting.',
      total_value: 1240000,
      estimated_start_date: d(-28),
      expected_completion_date: d(24),
      status: 'Design',
      progress_percentage: 35,
      payment_terms: '25% Booking & 3D Design, 50% Execution Start, 25% Handover',
      internal_notes: '3D renders approved; site electrical layout in progress.',
    });

    const p3 = await crmRepository.createProject({
      project_name: '[DEMO] Hijli Villa Modular Kitchen & Crockery Unit',
      client_id: c3.id,
      category: 'Modular Kitchen',
      property_location: 'Hijli Co-operative, Kharagpur',
      site_address: c3.full_address,
      description: 'Parallel island modular kitchen with quartz countertop and tall pantry unit.',
      total_value: 680000,
      estimated_start_date: d(-75),
      expected_completion_date: d(-15),
      actual_completion_date: d(-16),
      status: 'Completed',
      progress_percentage: 100,
      payment_terms: '50% Advance, 40% Factory Dispatch, 10% Handover',
      internal_notes: 'Handed over ahead of schedule.',
    });

    // Payments
    await crmRepository.createPayment({
      client_id: c1.id,
      project_id: p1.id,
      amount: 555000,
      payment_date: d(-40),
      payment_method: 'Bank Transfer',
      payment_type: 'Advance',
      transaction_reference: 'NEFT-DEMO-884120',
      notes: '30% mobilization advance received.',
    });

    await crmRepository.createPayment({
      client_id: c1.id,
      project_id: p1.id,
      amount: 645000,
      payment_date: d(-12),
      payment_method: 'Bank Transfer',
      payment_type: 'Milestone Payment',
      transaction_reference: 'RTGS-DEMO-992314',
      notes: 'Carpentry & false ceiling milestone payment.',
    });

    await crmRepository.createPayment({
      client_id: c2.id,
      project_id: p2.id,
      amount: 310000,
      payment_date: d(-25),
      payment_method: 'Cheque',
      payment_type: 'Advance',
      transaction_reference: 'HDFC-CHQ-004192',
      notes: '25% design & booking advance.',
    });

    await crmRepository.createPayment({
      client_id: c3.id,
      project_id: p3.id,
      amount: 680000,
      payment_date: d(-16),
      payment_method: 'Bank Transfer',
      payment_type: 'Final Payment',
      transaction_reference: 'IMPS-DEMO-771209',
      notes: 'Full and final settlement upon kitchen handover.',
    });

    // Expenses
    await crmRepository.createExpense({
      title: '[DEMO] CenturyPly Club Prime BWP Marine Plywood & Laminates',
      category: 'Materials',
      project_id: p1.id,
      amount: 385000,
      expense_date: d(-34),
      vendor_name: 'Bengal Timber & Veneer House',
      payment_method: 'Bank Transfer',
      reference_number: 'INV-BTV-402',
      notes: 'Primary plywood and smoked walnut veneer lot for Sengupta residence.',
    });

    await crmRepository.createExpense({
      title: '[DEMO] Site Carpentry & False Ceiling Execution Team',
      category: 'Contractor',
      project_id: p1.id,
      amount: 210000,
      expense_date: d(-10),
      vendor_name: 'R.K. Interior Craftsmen',
      payment_method: 'UPI',
      reference_number: 'UPI-41289901',
      notes: 'Stage 1 & 2 carpentry payouts.',
    });

    await crmRepository.createExpense({
      title: '[DEMO] Hettich Innotech Tandem Boxes & Soft-Close Hinges',
      category: 'Materials',
      project_id: p3.id,
      amount: 245000,
      expense_date: d(-55),
      vendor_name: 'Kharagpur Architectural Hardware',
      payment_method: 'Bank Transfer',
      reference_number: 'KAH-2026-118',
      notes: 'Complete hardware package for Hijli Villa kitchen.',
    });

    // Enquiries
    await crmRepository.createEnquiry({
      name: '[DEMO] Rituparna Ghosh',
      phone: '+91 98300 44004',
      email: 'rituparna.demo@example.com',
      project_type: 'Residential Interior',
      property_location: 'Nimpura, Kharagpur',
      estimated_budget: 1450000,
      lead_source: 'Website (akdinterior.in)',
      enquiry_date: d(-6),
      follow_up_date: d(-1),
      status: 'Follow-up Required',
      notes: 'Fictional demo lead: Looking for 3BHK interior design and modular kitchen before festive season.',
    });

    await crmRepository.createEnquiry({
      name: '[DEMO] Arindam Roychowdhury',
      phone: '+91 98300 55005',
      email: 'arindam.demo@example.com',
      project_type: 'Office Interior',
      property_location: 'Golebazar, Kharagpur',
      estimated_budget: 950000,
      lead_source: 'Direct Call / WhatsApp',
      enquiry_date: d(-3),
      follow_up_date: d(2),
      status: 'Site Visit',
      notes: 'Fictional demo lead: Chartered accountant chamber and conference suite renovation.',
    });

    // ------------------------------------------------------------------------
    // SEED PREMIUM WORK TRACKING & CLIENT PORTAL DEMO DATA
    // ------------------------------------------------------------------------
    // Team Members
    const tm1 = await crmRepository.createTeamMember({
      full_name: 'Subhash Mistry',
      phone: '+91 98301 11222',
      role: 'Supervisor',
      skill: 'Turnkey Site Execution & Quality Inspection',
      notes: 'Lead site supervisor for residential and commercial fit-outs',
      is_active: true,
    });

    const tm2 = await crmRepository.createTeamMember({
      full_name: 'Bapi Karmakar',
      phone: '+91 98301 33444',
      role: 'Carpenter',
      skill: 'BWP Marine Plywood & Acrylic Finishes',
      notes: 'Specialist in modular kitchen and wardrobe fabrication',
      is_active: true,
    });

    const tm3 = await crmRepository.createTeamMember({
      full_name: 'Sourav Pal',
      phone: '+91 98301 55666',
      role: 'Painter',
      skill: 'Italian PU Polish & Textured Wall Finishes',
      notes: 'High-end duco and PU polish specialist',
      is_active: true,
    });

    // Project Team Assignments for p1
    await crmRepository.assignTeamMember(p1.id, tm1.id, 'Site Supervisor', 'Full-time site lead');
    await crmRepository.assignTeamMember(p1.id, tm2.id, 'Senior Cabinet Maker', 'Master carpentry team lead');
    await crmRepository.assignTeamMember(p1.id, tm3.id, 'Surface Finishing Lead', 'PU polish and wall textures');

    // Quotation with itemized BOQ for p1
    await crmRepository.createQuotation({
      client_id: c1.id,
      project_id: p1.id,
      quotation_date: d(-45),
      valid_until: d(-15),
      status: 'Accepted',
      scope_of_work: 'Comprehensive 3BHK interior execution including master bedroom wardrobes, modular kitchen, gypsum false ceiling with warm architectural cove lighting, and living room media console.',
      terms_and_conditions: '1. 30% advance on approval of 3D layout.\n2. 40% on delivery of plywood and carcass completion.\n3. 20% on completion of finishing and painting.\n4. 10% on final handover.',
      notes: 'Material specification: Century Ply Club Prime 710 BWP plywood, Merino laminates, and Blum soft-close hardware.',
      discount_percentage: 5,
      tax_rate: 18,
      items: [
        {
          item_name: 'Gypsum False Ceiling with Cove Lighting',
          description: 'Saint-Gobain Gyproc board framing with perimeter indirect warm LED cove and flush spotlight cutouts.',
          quantity: 1150,
          unit: 'Sq. ft.',
          rate: 145,
        },
        {
          item_name: 'Acrylic Finish Modular Kitchen',
          description: 'BWP marine plywood carcasses, 1.5mm high-gloss acrylic shutters, Blum tandem-box soft-close drawer runners.',
          quantity: 165,
          unit: 'Sq. ft.',
          rate: 2250,
        },
        {
          item_name: 'Master Bedroom Floor-to-Ceiling Sliding Wardrobe',
          description: '8ft height wardrobe with internal lighting, fluted glass highlights, and integrated dressing mirror.',
          quantity: 96,
          unit: 'Sq. ft.',
          rate: 1850,
        },
        {
          item_name: 'Living Room Fluted Panel TV Console & Ledge',
          description: 'Natural oak veneer wall panelling with matte PU coat and floating quartz-top console ledge.',
          quantity: 1,
          unit: 'Lump sum',
          rate: 98000,
        },
        {
          item_name: 'Italian PU Polish and Royale Paint Work',
          description: 'Asian Paints Royale Luxury Emulsion across all rooms and Italian PU clear coat on veneer elements.',
          quantity: 3400,
          unit: 'Sq. ft.',
          rate: 48,
        },
      ],
    });

    // Work Updates for p1 with client visibility
    await crmRepository.createWorkUpdate({
      project_id: p1.id,
      update_date: d(-25),
      work_stage: 'Material Preparation',
      work_completed: 'Received verified Grade-710 BWP plywood batch and acoustic insulation materials at site. Commenced precision carcass cutting and edge-banding in living room and kitchen areas.',
      progress_percentage: 35,
      work_remaining: 'Commence gypsum ceiling channel grid installation across all bedrooms and salon.',
      client_note: 'Dear Vikramaditya, your premium CenturyPly timber and Blum hardware shipment has arrived at the property in pristine condition. Site fabrication is on track.',
      internal_note: 'Site supervisor verified sheet counts against invoice #CH-2026-904.',
      is_visible_to_client: true,
    });

    await crmRepository.createWorkUpdate({
      project_id: p1.id,
      update_date: d(-8),
      work_stage: 'Work in Progress',
      work_completed: 'Completed structural carpentry for master wardrobe and modular kitchen carcasses. False ceiling drywall boarding and dual-cove lighting conduits inspected and completed.',
      progress_percentage: 72,
      work_remaining: 'Commence acrylic shutter mounting, PU veneer spray polishing, and switchboard plate installations.',
      client_note: 'The false ceiling and cabinetry carcasses are completed! We are now preparing for final surface polishing and installation of electrical fixtures.',
      internal_note: 'Painting team scheduled for primer application this Friday.',
      is_visible_to_client: true,
    });

    // Enable client sharing link for p1 so user can immediately test client portal
    await crmRepository.updateProject(p1.id, {
      sharing_token: 'akd-demo-sengupta-2026',
      is_sharing_enabled: true,
      sharing_token_created_at: new Date().toISOString(),
      current_work_stage: 'Work in Progress',
      progress_percentage: 72,
    });

    // Seed Sample Attendance Records
    await crmRepository.createAttendance({
      team_member_id: tm1.id,
      project_id: p1.id,
      attendance_date: todayISO(),
      status: 'Present',
      in_time: '09:00',
      out_time: '18:00',
      notes: 'Site supervision & quality inspection',
    });
    await crmRepository.createAttendance({
      team_member_id: tm2.id,
      project_id: p1.id,
      attendance_date: todayISO(),
      status: 'Present',
      in_time: '09:15',
      out_time: '18:30',
      notes: 'Master wardrobe shutter fitting',
    });
    await crmRepository.createAttendance({
      team_member_id: tm3.id,
      project_id: p1.id,
      attendance_date: todayISO(),
      status: 'Half Day',
      in_time: '09:30',
      out_time: '14:00',
      notes: 'PU base primer coat inspection',
    });

    // Seed Sample Materials Catalogue & Stock
    const mat1 = await crmRepository.createMaterial({
      item_name: 'CenturyPly Club Prime 19mm BWP Plywood (8x4)',
      category: 'Plywood & Boards',
      unit: 'Sheet',
      available_quantity: 28,
      purchase_rate: 3450,
      supplier: 'Bengal Timber & Veneer House',
      low_stock_level: 10,
      notes: 'IS:710 Marine Grade BWP Plywood for kitchen and wardrobes',
    });

    const mat2 = await crmRepository.createMaterial({
      item_name: 'Merino 1mm Matte Finish Laminate (8x4)',
      category: 'Laminates & Veneers',
      unit: 'Sheet',
      available_quantity: 16,
      purchase_rate: 1680,
      supplier: 'Bengal Timber & Veneer House',
      low_stock_level: 8,
      notes: 'Warm walnut and cashmere matte textures',
    });

    const mat3 = await crmRepository.createMaterial({
      item_name: 'Hettich Sensys Soft-Close Auto Hinge (Pair)',
      category: 'Hardware & Fittings',
      unit: 'Set',
      available_quantity: 6,
      purchase_rate: 420,
      supplier: 'Kharagpur Architectural Hardware',
      low_stock_level: 12,
      notes: 'nickel plated concealed soft-close hinge set',
    });

    await crmRepository.recordMaterialTransaction({
      material_id: mat1.id,
      project_id: p1.id,
      transaction_type: 'usage',
      quantity: 8,
      unit_rate: 3450,
      transaction_date: d(-5),
      notes: 'Issued for Sengupta 3BHK master wardrobe carcass fabrication',
    });

    await crmRepository.createPurchaseBill({
      invoice_reference: 'KAH-INV-2026-089',
      supplier_name: 'Kharagpur Architectural Hardware',
      supplier_phone: '+91 98302 88900',
      project_id: p1.id,
      bill_date: d(-3),
      payment_status: 'Paid',
      payment_method: 'UPI',
      tax_amount: 1512,
      record_as_expense: false,
      notes: 'Replenishment batch of soft-close hinges for wardrobe shutters',
      items: [
        {
          material_id: mat3.id,
          item_name: mat3.item_name,
          unit: mat3.unit,
          quantity: 20,
          rate: 420,
          update_stock: true,
        },
      ],
    });

    await refreshData();
  }, [refreshData]);

  return (
    <CRMContext.Provider
      value={{
        settings,
        clients,
        enquiries,
        projects,
        payments,
        expenses,
        activityLogs,
        quotations,
        teamMembers,
        teamAssignments,
        teamAttendance,
        materials,
        materialTransactions,
        purchaseBills,
        workUpdates,
        projectPhotos,
        isLoading,
        projectFinancials,
        projectFinancialMap,
        clientFinancials,
        clientFinancialMap,
        findDuplicateClients,
        findMatchingClientForEnquiry,
        quickModal,
        openQuickModal,
        closeQuickModal,
        refreshData,
        createClient,
        updateClient,
        addClientNote,
        archiveClient,
        createEnquiry,
        updateEnquiry,
        addEnquiryFollowUpNote,
        convertEnquiry,
        archiveEnquiry,
        createProject,
        updateProject,
        archiveProject,
        createPayment,
        updatePayment,
        archivePayment,
        createExpense,
        updateExpense,
        archiveExpense,
        createQuotation,
        updateQuotation,
        createQuotationRevision,
        archiveQuotation,
        createProjectFromQuotation,
        createTeamMember,
        updateTeamMember,
        deleteTeamMember,
        assignTeamMember,
        updateTeamAssignment,
        removeTeamAssignment,
        createAttendance,
        updateAttendance,
        deleteAttendance,
        createMaterial,
        updateMaterial,
        archiveMaterial,
        recordMaterialTransaction,
        deleteMaterialTransaction,
        createPurchaseBill,
        archivePurchaseBill,
        createWorkUpdate,
        updateWorkUpdate,
        deleteWorkUpdate,
        uploadProjectPhoto,
        updateProjectPhoto,
        deleteProjectPhoto,
        generateProjectSharingToken,
        toggleProjectSharing,
        revokeAndRegenerateProjectSharingToken,
        updateSettings,
        clearAllBusinessData,
        seedFictionalSampleData,
      }}
    >
      {children}
    </CRMContext.Provider>
  );
};

export function useCRM() {
  const ctx = useContext(CRMContext);
  if (!ctx) throw new Error('useCRM must be used within CRMProvider');
  return ctx;
}
