import React, { useMemo, useState, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Edit3,
  PlusCircle,
  Receipt,
  FileDown,
  MapPin,
  Calendar,
  Clock,
  User,
  Phone,
  FileText,
  Save,
  Share2,
  Users,
  Layers,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  ExternalLink,
  Eye,
  Lock,
  Sparkles,
  RefreshCw,
  FolderKanban,
  FileSpreadsheet,
} from 'lucide-react';
import { useCRM } from '@/context/CRMContext';
import { useToast } from '@/context/ToastContext';
import {
  Payment,
  PROJECT_STATUSES,
  ProjectStatus,
  ProjectWorkUpdate,
  TeamMember,
  ProjectTeamAssignment,
  Quotation,
  WorkStage,
  WORK_STAGES,
} from '@/types/crm';
import {
  formatDate,
  formatINR,
  getDeadlineInfo,
} from '@/lib/formatters';
import { Badge, getProjectStatusVariant } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  exportPaymentReceiptPDF,
  exportProjectDetailPDF,
  exportWorkUpdateReportPDF,
} from '@/lib/exporters';
import { ShareProjectModal } from '@/components/modals/ShareProjectModal';
import { WorkUpdateModal } from '@/components/modals/WorkUpdateModal';
import { PhotoLightboxModal } from '@/components/modals/PhotoLightboxModal';
import { QuotationModal } from '@/components/modals/QuotationModal';
import { QuotationPDFExportModal } from '@/components/modals/QuotationPDFExportModal';
import { TeamMemberModal } from '@/components/modals/TeamMemberModal';
import { AssignTeamMemberModal } from '@/components/modals/AssignTeamMemberModal';

type ProjectTab =
  | 'overview'
  | 'work_updates'
  | 'team'
  | 'quotation'
  | 'payments_expenses'
  | 'documents';

export const ProjectDetailPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const {
    settings,
    projectFinancialMap,
    payments,
    expenses,
    quotations,
    teamMembers,
    teamAssignments,
    workUpdates,
    projectPhotos,
    updateProject,
    openQuickModal,
    deleteWorkUpdate,
    removeTeamAssignment,
    createQuotationRevision,
    archiveQuotation,
    updateQuotation,
  } = useCRM();
  const { success, error: showError } = useToast();

  const summary = projectId ? projectFinancialMap.get(projectId) : undefined;
  const [searchParams] = useSearchParams();

  // Tab State
  const [activeTab, setActiveTab] = useState<ProjectTab>('overview');

  useEffect(() => {
    const tabParam = searchParams.get('tab') as ProjectTab | null;
    if (
      tabParam &&
      ['overview', 'work_updates', 'team', 'quotation', 'payments_expenses', 'documents'].includes(
        tabParam
      )
    ) {
      setActiveTab(tabParam);
    }
    const action = searchParams.get('action');
    if (action === 'new_update') {
      setEditingUpdate(undefined);
      setWorkUpdateModalOpen(true);
    } else if (action === 'share') {
      setShareModalOpen(true);
    } else if (action === 'new_quotation') {
      setEditingQuotation(undefined);
      setQuotationModalOpen(true);
    } else if (action === 'assign_team') {
      setAssignTeamModalOpen(true);
    }
  }, [searchParams]);

  // Draft Form States for Overview
  const [progressDraft, setProgressDraft] = useState<number>(0);
  const [notesDraft, setNotesDraft] = useState<string>('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Modals State
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [workUpdateModalOpen, setWorkUpdateModalOpen] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState<ProjectWorkUpdate | undefined>(undefined);
  const [assignTeamModalOpen, setAssignTeamModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<ProjectTeamAssignment | undefined>(
    undefined
  );
  const [teamMemberModalOpen, setTeamMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | undefined>(undefined);
  const [quotationModalOpen, setQuotationModalOpen] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | undefined>(undefined);
  const [pdfExportQuotation, setPdfExportQuotation] = useState<Quotation | null>(null);

  // Confirmation Dialogs
  const [deleteUpdateTarget, setDeleteUpdateTarget] = useState<string | null>(null);
  const [removeTeamTarget, setRemoveTeamTarget] = useState<{ id: string; name: string } | null>(null);
  const [archiveQuoteTarget, setArchiveQuoteTarget] = useState<string | null>(null);

  // Lightbox State
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<{
    url: string;
    caption?: string;
    date?: string;
    stage?: string;
  } | null>(null);

  useEffect(() => {
    if (summary) {
      setProgressDraft(summary.project.progress_percentage);
      setNotesDraft(summary.project.internal_notes || '');
    }
  }, [summary]);

  // Filter Project Specific Records
  const projectPayments = useMemo(() => {
    if (!projectId) return [];
    return payments.filter((p) => p.project_id === projectId);
  }, [projectId, payments]);

  const projectExpenses = useMemo(() => {
    if (!projectId) return [];
    return expenses.filter((e) => e.project_id === projectId);
  }, [projectId, expenses]);

  const projectWorkUpdates = useMemo(() => {
    if (!projectId) return [];
    return workUpdates
      .filter((u) => u.project_id === projectId)
      .sort((a, b) => b.update_date.localeCompare(a.update_date));
  }, [projectId, workUpdates]);

  const projectAssignedTeam = useMemo(() => {
    if (!projectId) return [];
    return teamAssignments.filter((a) => a.project_id === projectId);
  }, [projectId, teamAssignments]);

  const projectQuotations = useMemo(() => {
    if (!projectId) return [];
    return quotations
      .filter((q) => q.project_id === projectId || (summary && q.client_id === summary.client?.id && !q.project_id))
      .sort((a, b) => b.quotation_date.localeCompare(a.quotation_date));
  }, [projectId, quotations, summary]);

  if (!summary) {
    return (
      <div className="akd-card p-10 text-center space-y-3">
        <p className="text-base font-semibold text-slate-900">Project Record Not Found</p>
        <p className="text-xs text-slate-600">
          The requested interior project may have been archived or does not exist.
        </p>
        <Link to="/projects" className="akd-btn-secondary h-[34px] text-xs inline-flex">
          <ArrowLeft className="w-3.5 h-3.5" /> Return to Projects
        </Link>
      </div>
    );
  }

  const { project, client } = summary;
  const deadline = getDeadlineInfo(project.expected_completion_date, project.status);

  // Status & Progress handlers
  const handleStatusUpdate = async (newStatus: ProjectStatus) => {
    try {
      await updateProject(project.id, {
        status: newStatus,
        progress_percentage: newStatus === 'Completed' ? 100 : progressDraft,
      });
      success('Status Updated', `Project marked as ${newStatus}.`);
    } catch (err: any) {
      showError('Update Failed', err?.message || 'Could not update status.');
    }
  };

  const handleProgressSave = async () => {
    try {
      await updateProject(project.id, {
        progress_percentage: progressDraft,
      });
      success('Progress Saved', `Project progress updated to ${progressDraft}%.`);
    } catch (err: any) {
      showError('Update Failed', err?.message || 'Could not update progress.');
    }
  };

  const handleSaveInternalNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingNotes(true);
    try {
      await updateProject(project.id, { internal_notes: notesDraft });
      success('Notes Saved', 'Project internal notes updated.');
    } catch (err: any) {
      showError('Save Failed', err?.message || 'Could not save notes.');
    } finally {
      setSavingNotes(false);
    }
  };

  // PDF Download Handlers
  const handleDownloadDossier = async () => {
    await exportProjectDetailPDF({
      summary,
      payments: projectPayments,
      expenses: projectExpenses,
      settings,
    });
    success('Project Dossier Exported', 'Generated comprehensive PDF project dossier.');
  };

  const handleDownloadWorkReport = async () => {
    if (!client) return;
    await exportWorkUpdateReportPDF({
      project,
      client,
      updates: projectWorkUpdates,
      settings,
    });
    success('Work Progress Report Exported', 'Generated work progress timeline report.');
  };

  const handleDownloadReceipt = async (payment: Payment) => {
    if (!client) return;
    await exportPaymentReceiptPDF({
      payment,
      project,
      client,
      allProjectPayments: projectPayments,
      settings,
    });
    success('Receipt Generated', `Downloaded receipt ${payment.receipt_number}.`);
  };

  const handleDownloadQuotationPDF = (quote: Quotation) => {
    if (!client) return;
    setPdfExportQuotation(quote);
  };

  // Work Update handlers
  const handleDeleteWorkUpdate = async () => {
    if (!deleteUpdateTarget) return;
    try {
      await deleteWorkUpdate(deleteUpdateTarget);
      setDeleteUpdateTarget(null);
      success('Update Removed', 'Work progress update deleted.');
    } catch (err: any) {
      showError('Delete Failed', err?.message || 'Could not delete update.');
    }
  };

  // Team assignment handlers
  const handleRemoveTeamAssignment = async () => {
    if (!removeTeamTarget) return;
    try {
      await removeTeamAssignment(removeTeamTarget.id);
      setRemoveTeamTarget(null);
      success('Member Removed', `${removeTeamTarget.name} removed from project team.`);
    } catch (err: any) {
      showError('Action Failed', err?.message || 'Could not remove member.');
    }
  };

  // Quotation handlers
  const handleCreateRevision = async (quote: Quotation) => {
    try {
      const revised = await createQuotationRevision(quote.id);
      success(
        'Revision Created',
        `Original preserved. New revision ${revised.quotation_number} created as draft.`
      );
    } catch (err: any) {
      showError('Revision Failed', err?.message || 'Could not create revision.');
    }
  };

  const handleArchiveQuotation = async () => {
    if (!archiveQuoteTarget) return;
    try {
      await archiveQuotation(archiveQuoteTarget);
      setArchiveQuoteTarget(null);
      success('Quotation Archived', 'Quotation removed from active list.');
    } catch (err: any) {
      showError('Action Failed', err?.message || 'Could not archive quotation.');
    }
  };

  const handleAcceptQuotationAndSync = async (quote: Quotation) => {
    try {
      await updateQuotation(quote.id, {
        status: 'Accepted',
        project_id: project.id,
      });
      await updateProject(project.id, {
        total_value: quote.total_amount,
        payment_terms:
          quote.payment_terms || quote.terms_and_conditions || project.payment_terms,
      });
      success(
        'Quotation Accepted & Linked',
        `Project contract value updated to ₹${quote.total_amount.toLocaleString('en-IN')}.`
      );
    } catch (err: any) {
      showError('Update Failed', err?.message || 'Could not accept quotation.');
    }
  };

  const openLightbox = (url: string, caption?: string, date?: string, stage?: string) => {
    setLightboxPhoto({ url, caption, date, stage });
    setLightboxOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-200/80">
        <div className="space-y-1">
          <Link
            to="/projects"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Projects
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
              {project.project_name}
            </h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700">
              {project.project_code}
            </span>
            <Badge variant={getProjectStatusVariant(project.status)} dot>
              {project.status}
            </Badge>
            {(deadline.isOverdue || deadline.isApproaching) && (
              <Badge variant={deadline.isOverdue ? 'danger' : 'warning'}>
                <Clock className="w-3 h-3 mr-1" />
                {deadline.label}
              </Badge>
            )}
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShareModalOpen(true)}
            className="akd-btn-primary h-[34px] px-3.5 text-xs inline-flex items-center gap-1.5 shadow-sm"
          >
            <Share2 className="w-3.5 h-3.5" /> Share Client Link
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingUpdate(undefined);
              setWorkUpdateModalOpen(true);
            }}
            className="akd-btn-secondary h-[34px] px-3 text-xs inline-flex items-center gap-1.5"
          >
            <PlusCircle className="w-3.5 h-3.5 text-[#5448ED]" /> Add Work Update
          </button>

          <button
            type="button"
            onClick={() => openQuickModal({ type: 'project', editProject: project })}
            className="akd-btn-secondary h-[34px] px-3 text-xs inline-flex items-center gap-1.5"
          >
            <Edit3 className="w-3.5 h-3.5" /> Edit Project
          </button>
        </div>
      </div>

      {/* 2. Project Financial Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="akd-card p-4">
          <span className="text-xs text-slate-600 font-medium">Total Project Value</span>
          <p className="text-2xl font-bold text-slate-900 font-display mt-1 tabular-nums">
            {formatINR(summary.totalValue)}
          </p>
          <p className="text-[11px] text-slate-600 mt-1">
            Agreed turnkey / design contract
          </p>
        </div>

        <div className="akd-card p-4 border-l-4 border-l-emerald-500">
          <span className="text-xs text-slate-600 font-medium">Minus: Confirmed Received</span>
          <p className="text-2xl font-bold text-emerald-600 font-display mt-1 tabular-nums">
            {formatINR(summary.paymentsReceived)}
          </p>
          <p className="text-[11px] text-slate-600 mt-1">
            {summary.collectionPercentage}% collected across {summary.paymentCount} receipts
          </p>
        </div>

        <div className="akd-card p-4 border-l-4 border-l-amber-500">
          <span className="text-xs text-slate-600 font-medium">Equals: Outstanding Balance</span>
          <p className="text-2xl font-bold text-amber-600 font-display mt-1 tabular-nums">
            {formatINR(summary.outstandingBalance)}
          </p>
          <p className="text-[11px] text-slate-600 mt-1">
            Remaining balance from client
          </p>
        </div>

        <div className="akd-card p-4">
          <span className="text-xs text-slate-600 font-medium">Recorded Project Expenses</span>
          <p className="text-2xl font-bold text-rose-600 font-display mt-1 tabular-nums">
            {formatINR(summary.recordedExpenses)}
          </p>
          <p className="text-[11px] text-slate-600 mt-1">
            Tracked separately ({summary.expenseCount} entries)
          </p>
        </div>
      </div>

      {/* 3. Secondary Navigation Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-2 sm:space-x-6 overflow-x-auto" aria-label="Tabs">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-1.5 border-b-2 font-semibold text-xs whitespace-nowrap inline-flex items-center gap-1.5 transition-colors ${
              activeTab === 'overview'
                ? 'border-[#5448ED] text-[#5448ED]'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <FolderKanban className="w-4 h-4" />
            Overview
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('work_updates')}
            className={`py-3 px-1.5 border-b-2 font-semibold text-xs whitespace-nowrap inline-flex items-center gap-1.5 transition-colors ${
              activeTab === 'work_updates'
                ? 'border-[#5448ED] text-[#5448ED]'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Layers className="w-4 h-4" />
            Work Updates
            <span
              className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                activeTab === 'work_updates'
                  ? 'bg-indigo-100 text-[#5448ED]'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {projectWorkUpdates.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('team')}
            className={`py-3 px-1.5 border-b-2 font-semibold text-xs whitespace-nowrap inline-flex items-center gap-1.5 transition-colors ${
              activeTab === 'team'
                ? 'border-[#5448ED] text-[#5448ED]'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Users className="w-4 h-4" />
            Team
            <span
              className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                activeTab === 'team'
                  ? 'bg-indigo-100 text-[#5448ED]'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {projectAssignedTeam.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('quotation')}
            className={`py-3 px-1.5 border-b-2 font-semibold text-xs whitespace-nowrap inline-flex items-center gap-1.5 transition-colors ${
              activeTab === 'quotation'
                ? 'border-[#5448ED] text-[#5448ED]'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <FileText className="w-4 h-4" />
            Quotations
            {projectQuotations.length > 0 && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                  activeTab === 'quotation'
                    ? 'bg-indigo-100 text-[#5448ED]'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {projectQuotations.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('payments_expenses')}
            className={`py-3 px-1.5 border-b-2 font-semibold text-xs whitespace-nowrap inline-flex items-center gap-1.5 transition-colors ${
              activeTab === 'payments_expenses'
                ? 'border-[#5448ED] text-[#5448ED]'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Receipt className="w-4 h-4" />
            Payments &amp; Expenses
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className={`py-3 px-1.5 border-b-2 font-semibold text-xs whitespace-nowrap inline-flex items-center gap-1.5 transition-colors ${
              activeTab === 'documents'
                ? 'border-[#5448ED] text-[#5448ED]'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <FileDown className="w-4 h-4" />
            Documents
          </button>
        </nav>
      </div>

      {/* 4. Tab Content Panels */}

      {/* =====================================================================
          TAB 1: OVERVIEW
      ===================================================================== */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Progress Controls, Client Profile, Site Details */}
          <div className="space-y-6">
            {/* Interactive Status & Progress Card */}
            <div className="akd-card p-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-900 font-display pb-2 border-b border-slate-100">
                Execution Status &amp; Progress
              </h2>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="akd-label">Project Status</label>
                  <select
                    value={project.status}
                    onChange={(e) => handleStatusUpdate(e.target.value as ProjectStatus)}
                    className="akd-select text-xs"
                  >
                    {PROJECT_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="akd-label">Current Work Stage</label>
                  <select
                    value={project.current_work_stage || 'Planning'}
                    onChange={async (e) => {
                      const nextStage = e.target.value as WorkStage;
                      try {
                        await updateProject(project.id, { current_work_stage: nextStage });
                        success('Work Stage Updated', `Current stage set to ${nextStage}.`);
                      } catch (err: any) {
                        showError('Update Failed', err?.message || 'Could not update work stage.');
                      }
                    }}
                    className="akd-select text-xs"
                  >
                    {WORK_STAGES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">Overall Project Progress</span>
                  <span className="font-bold text-[#5448ED] tabular-nums">
                    {progressDraft}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={progressDraft}
                  onChange={(e) => setProgressDraft(Number(e.target.value))}
                  className="w-full accent-[#5448ED] cursor-pointer"
                />
                {progressDraft !== project.progress_percentage && (
                  <button
                    type="button"
                    onClick={handleProgressSave}
                    className="akd-btn-primary h-8 px-3 text-xs w-full mt-1"
                  >
                    Save {progressDraft}% Overall Progress
                  </button>
                )}
              </div>
            </div>

            {/* Associated Client Card */}
            <div className="akd-card p-5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-900 font-display">
                  Associated Client
                </h2>
                {client && (
                  <Link
                    to={`/clients/${client.id}`}
                    className="text-xs font-semibold text-[#5448ED] hover:underline"
                  >
                    View Profile &rarr;
                  </Link>
                )}
              </div>

              {client ? (
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900 block">
                        {client.full_name}
                      </span>
                      <span className="text-slate-600 font-mono">
                        {client.client_code} &bull; {client.client_type}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <Phone className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-slate-800 font-medium">{client.phone}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-600">Client profile unavailable.</p>
              )}
            </div>

            {/* Client Portal Status Quick Card */}
            <div className="akd-card p-5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-900 font-display">
                  Client Sharing Portal
                </h2>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    project.is_sharing_enabled
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {project.is_sharing_enabled ? 'Active' : 'Disabled'}
                </span>
              </div>
              <p className="text-xs text-slate-600">
                {project.is_sharing_enabled
                  ? 'Client tracking portal is currently live for this project.'
                  : 'Client sharing portal is turned off.'}
              </p>
              <button
                type="button"
                onClick={() => setShareModalOpen(true)}
                className="akd-btn-secondary h-8 px-3 text-xs w-full inline-flex items-center justify-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5 text-[#5448ED]" /> Manage Share Link
              </button>
            </div>
          </div>

          {/* Right 2 Columns: Site Details, Latest Work Update & Notes */}
          <div className="lg:col-span-2 space-y-6">
            {/* Site & Schedule Details */}
            <div className="akd-card p-5 space-y-3 text-xs">
              <h2 className="text-sm font-semibold text-slate-900 font-display pb-2 border-b border-slate-100">
                Site &amp; Schedule Details
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-slate-600 block">Category &amp; Site Address</span>
                    <span className="font-medium text-slate-900">
                      {project.category} &bull; {project.property_location}
                    </span>
                    {project.site_address && (
                      <span className="text-slate-600 block mt-0.5">
                        {project.site_address}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Calendar className="w-3.5 h-3.5" />
                  </div>
                  <div className="space-y-1">
                    <div>
                      <span className="text-slate-600">Estimated Start: </span>
                      <span className="font-medium text-slate-900">
                        {formatDate(project.estimated_start_date, settings.date_format)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-600">Expected Completion: </span>
                      <span className="font-medium text-slate-900">
                        {formatDate(project.expected_completion_date, settings.date_format)}
                      </span>
                    </div>
                    {project.actual_completion_date && (
                      <div>
                        <span className="text-slate-600">Actual Completion: </span>
                        <span className="font-medium text-emerald-600">
                          {formatDate(project.actual_completion_date, settings.date_format)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {project.payment_terms && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-600 block mb-0.5 font-medium">Agreed Payment Terms</span>
                  <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{project.payment_terms}</p>
                </div>
              )}

              {project.description && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-600 block mb-0.5 font-medium">Scope of Work</span>
                  <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {project.description}
                  </p>
                </div>
              )}
            </div>

            {/* Latest Work Update Preview */}
            <div className="akd-card p-5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-900 font-display">
                  Recent Work Progress
                </h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('work_updates')}
                  className="text-xs font-semibold text-[#5448ED] hover:underline"
                >
                  View All Updates ({projectWorkUpdates.length}) &rarr;
                </button>
              </div>

              {projectWorkUpdates.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 space-y-2">
                  <p>No work progress updates recorded yet.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingUpdate(undefined);
                      setWorkUpdateModalOpen(true);
                    }}
                    className="akd-btn-primary h-7 px-3 text-xs inline-flex items-center gap-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Update Work Progress
                  </button>
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      {projectWorkUpdates[0].work_stage} ({projectWorkUpdates[0].progress_percentage}%)
                    </span>
                    <span className="text-slate-500">
                      {formatDate(projectWorkUpdates[0].update_date, settings.date_format)}
                    </span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">
                    {projectWorkUpdates[0].work_completed}
                  </p>
                  {projectWorkUpdates[0].photos && projectWorkUpdates[0].photos.length > 0 && (
                    <div className="flex items-center gap-2 pt-1 overflow-x-auto">
                      {projectWorkUpdates[0].photos.map((ph) => (
                        <img
                          key={ph.id}
                          src={ph.photo_url}
                          alt="Progress"
                          onClick={() => openLightbox(ph.photo_url, ph.caption, ph.upload_date)}
                          className="w-16 h-12 rounded object-cover cursor-pointer hover:opacity-85 border border-slate-200"
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Internal Project Notes */}
            <form onSubmit={handleSaveInternalNotes} className="akd-card p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-900 font-display pb-2 border-b border-slate-100">
                Project Internal Notes
              </h2>
              <textarea
                rows={3}
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="Site supervision notes, vendor delivery dates, material codes..."
                className="akd-textarea text-xs"
              />
              <button
                type="submit"
                disabled={savingNotes}
                className="akd-btn-secondary h-8 px-3 text-xs w-full"
              >
                <Save className="w-3.5 h-3.5 text-indigo-600" />
                {savingNotes ? 'Saving...' : 'Update Notes'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: WORK UPDATES & PHOTO GALLERY
      ===================================================================== */}
      {activeTab === 'work_updates' && (
        <div className="space-y-6">
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200">
            <div>
              <h2 className="text-sm font-bold text-slate-900 font-display">
                Project Work Updates &amp; Site Photographs
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Record site progress percentages, completed milestones, and upload photos
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingUpdate(undefined);
                  setWorkUpdateModalOpen(true);
                }}
                className="akd-btn-primary h-8 px-3.5 text-xs inline-flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Update Work Progress
              </button>
            </div>
          </div>

          {/* Work Updates Timeline */}
          {projectWorkUpdates.length === 0 ? (
            <div className="akd-card p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">
                No Work Updates Recorded Yet
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Keep the project on schedule and your client informed. Click "Update Work Progress" to log your first milestone and photos.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingUpdate(undefined);
                  setWorkUpdateModalOpen(true);
                }}
                className="akd-btn-primary h-8 px-4 text-xs inline-flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Record First Work Update
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {projectWorkUpdates.map((update) => (
                <div
                  key={update.id}
                  className="akd-card p-5 space-y-4 hover:border-slate-300 transition-colors"
                >
                  {/* Top Bar of Update */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-slate-100 text-slate-900">
                        {update.work_stage}
                      </span>
                      <span className="text-xs font-bold text-[#5448ED] tabular-nums">
                        {update.progress_percentage}% Progress
                      </span>
                      {update.is_visible_to_client ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md">
                          <Eye className="w-3 h-3 text-emerald-600" /> Visible to Client
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          <Lock className="w-3 h-3 text-slate-400" /> Internal Only
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">
                        {formatDate(update.update_date, settings.date_format)}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingUpdate(update);
                            setWorkUpdateModalOpen(true);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-slate-800"
                          title="Edit Update"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteUpdateTarget(update.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600"
                          title="Delete Update"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Work Completed Content */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Work Completed
                    </span>
                    <p className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                      {update.work_completed}
                    </p>
                  </div>

                  {/* Next Step */}
                  {update.work_remaining && (
                    <div className="text-xs text-slate-600 pt-1">
                      <strong className="text-slate-800">Next Step: </strong>
                      {update.work_remaining}
                    </div>
                  )}

                  {/* Client Note */}
                  {update.client_note && (
                    <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200/60 text-xs text-amber-950">
                      <span className="font-bold text-[10px] text-amber-800 uppercase tracking-wider block mb-0.5">
                        Client Note
                      </span>
                      {update.client_note}
                    </div>
                  )}

                  {/* Internal Note */}
                  {update.internal_note && (
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/60 text-xs text-slate-700">
                      <span className="font-bold text-[10px] text-slate-500 uppercase tracking-wider block mb-0.5">
                        Internal Studio Note (Hidden from Client)
                      </span>
                      {update.internal_note}
                    </div>
                  )}

                  {/* Attached Photos */}
                  {update.photos && update.photos.length > 0 && (
                    <div className="pt-2 space-y-1.5">
                      <span className="text-xs font-semibold text-slate-700 block">
                        Site Photos ({update.photos.length})
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                        {update.photos.map((ph) => (
                          <div
                            key={ph.id}
                            onClick={() =>
                              openLightbox(
                                ph.photo_url,
                                ph.caption,
                                ph.upload_date,
                                update.work_stage
                              )
                            }
                            className="relative group rounded-lg overflow-hidden aspect-4/3 bg-slate-100 cursor-pointer border border-slate-200 hover:shadow-md transition-all"
                          >
                            <img
                              src={ph.photo_url}
                              alt={ph.caption || 'Site progress'}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                            {ph.caption && (
                              <div className="absolute inset-x-0 bottom-0 bg-slate-950/70 p-1 text-[10px] text-white truncate">
                                {ph.caption}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 3: TEAM MANAGEMENT
      ===================================================================== */}
      {activeTab === 'team' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200">
            <div>
              <h2 className="text-sm font-bold text-slate-900 font-display">
                Project Team &amp; Work Management
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Record which supervisors, carpenters, and contractors are working on this site
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingMember(undefined);
                  setTeamMemberModalOpen(true);
                }}
                className="akd-btn-secondary h-8 px-3 text-xs inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add Team Member
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingAssignment(undefined);
                  setAssignTeamModalOpen(true);
                }}
                className="akd-btn-primary h-8 px-3.5 text-xs inline-flex items-center gap-1.5"
              >
                <Users className="w-3.5 h-3.5" /> Assign to Project
              </button>
            </div>
          </div>

          {/* Assigned Members Table */}
          {projectAssignedTeam.length === 0 ? (
            <div className="akd-card p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">
                No Team Members Assigned Yet
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Record who is responsible for this project&apos;s carpentry, electrical, and site supervision.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingAssignment(undefined);
                  setAssignTeamModalOpen(true);
                }}
                className="akd-btn-primary h-8 px-4 text-xs inline-flex items-center gap-1.5"
              >
                <Users className="w-3.5 h-3.5" /> Assign Team Member
              </button>
            </div>
          ) : (
            <div className="akd-card overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  Assigned Site Team ({projectAssignedTeam.length})
                </span>
              </div>

              {/* Mobile & Tablet Team Cards (Swipe Style) */}
              <div className="lg:hidden p-3.5 space-y-3 bg-slate-50/40">
                {projectAssignedTeam.map((assignment) => {
                  const member =
                    assignment.member ||
                    teamMembers.find((m) => m.id === assignment.team_member_id);
                  if (!member) return null;
                  const cleanPhone = (member.phone || '').replace(/\D/g, '');
                  return (
                    <div key={assignment.id} className="swipe-team-card">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-xs text-[#5448ED] shrink-0">
                            {member.full_name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 text-sm block truncate">
                              {member.full_name}
                            </span>
                            <span className="text-[11px] text-slate-500 block truncate">
                              {member.role} {member.skill ? `• ${member.skill}` : ''}
                            </span>
                          </div>
                        </div>
                        <span className="shrink-0 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-full">
                          {assignment.role_on_project || member.role}
                        </span>
                      </div>

                      {assignment.notes && (
                        <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg italic">
                          "{assignment.notes}"
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                        <div className="flex items-center gap-1.5">
                          {member.phone && (
                            <a
                              href={`tel:${member.phone}`}
                              className="swipe-action-pill swipe-action-pill-call"
                            >
                              <Phone className="w-3 h-3" />
                              <span>Call</span>
                            </a>
                          )}
                          {cleanPhone && (
                            <a
                              href={`https://wa.me/${cleanPhone}`}
                              target="_blank"
                              rel="noreferrer"
                              className="swipe-action-pill swipe-action-pill-whatsapp"
                            >
                              <span>WhatsApp</span>
                            </a>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAssignment(assignment);
                              setAssignTeamModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                            title="Edit Project Role / Notes"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setRemoveTeamTarget({
                                id: assignment.id,
                                name: member.full_name,
                              })
                            }
                            className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100"
                            title="Remove Assignment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Full Table View (>= 1024px) */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                      <th className="py-3 px-4">Member Name</th>
                      <th className="py-3 px-4">Specialization</th>
                      <th className="py-3 px-4">Phone Number</th>
                      <th className="py-3 px-4">Role on Project</th>
                      <th className="py-3 px-4">Assignment Notes</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {projectAssignedTeam.map((assignment) => {
                      const member =
                        assignment.member ||
                        teamMembers.find((m) => m.id === assignment.team_member_id);
                      if (!member) return null;
                      return (
                        <tr key={assignment.id} className="hover:bg-slate-50/70">
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-slate-900 block">
                              {member.full_name}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {member.role}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {member.skill || '—'}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-800">
                            {member.phone}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-medium text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded text-[11px]">
                              {assignment.role_on_project || member.role}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 max-w-[200px] truncate">
                            {assignment.notes || '—'}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingAssignment(assignment);
                                  setAssignTeamModalOpen(true);
                                }}
                                className="p-1 rounded text-slate-400 hover:text-slate-800"
                                title="Edit Project Role / Notes"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setRemoveTeamTarget({
                                    id: assignment.id,
                                    name: member.full_name,
                                  })
                                }
                                className="p-1 rounded text-slate-400 hover:text-rose-600"
                                title="Remove Assignment"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Studio Team Directory Reference */}
          <div className="akd-card overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-900">
                  Studio Team Directory ({teamMembers.filter((m) => m.is_active).length})
                </h3>
                <p className="text-[11px] text-slate-500">
                  All active supervisors, designers, carpenters, and site specialists in your studio
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingMember(undefined);
                  setTeamMemberModalOpen(true);
                }}
                className="akd-btn-secondary h-7 px-2.5 text-xs inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> New Directory Member
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
              {teamMembers
                .filter((m) => m.is_active)
                .map((member) => {
                  const isAssigned = projectAssignedTeam.some(
                    (a) => a.team_member_id === member.id
                  );
                  return (
                    <div
                      key={member.id}
                      className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/50 flex items-start justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900 truncate">
                            {member.full_name}
                          </span>
                          {isAssigned && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              On Site
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 block">
                          {member.role}
                          {member.skill ? ` • ${member.skill}` : ''}
                        </span>
                        <span className="text-[11px] font-mono text-slate-600 block mt-0.5">
                          {member.phone}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMember(member);
                          setTeamMemberModalOpen(true);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-slate-800 shrink-0"
                        title="Edit Member Profile"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 text-xs text-slate-600 flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-400 shrink-0" />
            <span>
              <strong>Privacy Guaranteed:</strong> Team member phone numbers, notes, and assignment details are strictly internal and will never appear on the client's public tracking portal.
            </span>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 4: QUOTATION & BOQ
      ===================================================================== */}
      {activeTab === 'quotation' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200">
            <div>
              <h2 className="text-sm font-bold text-slate-900 font-display">
                Project Quotations &amp; Itemized BOQ
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Generate professional interior quotations, line-item BOQs, and export client PDFs
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingQuotation(undefined);
                setQuotationModalOpen(true);
              }}
              className="akd-btn-primary h-8 px-3.5 text-xs inline-flex items-center gap-1.5"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Create Quotation
            </button>
          </div>

          {projectQuotations.length === 0 ? (
            <div className="akd-card p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">
                No Quotations Created for this Project
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Create an itemized BOQ with square footage, rates, taxes, and automatic totals for your client.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingQuotation(undefined);
                  setQuotationModalOpen(true);
                }}
                className="akd-btn-primary h-8 px-4 text-xs inline-flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Create New Quotation
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {projectQuotations.map((quote) => (
                <div
                  key={quote.id}
                  className="akd-card p-5 space-y-4 hover:border-slate-300 transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 font-mono">
                          {quote.quotation_number}
                        </span>
                        {quote.revision_number > 1 && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            Rev {quote.revision_number}
                          </span>
                        )}
                        <Badge
                          variant={
                            quote.status === 'Accepted'
                              ? 'success'
                              : quote.status === 'Sent'
                              ? 'indigo'
                              : quote.status === 'Revised'
                              ? 'neutral'
                              : 'default'
                          }
                        >
                          {quote.status}
                        </Badge>
                      </div>
                      <span className="text-xs text-slate-500">
                        Date: {formatDate(quote.quotation_date, settings.date_format)} &bull; Valid Until:{' '}
                        {formatDate(quote.valid_until, settings.date_format)}
                      </span>
                    </div>

                    {/* Actions on this Quotation */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDownloadQuotationPDF(quote)}
                        className="akd-btn-secondary h-8 px-2.5 text-xs inline-flex items-center gap-1.5"
                        title="Download Professional PDF"
                      >
                        <FileDown className="w-3.5 h-3.5 text-[#5448ED]" /> Download PDF
                      </button>

                      {quote.status !== 'Revised' && (
                        <button
                          type="button"
                          onClick={() => handleCreateRevision(quote)}
                          className="akd-btn-secondary h-8 px-2.5 text-xs inline-flex items-center gap-1"
                          title="Create a new revision preserving this one"
                        >
                          <RefreshCw className="w-3 h-3 text-amber-600" /> Revise
                        </button>
                      )}

                      {quote.status !== 'Accepted' && (
                        <button
                          type="button"
                          onClick={() => handleAcceptQuotationAndSync(quote)}
                          className="akd-btn-secondary h-8 px-2.5 text-xs text-emerald-700 hover:text-emerald-800"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Accept &amp; Link
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setEditingQuotation(quote);
                          setQuotationModalOpen(true);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-slate-800"
                        title="Edit Quotation"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setArchiveQuoteTarget(quote.id)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600"
                        title="Archive Quotation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Summary of Items */}
                  {/* Mobile & Tablet BOQ Items (Swipe Style) */}
                  <div className="sm:hidden space-y-1.5 py-1">
                    {quote.items.map((it, i) => (
                      <div key={it.id || i} className="swipe-boq-item">
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-900 text-xs block">
                            {it.item_name}
                          </span>
                          {it.description && (
                            <span className="text-[11px] text-slate-500 block truncate">
                              {it.description}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-500 font-mono">
                            {it.quantity} {it.unit} &times; {formatINR(it.rate)}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-bold text-slate-900 text-xs tabular-nums">
                            {formatINR(it.amount)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop BOQ Table (>= 640px) */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-100 text-[11px]">
                          <th className="py-1.5 px-2">Item Description</th>
                          <th className="py-1.5 px-2 text-right">Qty</th>
                          <th className="py-1.5 px-2 text-center">Unit</th>
                          <th className="py-1.5 px-2 text-right">Rate</th>
                          <th className="py-1.5 px-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {quote.items.map((it, i) => (
                          <tr key={it.id || i}>
                            <td className="py-1.5 px-2">
                              <span className="font-semibold text-slate-900 block">{it.item_name}</span>
                              {it.description && (
                                <span className="text-[11px] text-slate-500">{it.description}</span>
                              )}
                            </td>
                            <td className="py-1.5 px-2 text-right tabular-nums">{it.quantity}</td>
                            <td className="py-1.5 px-2 text-center text-slate-500">{it.unit}</td>
                            <td className="py-1.5 px-2 text-right tabular-nums">{formatINR(it.rate)}</td>
                            <td className="py-1.5 px-2 text-right font-medium tabular-nums">
                              {formatINR(it.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Financial Total Strip */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-4 text-slate-600">
                      <span>Subtotal: {formatINR(quote.subtotal)}</span>
                      {quote.discount_amount > 0 && (
                        <span className="text-rose-600">
                          Discount ({quote.discount_percentage}%): -{formatINR(quote.discount_amount)}
                        </span>
                      )}
                      {quote.tax_rate > 0 && (
                        <span>
                          Tax ({quote.tax_rate}%): +{formatINR(quote.tax_amount)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold uppercase text-slate-700">Quotation Total:</span>
                      <span className="text-base font-bold font-display text-[#5448ED] tabular-nums">
                        {formatINR(quote.total_amount)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 5: PAYMENTS & EXPENSES
      ===================================================================== */}
      {activeTab === 'payments_expenses' && (
        <div className="space-y-6">
          {/* Payment Ledger for this Project */}
          <div className="akd-card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 font-display">
                  Project Payment History ({projectPayments.length})
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Advances, instalments, and settlements received for this project
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  openQuickModal({
                    type: 'payment',
                    projectId: project.id,
                    clientId: project.client_id,
                  })
                }
                className="akd-btn-primary h-8 px-3 text-xs"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Record Payment
              </button>
            </div>

            {projectPayments.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-600">
                No payments recorded against this project yet.
              </div>
            ) : (
              <>
                {/* Mobile & Tablet Payment Cards (Swipe Style) */}
                <div className="lg:hidden p-3.5 space-y-3 bg-slate-50/40">
                  {projectPayments.map((pay) => (
                    <div key={pay.id} className="swipe-detail-card">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 text-sm block font-mono">
                            {pay.receipt_number}
                          </span>
                          <span className="text-[11px] text-slate-500 mt-0.5 block truncate">
                            {pay.transaction_reference || pay.notes || '—'}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-base font-extrabold text-emerald-600 block tabular-nums">
                            +{formatINR(pay.amount)}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {formatDate(pay.payment_date, settings.date_format)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium text-[11px]">
                            {pay.payment_type}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium text-[11px]">
                            {pay.payment_method}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDownloadReceipt(pay)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 shadow-xs"
                            title="Download Payment Receipt PDF"
                          >
                            <FileText className="w-3 h-3 text-[#5448ED]" /> Receipt
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              openQuickModal({
                                type: 'payment',
                                editPayment: pay,
                              })
                            }
                            className="p-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                            title="Edit Payment"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Full Table View (>= 1024px) */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                      <th className="py-3 px-4">Receipt No.</th>
                      <th className="py-3 px-4">Payment Date</th>
                      <th className="py-3 px-4">Type &amp; Method</th>
                      <th className="py-3 px-4">Reference / Notes</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {projectPayments.map((pay) => (
                      <tr key={pay.id} className="hover:bg-slate-50/70">
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">
                          {pay.receipt_number}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          {formatDate(pay.payment_date, settings.date_format)}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-900 block">
                            {pay.payment_type}
                          </span>
                          <span className="text-[11px] text-slate-600">
                            {pay.payment_method}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 max-w-[200px] truncate">
                          {pay.transaction_reference || pay.notes || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums font-bold text-emerald-600">
                          {formatINR(pay.amount)}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDownloadReceipt(pay)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 shadow-xs"
                              title="Download Payment Receipt PDF"
                            >
                              <FileText className="w-3 h-3 text-[#5448ED]" /> Receipt
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                openQuickModal({
                                  type: 'payment',
                                  editPayment: pay,
                                })
                              }
                              className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                              title="Edit Payment"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          </div>

          {/* Recorded Project Expenses */}
          <div className="akd-card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 font-display">
                  Recorded Project Expenses ({projectExpenses.length})
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Materials, contractor payouts, and site expenses linked to this project
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  openQuickModal({
                    type: 'expense',
                    projectId: project.id,
                  })
                }
                className="akd-btn-secondary h-8 px-3 text-xs"
              >
                <Receipt className="w-3.5 h-3.5 text-amber-600" /> Add Expense
              </button>
            </div>

            {projectExpenses.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-600">
                No expenses linked to this project yet.
              </div>
            ) : (
              <>
                {/* Mobile & Tablet Expense Cards (Swipe Style) */}
                <div className="lg:hidden p-3.5 space-y-3 bg-slate-50/40">
                  {projectExpenses.map((exp) => (
                    <div key={exp.id} className="swipe-detail-card">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 text-sm block truncate">
                            {exp.title}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500 mt-0.5 block truncate">
                            {exp.expense_code} &bull; {exp.vendor_name || '—'}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-base font-extrabold text-rose-600 block tabular-nums">
                            -{formatINR(exp.amount)}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {formatDate(exp.expense_date, settings.date_format)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                        <Badge variant="default">{exp.category}</Badge>
                        <button
                          type="button"
                          onClick={() =>
                            openQuickModal({
                              type: 'expense',
                              editExpense: exp,
                              projectId: project.id,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 shadow-xs"
                          title="Edit Expense"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-slate-500" /> Edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Full Table View (>= 1024px) */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Expense Title</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Vendor / Payee</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4 text-right">Edit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {projectExpenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50/70">
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          {formatDate(exp.expense_date, settings.date_format)}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-900 block">
                            {exp.title}
                          </span>
                          <span className="text-[11px] font-mono text-slate-600">
                            {exp.expense_code}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge variant="default">{exp.category}</Badge>
                        </td>
                        <td className="py-3.5 px-4 text-slate-800">
                          {exp.vendor_name || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums font-bold text-slate-900">
                          {formatINR(exp.amount)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              openQuickModal({
                                type: 'expense',
                                editExpense: exp,
                              })
                            }
                            className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                            title="Edit Expense"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 6: DOCUMENTS & EXPORTS
      ===================================================================== */}
      {activeTab === 'documents' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="akd-card p-5 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileDown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-display">
                Project Dossier PDF
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Complete printable summary including client specs, financial breakdown, receipts list, and expense history.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadDossier}
              className="akd-btn-secondary h-8 px-3.5 text-xs inline-flex items-center gap-1.5"
            >
              <FileDown className="w-3.5 h-3.5 text-[#5448ED]" /> Download Project Dossier PDF
            </button>
          </div>

          <div className="akd-card p-5 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#B08A3E] flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-display">
                Work Updates &amp; Progress Report PDF
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Printable timeline of site milestones, completion percentages, and documented completed works.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadWorkReport}
              className="akd-btn-secondary h-8 px-3.5 text-xs inline-flex items-center gap-1.5"
            >
              <FileDown className="w-3.5 h-3.5 text-[#B08A3E]" /> Export Work Progress PDF
            </button>
          </div>

          {projectQuotations.length > 0 && (
            <div className="akd-card p-5 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-display">
                  Active Project Quotation PDF
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Latest quotation ({projectQuotations[0].quotation_number}) with full itemized BOQ, taxes, and signed terms.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDownloadQuotationPDF(projectQuotations[0])}
                className="akd-btn-secondary h-8 px-3.5 text-xs inline-flex items-center gap-1.5"
              >
                <FileDown className="w-3.5 h-3.5 text-emerald-600" /> Export Quotation PDF
              </button>
            </div>
          )}

          <div className="akd-card p-5 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-display">
                Client Progress Tracking Link
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Share real-time project progress, work photos, and site notes directly with your client via WhatsApp or link.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShareModalOpen(true)}
              className="akd-btn-primary h-8 px-3.5 text-xs inline-flex items-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" /> Manage Client Portal Link
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODALS & DIALOGS
      ===================================================================== */}
      {/* 1. Share Project with Client Modal */}
      <ShareProjectModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        project={project}
        client={client}
      />

      {/* 2. Work Update Form Modal */}
      {workUpdateModalOpen && (
        <WorkUpdateModal
          isOpen={workUpdateModalOpen}
          onClose={() => {
            setWorkUpdateModalOpen(false);
            setEditingUpdate(undefined);
          }}
          projectId={project.id}
          editUpdate={editingUpdate}
          currentProjectProgress={project.progress_percentage}
        />
      )}

      {/* 3. Assign Team Member Modal */}
      {assignTeamModalOpen && (
        <AssignTeamMemberModal
          isOpen={assignTeamModalOpen}
          onClose={() => {
            setAssignTeamModalOpen(false);
            setEditingAssignment(undefined);
          }}
          projectId={project.id}
          editAssignment={editingAssignment}
        />
      )}

      {/* 4. Team Member Directory Modal */}
      {teamMemberModalOpen && (
        <TeamMemberModal
          isOpen={teamMemberModalOpen}
          onClose={() => {
            setTeamMemberModalOpen(false);
            setEditingMember(undefined);
          }}
          editMember={editingMember}
        />
      )}

      {/* 5. Quotation Modal */}
      {quotationModalOpen && (
        <QuotationModal
          isOpen={quotationModalOpen}
          onClose={() => {
            setQuotationModalOpen(false);
            setEditingQuotation(undefined);
          }}
          clientId={project.client_id}
          projectId={project.id}
          editQuotation={editingQuotation}
          onSavedAndExport={(saved) => setPdfExportQuotation(saved)}
        />
      )}

      {/* 5b. Quotation PDF Section Selection & Export Modal */}
      {pdfExportQuotation && client && (
        <QuotationPDFExportModal
          isOpen={Boolean(pdfExportQuotation)}
          onClose={() => setPdfExportQuotation(null)}
          quotation={pdfExportQuotation}
          client={client}
          project={project}
        />
      )}

      {/* 6. Photo Lightbox Modal */}
      <PhotoLightboxModal
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        photoUrl={lightboxPhoto?.url || null}
        caption={lightboxPhoto?.caption}
        uploadDate={lightboxPhoto?.date}
        stageBadge={lightboxPhoto?.stage}
      />

      {/* 7. Confirm Delete Work Update Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteUpdateTarget)}
        onClose={() => setDeleteUpdateTarget(null)}
        onConfirm={handleDeleteWorkUpdate}
        title="Delete Work Update?"
        description="Are you sure you want to delete this work update? Photos attached to this update will remain in the project gallery."
        confirmLabel="Delete Update"
        variant="danger"
      />

      {/* 8. Confirm Remove Team Assignment Dialog */}
      <ConfirmDialog
        isOpen={Boolean(removeTeamTarget)}
        onClose={() => setRemoveTeamTarget(null)}
        onConfirm={handleRemoveTeamAssignment}
        title="Remove Member from Project?"
        description={`Are you sure you want to remove ${removeTeamTarget?.name} from this project? The member will remain in your studio directory.`}
        confirmLabel="Remove from Project"
        variant="danger"
      />

      {/* 9. Confirm Archive Quotation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(archiveQuoteTarget)}
        onClose={() => setArchiveQuoteTarget(null)}
        onConfirm={handleArchiveQuotation}
        title="Archive Quotation?"
        description="This quotation will be removed from your active list. Previous revisions are preserved."
        confirmLabel="Archive Quotation"
        variant="danger"
      />
    </div>
  );
};
