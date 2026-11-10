import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Edit3,
  FolderPlus,
  PlusCircle,
  FileDown,
  Phone,
  Mail,
  MapPin,
  Building2,
  Calendar,
  MessageSquarePlus,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { useCRM } from '@/context/CRMContext';
import { useToast } from '@/context/ToastContext';
import { CLIENT_STATUSES, ClientStatus, Payment, Quotation } from '@/types/crm';
import {
  formatDate,
  formatINR,
  normalizeEmail,
  normalizePhone,
} from '@/lib/formatters';
import {
  Badge,
  getClientStatusVariant,
  getEnquiryStatusVariant,
  getProjectStatusVariant,
} from '@/components/ui/Badge';
import { exportClientDetailPDF, exportPaymentReceiptPDF } from '@/lib/exporters';
import { QuotationModal } from '@/components/modals/QuotationModal';
import { QuotationPDFExportModal } from '@/components/modals/QuotationPDFExportModal';

export const ClientDetailPage: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const {
    settings,
    clientFinancialMap,
    projectFinancials,
    payments,
    enquiries,
    quotations,
    updateClient,
    addClientNote,
    openQuickModal,
  } = useCRM();
  const { success, error: showError } = useToast();

  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [quotationModalOpen, setQuotationModalOpen] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | undefined>(undefined);
  const [pdfExportQuotation, setPdfExportQuotation] = useState<Quotation | null>(null);

  const summary = clientId ? clientFinancialMap.get(clientId) : undefined;

  const clientProjects = useMemo(() => {
    if (!clientId) return [];
    return projectFinancials.filter((pf) => pf.project.client_id === clientId);
  }, [clientId, projectFinancials]);

  const clientQuotations = useMemo(() => {
    if (!clientId) return [];
    return quotations.filter((q) => q.client_id === clientId && !q.is_archived);
  }, [clientId, quotations]);

  const clientPayments = useMemo(() => {
    if (!clientId) return [];
    return payments.filter((p) => p.client_id === clientId);
  }, [clientId, payments]);

  const associatedEnquiries = useMemo(() => {
    if (!summary) return [];
    const { client } = summary;
    const cPhone = normalizePhone(client.phone);
    const cEmail = normalizeEmail(client.email);

    return enquiries.filter((e) => {
      if (e.converted_client_id === client.id) return true;
      const ePhone = normalizePhone(e.phone);
      const eEmail = normalizeEmail(e.email);
      if (cPhone.length >= 8 && ePhone === cPhone) return true;
      if (cEmail.length >= 4 && eEmail === cEmail) return true;
      return false;
    });
  }, [summary, enquiries]);

  if (!summary) {
    return (
      <div className="akd-card p-10 text-center space-y-3">
        <p className="text-base font-semibold text-slate-900">Client Record Not Found</p>
        <p className="text-xs text-slate-600">
          The requested client profile may have been archived or does not exist.
        </p>
        <Link to="/clients" className="akd-btn-secondary h-[34px] text-xs inline-flex">
          <ArrowLeft className="w-3.5 h-3.5" /> Return to Clients
        </Link>
      </div>
    );
  }

  const { client } = summary;

  const handleStatusChange = async (newStatus: ClientStatus) => {
    try {
      await updateClient(client.id, { status: newStatus });
      success('Status Updated', `${client.full_name} is now marked as ${newStatus}.`);
    } catch (err: any) {
      showError('Update Failed', err?.message || 'Could not update client status.');
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setSavingNote(true);
    try {
      await addClientNote(client.id, newNote);
      setNewNote('');
      success('Note Added', 'Client note saved to profile history.');
    } catch (err: any) {
      showError('Failed to save note', err?.message || 'Could not add note.');
    } finally {
      setSavingNote(false);
    }
  };

  const handleExportDossier = async () => {
    try {
      await exportClientDetailPDF({
        summary,
        projects: clientProjects,
        payments: clientPayments,
        settings,
      });
      success('Client Dossier Exported', 'Generated PDF portfolio statement.');
    } catch (err: any) {
      showError('Export Failed', err?.message || 'Could not export PDF.');
    }
  };

  const handleDownloadReceipt = async (payment: Payment) => {
    const projSummary = clientProjects.find((p) => p.project.id === payment.project_id);
    if (!projSummary) return;
    const allProjectPayments = payments.filter((p) => p.project_id === payment.project_id);
    await exportPaymentReceiptPDF({
      payment,
      project: projSummary.project,
      client,
      allProjectPayments,
      settings,
    });
    success('Receipt Generated', `Downloaded receipt ${payment.receipt_number}.`);
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Contextual Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-200/80">
        <div className="space-y-1">
          <Link
            to="/clients"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Client Directory
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
              {client.full_name}
            </h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700">
              {client.client_code}
            </span>
            <Badge variant={getClientStatusVariant(client.status)} dot>
              {client.status}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={client.status}
            onChange={(e) => handleStatusChange(e.target.value as ClientStatus)}
            className="akd-select h-[34px] w-auto text-xs"
            aria-label="Update client status"
          >
            {CLIENT_STATUSES.map((st) => (
              <option key={st} value={st}>
                Status: {st}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleExportDossier}
            className="akd-btn-secondary h-[34px] px-3 text-xs"
          >
            <FileDown className="w-3.5 h-3.5 text-indigo-600" /> Export Dossier PDF
          </button>

          <button
            type="button"
            onClick={() => openQuickModal({ type: 'client', editClient: client })}
            className="akd-btn-secondary h-[34px] px-3 text-xs"
          >
            <Edit3 className="w-3.5 h-3.5" /> Edit Profile
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingQuotation(undefined);
              setQuotationModalOpen(true);
            }}
            className="akd-btn-secondary h-[34px] px-3.5 text-xs"
          >
            <FileText className="w-3.5 h-3.5 text-[#5448ED]" /> Create Quotation
          </button>

          <button
            type="button"
            onClick={() => openQuickModal({ type: 'project', clientId: client.id })}
            className="akd-btn-primary h-[34px] px-3.5 text-xs"
          >
            <FolderPlus className="w-3.5 h-3.5" /> Create Project
          </button>

          {clientProjects.length > 0 && (
            <button
              type="button"
              onClick={() =>
                openQuickModal({
                  type: 'payment',
                  clientId: client.id,
                  projectId: clientProjects[0].project.id,
                })
              }
              className="akd-btn-secondary h-[34px] px-3.5 text-xs"
            >
              <PlusCircle className="w-3.5 h-3.5 text-emerald-600" /> Record Payment
            </button>
          )}
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="akd-card p-4">
          <span className="text-xs text-slate-600 font-medium">Associated Projects</span>
          <p className="text-2xl font-bold text-slate-900 font-display mt-1 tabular-nums">
            {summary.projectCount}
          </p>
          <p className="text-[11px] text-slate-600 mt-1">
            {summary.activeProjectCount} active in execution
          </p>
        </div>

        <div className="akd-card p-4">
          <span className="text-xs text-slate-600 font-medium">Total Project Value</span>
          <p className="text-2xl font-bold text-slate-900 font-display mt-1 tabular-nums">
            {formatINR(summary.totalProjectValue)}
          </p>
          <p className="text-[11px] text-slate-600 mt-1">
            Budget:{' '}
            {client.project_budget ? formatINR(client.project_budget) : 'Not specified'}
          </p>
        </div>

        <div className="akd-card p-4">
          <span className="text-xs text-slate-600 font-medium">Payments Received</span>
          <p className="text-2xl font-bold text-emerald-600 font-display mt-1 tabular-nums">
            {formatINR(summary.totalPaymentsReceived)}
          </p>
          <p className="text-[11px] text-slate-600 mt-1">
            Across {clientPayments.length} confirmed receipts
          </p>
        </div>

        <div className="akd-card p-4">
          <span className="text-xs text-slate-600 font-medium">Outstanding Balance</span>
          <p className="text-2xl font-bold text-amber-600 font-display mt-1 tabular-nums">
            {formatINR(summary.outstandingBalance)}
          </p>
          <p className="text-[11px] text-slate-600 mt-1">
            Remaining balance to collect
          </p>
        </div>
      </div>

      {/* Main Two-Column Profile Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Contact Info, Property Specs, Notes */}
        <div className="space-y-6">
          {/* Contact & Property Card */}
          <div className="akd-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 font-display pb-2 border-b border-slate-100">
              Contact &amp; Property Specifications
            </h2>

            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <Phone className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-slate-600 block">Phone / WhatsApp</span>
                  <span className="font-semibold text-slate-900">{client.phone}</span>
                  {client.whatsapp && client.whatsapp !== client.phone && (
                    <span className="text-slate-600 block">
                      WhatsApp: {client.whatsapp}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-slate-600 block">Email Address</span>
                  <span className="font-medium text-slate-900">
                    {client.email || 'Not provided'}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-slate-600 block">Client &amp; Property Type</span>
                  <span className="font-medium text-slate-900">
                    {client.client_type}{' '}
                    {client.property_type ? `&bull; ${client.property_type}` : ''}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <MapPin className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-slate-600 block">Location &amp; Address</span>
                  <span className="font-medium text-slate-900">
                    {client.property_location || '—'}
                  </span>
                  {client.full_address && (
                    <span className="text-slate-600 block mt-0.5 leading-relaxed">
                      {client.full_address}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-slate-600 block">Lead Source &amp; Creation</span>
                  <span className="font-medium text-slate-900">
                    {client.lead_source || 'Direct'} &bull; Added{' '}
                    {formatDate(client.date_added, settings.date_format)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Client Notes & Log */}
          <div className="akd-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 font-display pb-2 border-b border-slate-100">
              Client Notes &amp; Design Brief
            </h2>

            <form onSubmit={handleAddNote} className="space-y-2.5">
              <textarea
                rows={3}
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add meeting notes, material preferences, design requests..."
                className="akd-textarea text-xs"
              />
              <button
                type="submit"
                disabled={savingNote || !newNote.trim()}
                className="akd-btn-secondary h-8 px-3 text-xs w-full"
              >
                <MessageSquarePlus className="w-3.5 h-3.5 text-indigo-600" />
                {savingNote ? 'Saving Note...' : 'Add Note to Profile'}
              </button>
            </form>

            {client.client_notes_log && client.client_notes_log.length > 0 ? (
              <div className="space-y-2.5 pt-2 max-h-64 overflow-y-auto">
                {client.client_notes_log.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-xs"
                  >
                    <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">
                      {entry.content}
                    </p>
                    <p className="text-[10px] text-slate-600 mt-1.5">
                      {formatDate(entry.created_at.slice(0, 10), settings.date_format)} &bull;{' '}
                      {entry.author}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-600 italic">
                No notes recorded for this client yet.
              </p>
            )}
          </div>

          {/* Associated Enquiries */}
          <div className="akd-card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 font-display pb-2 border-b border-slate-100">
              Associated Enquiries ({associatedEnquiries.length})
            </h2>

            {associatedEnquiries.length === 0 ? (
              <p className="text-xs text-slate-600">
                No initial enquiry records linked to this client.
              </p>
            ) : (
              <div className="space-y-2.5">
                {associatedEnquiries.map((enq) => (
                  <div
                    key={enq.id}
                    className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-slate-900">
                        {enq.enquiry_code}
                      </span>
                      <Badge variant={getEnquiryStatusVariant(enq.status)}>
                        {enq.status}
                      </Badge>
                    </div>
                    <p className="text-slate-800 font-medium">{enq.project_type}</p>
                    <p className="text-slate-600">
                      Enquired: {formatDate(enq.enquiry_date, settings.date_format)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 2 Columns: Project History & Payment History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Project History */}
          <div className="akd-card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 font-display">
                  Project Portfolio &amp; Execution History
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  All interior projects associated with {client.full_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => openQuickModal({ type: 'project', clientId: client.id })}
                className="akd-btn-secondary h-8 px-3 text-xs"
              >
                <FolderPlus className="w-3.5 h-3.5 text-indigo-600" /> New Project
              </button>
            </div>

            {clientProjects.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-xs font-medium text-slate-700">
                  No projects created for this client yet
                </p>
                <button
                  type="button"
                  onClick={() => openQuickModal({ type: 'project', clientId: client.id })}
                  className="text-xs font-semibold text-[#5448ED] hover:underline"
                >
                  + Create first project for {client.full_name}
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                      <th className="py-3 px-4">Project</th>
                      <th className="py-3 px-4">Status &amp; Progress</th>
                      <th className="py-3 px-4 text-right">Value</th>
                      <th className="py-3 px-4 text-right">Received</th>
                      <th className="py-3 px-4 text-right">Balance</th>
                      <th className="py-3 px-4 text-right">Open</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {clientProjects.map((pf) => (
                      <tr
                        key={pf.project.id}
                        onClick={() => navigate(`/projects/${pf.project.id}`)}
                        className="hover:bg-slate-50/70 cursor-pointer transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-900 block">
                            {pf.project.project_name}
                          </span>
                          <span className="text-[11px] text-slate-600">
                            {pf.project.project_code} &bull; {pf.project.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <Badge variant={getProjectStatusVariant(pf.project.status)}>
                              {pf.project.status}
                            </Badge>
                            <span className="text-[11px] text-slate-600 tabular-nums">
                              {pf.project.progress_percentage}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-slate-900">
                          {formatINR(pf.totalValue)}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-emerald-600">
                          {formatINR(pf.paymentsReceived)}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-amber-600">
                          {formatINR(pf.outstandingBalance)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400 inline" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Client Quotations & BOQ */}
          <div className="akd-card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 font-display">
                  Quotations &amp; Itemized BOQ ({clientQuotations.length})
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Create quotations, select PDF sections (Bank details, Tax, Scope, Signature), and download client PDFs
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingQuotation(undefined);
                  setQuotationModalOpen(true);
                }}
                className="akd-btn-secondary h-8 px-3 text-xs"
              >
                <PlusCircle className="w-3.5 h-3.5 text-[#5448ED]" /> Create Quotation
              </button>
            </div>

            {clientQuotations.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-xs font-medium text-slate-700">
                  No quotations created for this client yet
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEditingQuotation(undefined);
                    setQuotationModalOpen(true);
                  }}
                  className="text-xs font-semibold text-[#5448ED] hover:underline"
                >
                  + Create first quotation &amp; BOQ for {client.full_name}
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                      <th className="py-3 px-4">Quotation No.</th>
                      <th className="py-3 px-4">Date &amp; Validity</th>
                      <th className="py-3 px-4">Project</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Total Amount</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {clientQuotations.map((quote) => {
                      const proj = clientProjects.find(
                        (p) => p.project.id === quote.project_id
                      );
                      return (
                        <tr key={quote.id} className="hover:bg-slate-50/70">
                          <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">
                            {quote.quotation_number}
                            {quote.revision_number > 1 ? ` (Rev ${quote.revision_number})` : ''}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                            {formatDate(quote.quotation_date, settings.date_format)}
                            <span className="block text-[10px] text-slate-500">
                              Valid: {formatDate(quote.valid_until, settings.date_format)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-800">
                            {proj?.project.project_name || 'General'}
                          </td>
                          <td className="py-3.5 px-4">
                            <Badge
                              variant={
                                quote.status === 'Accepted'
                                  ? 'success'
                                  : quote.status === 'Sent'
                                    ? 'indigo'
                                    : 'default'
                              }
                            >
                              {quote.status}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4 text-right tabular-nums font-bold text-slate-900">
                            {formatINR(quote.total_amount)}
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setPdfExportQuotation(quote)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 shadow-xs"
                                title="Configure PDF Sections & Download Quotation PDF"
                              >
                                <FileDown className="w-3 h-3 text-[#5448ED]" /> Download PDF
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingQuotation(quote);
                                  setQuotationModalOpen(true);
                                }}
                                className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                                title="Edit Quotation"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Payment History */}
          <div className="akd-card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 font-display">
                  Payment History &amp; Receipts
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Confirmed payments received from {client.full_name}
                </p>
              </div>
              {clientProjects.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    openQuickModal({
                      type: 'payment',
                      clientId: client.id,
                      projectId: clientProjects[0].project.id,
                    })
                  }
                  className="akd-btn-secondary h-8 px-3 text-xs"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-emerald-600" /> Record Payment
                </button>
              )}
            </div>

            {clientPayments.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-600">
                No payments recorded for this client yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                      <th className="py-3 px-4">Receipt No.</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Project</th>
                      <th className="py-3 px-4">Type &amp; Method</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4 text-right">Receipt PDF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {clientPayments.map((pay) => {
                      const proj = clientProjects.find(
                        (p) => p.project.id === pay.project_id
                      );
                      return (
                        <tr key={pay.id} className="hover:bg-slate-50/70">
                          <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">
                            {pay.receipt_number}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                            {formatDate(pay.payment_date, settings.date_format)}
                          </td>
                          <td className="py-3.5 px-4 text-slate-800">
                            {proj?.project.project_name || '—'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-medium text-slate-900">
                              {pay.payment_type}
                            </span>
                            <span className="text-slate-600 block text-[11px]">
                              {pay.payment_method}{' '}
                              {pay.transaction_reference
                                ? `&bull; ${pay.transaction_reference}`
                                : ''}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right tabular-nums font-bold text-emerald-600">
                            {formatINR(pay.amount)}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleDownloadReceipt(pay)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 shadow-xs"
                              title="Download Payment Receipt PDF"
                            >
                              <FileText className="w-3 h-3 text-[#5448ED]" /> Receipt
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quotation Creation / Editing Modal */}
      {quotationModalOpen && (
        <QuotationModal
          isOpen={quotationModalOpen}
          onClose={() => {
            setQuotationModalOpen(false);
            setEditingQuotation(undefined);
          }}
          clientId={client.id}
          projectId={clientProjects[0]?.project.id}
          editQuotation={editingQuotation}
          onSavedAndExport={(saved) => setPdfExportQuotation(saved)}
        />
      )}

      {/* Quotation PDF Section Selection & Export Modal */}
      {pdfExportQuotation && (
        <QuotationPDFExportModal
          isOpen={Boolean(pdfExportQuotation)}
          onClose={() => setPdfExportQuotation(null)}
          quotation={pdfExportQuotation}
          client={client}
          project={
            clientProjects.find((p) => p.project.id === pdfExportQuotation.project_id)
              ?.project
          }
        />
      )}
    </div>
  );
};
