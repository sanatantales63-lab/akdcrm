import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  PlusCircle,
  FileDown,
  FileSpreadsheet,
  ArrowUpDown,
  FileText,
  Edit3,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { useCRM } from '@/context/CRMContext';
import { useToast } from '@/context/ToastContext';
import {
  Payment,
  PAYMENT_METHODS,
  PAYMENT_TYPES,
} from '@/types/crm';
import {
  formatDate,
  formatINR,
  safeSum,
} from '@/lib/formatters';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  exportPaymentReceiptPDF,
  exportPaymentsExcel,
  exportPaymentsPDF,
} from '@/lib/exporters';

export const PaymentsPage: React.FC = () => {
  const {
    settings,
    clients,
    projects,
    payments,
    projectFinancialMap,
    archivePayment,
    openQuickModal,
  } = useCRM();
  const { success, error: showError } = useToast();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [clientFilter, setClientFilter] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [viewPayment, setViewPayment] = useState<Payment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Payment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const enrichedPayments = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = payments
      .map((payment) => {
        const client = clientMap.get(payment.client_id);
        const project = projectMap.get(payment.project_id);
        return {
          payment,
          client,
          project,
          clientName: client?.full_name || '—',
          projectName: project?.project_name || '—',
          projectCode: project?.project_code || '—',
        };
      })
      .filter((item) => {
        const { payment, clientName, projectName, projectCode } = item;
        if (projectFilter !== 'ALL' && payment.project_id !== projectFilter) return false;
        if (clientFilter !== 'ALL' && payment.client_id !== clientFilter) return false;
        if (methodFilter !== 'ALL' && payment.payment_method !== methodFilter) return false;
        if (typeFilter !== 'ALL' && payment.payment_type !== typeFilter) return false;
        if (startDate && payment.payment_date < startDate) return false;
        if (endDate && payment.payment_date > endDate) return false;

        if (!q) return true;
        return (
          payment.receipt_number.toLowerCase().includes(q) ||
          payment.payment_code.toLowerCase().includes(q) ||
          clientName.toLowerCase().includes(q) ||
          projectName.toLowerCase().includes(q) ||
          projectCode.toLowerCase().includes(q) ||
          (payment.transaction_reference &&
            payment.transaction_reference.toLowerCase().includes(q))
        );
      });

    list.sort((a, b) => {
      const cmp = a.payment.payment_date.localeCompare(b.payment.payment_date);
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [
    payments,
    clientMap,
    projectMap,
    search,
    projectFilter,
    clientFilter,
    methodFilter,
    typeFilter,
    startDate,
    endDate,
    sortAsc,
  ]);

  const totalPages = Math.max(1, Math.ceil(enrichedPayments.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedPayments = useMemo(
    () =>
      enrichedPayments.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [enrichedPayments, currentPage, pageSize]
  );

  const totalCollectedInScope = useMemo(
    () => safeSum(enrichedPayments.map((item) => item.payment.amount)),
    [enrichedPayments]
  );

  const totalOutstandingAcrossPortfolio = useMemo(() => {
    const summaries = Array.from(projectFinancialMap.values());
    return safeSum(summaries.map((s) => s.outstandingBalance));
  }, [projectFinancialMap]);

  const handleDownloadReceipt = async (payment: Payment) => {
    const client = clientMap.get(payment.client_id);
    const project = projectMap.get(payment.project_id);
    if (!client || !project) {
      showError('Missing Context', 'Associated client or project record not found.');
      return;
    }
    const allProjectPayments = payments.filter((p) => p.project_id === project.id);
    await exportPaymentReceiptPDF({
      payment,
      project,
      client,
      allProjectPayments,
      settings,
    });
    success(
      'Payment Receipt Exported',
      `Generated official payment receipt ${payment.receipt_number}.`
    );
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await archivePayment(deleteTarget.id);
      success(
        'Payment Removed',
        `Receipt ${deleteTarget.receipt_number} archived and project balances updated.`
      );
      setDeleteTarget(null);
    } catch (err: any) {
      showError('Delete Failed', err?.message || 'Could not remove payment.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getFilterScope = () => {
    const parts: string[] = [];
    if (clientFilter !== 'ALL') {
      const c = clientMap.get(clientFilter);
      if (c) parts.push(`Client: ${c.full_name}`);
    }
    if (projectFilter !== 'ALL') {
      const p = projectMap.get(projectFilter);
      if (p) parts.push(`Project: ${p.project_name}`);
    }
    if (methodFilter !== 'ALL') parts.push(`Method: ${methodFilter}`);
    if (typeFilter !== 'ALL') parts.push(`Type: ${typeFilter}`);
    if (startDate || endDate) parts.push(`Dates: ${startDate || 'Start'} to ${endDate || 'Present'}`);
    return parts.length ? parts.join(' | ') : 'All Confirmed Payments';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-display tracking-tight">
            Payments &amp; Receipt Ledger
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Track client advances, milestone instalments, settlements, and generate official PDF payment receipts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              exportPaymentsPDF({
                payments: enrichedPayments,
                settings,
                filterScope: getFilterScope(),
              })
            }
            disabled={enrichedPayments.length === 0}
            className="akd-btn-secondary h-[34px] px-3 text-xs"
          >
            <FileDown className="w-3.5 h-3.5 text-indigo-600" /> Export PDF
          </button>
          <button
            type="button"
            onClick={() =>
              exportPaymentsExcel({
                payments: enrichedPayments,
                settings,
                filterScope: getFilterScope(),
              })
            }
            disabled={enrichedPayments.length === 0}
            className="akd-btn-secondary h-[34px] px-3 text-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Export Excel
          </button>
          <button
            type="button"
            onClick={() => openQuickModal({ type: 'payment' })}
            className="akd-btn-primary h-[34px] px-3.5 text-xs"
          >
            <PlusCircle className="w-3.5 h-3.5" /> Record Payment
          </button>
        </div>
      </div>

      {/* Financial Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="akd-card p-4">
          <span className="text-xs text-slate-600 font-medium">Receipts in Selected Scope</span>
          <p className="text-2xl font-bold text-slate-900 font-display mt-1 tabular-nums">
            {enrichedPayments.length}
          </p>
        </div>
        <div className="akd-card p-4">
          <span className="text-xs text-slate-600 font-medium">Confirmed Payments Received (Scope)</span>
          <p className="text-2xl font-bold text-emerald-600 font-display mt-1 tabular-nums">
            {formatINR(totalCollectedInScope)}
          </p>
        </div>
        <div className="akd-card p-4">
          <span className="text-xs text-slate-600 font-medium">Total Portfolio Outstanding Balance</span>
          <p className="text-2xl font-bold text-amber-600 font-display mt-1 tabular-nums">
            {formatINR(totalOutstandingAcrossPortfolio)}
          </p>
        </div>
      </div>

      {/* Swipe Horizontal Filter Pills (Instant Tap Filtering) */}
      <div className="swipe-pill-scroll">
        <button
          type="button"
          onClick={() => {
            setMethodFilter('ALL');
            setTypeFilter('ALL');
            setPage(1);
          }}
          className={`swipe-pill-item ${
            methodFilter === 'ALL' && typeFilter === 'ALL' ? 'active' : ''
          }`}
        >
          All ({payments.length})
        </button>
        {PAYMENT_METHODS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMethodFilter(methodFilter === m ? 'ALL' : m);
              setPage(1);
            }}
            className={`swipe-pill-item ${methodFilter === m ? 'active' : ''}`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Search & Multi-Filter Bar */}
      <div className="akd-card p-3.5 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by receipt number, client name, project, or UTR/reference..."
              className="akd-input pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={clientFilter}
              onChange={(e) => {
                setClientFilter(e.target.value);
                setPage(1);
              }}
              className="akd-select w-auto min-w-[145px]"
              aria-label="Filter by client"
            >
              <option value="ALL">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>

            <select
              value={projectFilter}
              onChange={(e) => {
                setProjectFilter(e.target.value);
                setPage(1);
              }}
              className="akd-select w-auto min-w-[150px]"
              aria-label="Filter by project"
            >
              <option value="ALL">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_name}
                </option>
              ))}
            </select>

            <select
              value={methodFilter}
              onChange={(e) => {
                setMethodFilter(e.target.value);
                setPage(1);
              }}
              className="akd-select w-auto min-w-[130px]"
              aria-label="Filter by payment method"
            >
              <option value="ALL">All Methods</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="akd-select w-auto min-w-[130px]"
              aria-label="Filter by payment type"
            >
              <option value="ALL">All Types</option>
              {PAYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-600 font-medium">Payment Date Range:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="h-7.5 px-2 rounded-md border border-slate-200 bg-white text-xs text-slate-800"
              aria-label="From date"
            />
            <span className="text-slate-400 text-[11px]">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="h-7.5 px-2 rounded-md border border-slate-200 bg-white text-xs text-slate-800"
              aria-label="To date"
            />
          </div>

          {(search ||
            projectFilter !== 'ALL' ||
            clientFilter !== 'ALL' ||
            methodFilter !== 'ALL' ||
            typeFilter !== 'ALL' ||
            startDate ||
            endDate) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setProjectFilter('ALL');
                setClientFilter('ALL');
                setMethodFilter('ALL');
                setTypeFilter('ALL');
                setStartDate('');
                setEndDate('');
                setPage(1);
              }}
              className="text-xs font-semibold text-[#5448ED] hover:underline"
            >
              Clear All Filters
            </button>
          )}
        </div>
      </div>

      {/* Payments Table */}
      <div className="akd-card overflow-hidden">
        {enrichedPayments.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-900">
              No payment records match your current selection
            </p>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              Record a confirmed payment against a project or clear your active filters.
            </p>
            <button
              type="button"
              onClick={() => openQuickModal({ type: 'payment' })}
              className="akd-btn-primary h-[34px] text-xs mt-1"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Record Payment
            </button>
          </div>
        ) : (
          <>
            {/* Mobile & Tablet Payment Cards (Swipe App Style) */}
            <div className="lg:hidden p-3 space-y-3 bg-slate-50/40">
              {paginatedPayments.map((item) => {
                const { payment, client, project } = item;
                return (
                  <div
                    key={payment.id}
                    className="swipe-list-card bg-white"
                  >
                    {/* Top Row: Client Name, Receipt & Big Green Amount */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 text-sm truncate block">
                          {item.clientName}
                        </span>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                          <span className="font-mono font-medium">{payment.receipt_number}</span>
                          <span>&bull;</span>
                          <span>{formatDate(payment.payment_date)}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-base font-extrabold text-emerald-600 font-display tabular-nums block">
                          +{formatINR(payment.amount)}
                        </span>
                        <span className="inline-block mt-0.5 px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full">
                          {payment.payment_method}
                        </span>
                      </div>
                    </div>

                    {/* Project & Notes */}
                    <div className="flex flex-wrap items-center justify-between gap-2 py-1.5 border-y border-slate-100 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                        <span className="text-slate-400 font-medium">Project:</span>
                        <span className="font-medium text-slate-800 truncate">{item.projectName}</span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {payment.payment_type}
                      </span>
                    </div>

                    {payment.transaction_reference && (
                      <div className="text-[11px] text-slate-500 bg-slate-50 rounded-lg px-2 py-1 font-mono">
                        Ref: {payment.transaction_reference}
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleDownloadReceipt(payment)}
                        className="swipe-card-action-btn call"
                        title="Download Receipt PDF"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        <span>Receipt PDF</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setViewPayment(payment)}
                          className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            openQuickModal({
                              type: 'payment',
                              editPayment: payment,
                            })
                          }
                          className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                          title="Edit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(payment)}
                          className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100"
                          title="Archive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Full Table View (Visible on >= 1024px) */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                    <th className="py-3 px-4">Receipt &amp; ID</th>
                    <th className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => setSortAsc((p) => !p)}
                        className="inline-flex items-center gap-1 hover:text-slate-900"
                      >
                        Payment Date <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Associated Project</th>
                    <th className="py-3 px-4">Type &amp; Method</th>
                    <th className="py-3 px-4">Transaction Ref.</th>
                    <th className="py-3 px-4 text-right">Amount Received</th>
                    <th className="py-3 px-4 text-right">Receipt &amp; Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {paginatedPayments.map(({ payment, clientName, projectName, projectCode }) => (
                    <tr key={payment.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-semibold text-slate-900 block">
                          {payment.receipt_number}
                        </span>
                        <span className="text-[11px] font-mono text-slate-600">
                          {payment.payment_code}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-800 whitespace-nowrap">
                        {formatDate(payment.payment_date, settings.date_format)}
                      </td>

                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => navigate(`/clients/${payment.client_id}`)}
                          className="font-medium text-slate-900 hover:text-[#5448ED] hover:underline text-left"
                        >
                          {clientName}
                        </button>
                      </td>

                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => navigate(`/projects/${payment.project_id}`)}
                          className="font-medium text-slate-900 hover:text-[#5448ED] text-left block"
                        >
                          {projectName}
                        </button>
                        <span className="text-[11px] font-mono text-slate-600">
                          {projectCode}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <Badge variant="indigo">{payment.payment_type}</Badge>
                        <span className="block text-[11px] text-slate-600 mt-1">
                          via {payment.payment_method}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                        {payment.transaction_reference || '—'}
                      </td>

                      <td className="py-3.5 px-4 text-right tabular-nums font-bold text-emerald-600">
                        {formatINR(payment.amount)}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDownloadReceipt(payment)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold transition-colors shadow-xs"
                            title="Export Official Payment Receipt PDF"
                          >
                            <FileText className="w-3 h-3 text-[#5448ED]" /> Receipt PDF
                          </button>

                          <button
                            type="button"
                            onClick={() => setViewPayment(payment)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            title="View Payment Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              openQuickModal({
                                type: 'payment',
                                editPayment: payment,
                              })
                            }
                            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            title="Edit Payment"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteTarget(payment)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete / Archive Payment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span>
                  Showing {(currentPage - 1) * pageSize + 1}&ndash;
                  {Math.min(currentPage * pageSize, enrichedPayments.length)} of{' '}
                  {enrichedPayments.length} payments
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-7 px-2 rounded-md border border-slate-200 bg-white text-slate-800 text-xs"
                  aria-label="Rows per page"
                >
                  <option value={10}>10 / page</option>
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-7 px-2.5 rounded-md border border-slate-200 bg-white text-slate-700 disabled:opacity-40 inline-flex items-center gap-1 hover:bg-slate-50"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <span className="px-2 font-medium text-slate-800">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="h-7 px-2.5 rounded-md border border-slate-200 bg-white text-slate-700 disabled:opacity-40 inline-flex items-center gap-1 hover:bg-slate-50"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Payment Details Modal */}
      <Modal
        isOpen={Boolean(viewPayment)}
        onClose={() => setViewPayment(null)}
        title={viewPayment ? `Payment Receipt — ${viewPayment.receipt_number}` : 'Payment Details'}
        subtitle="Official payment acknowledgment record"
        size="md"
        footer={
          viewPayment ? (
            <>
              <button
                type="button"
                onClick={() => setViewPayment(null)}
                className="akd-btn-secondary h-9 text-xs"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleDownloadReceipt(viewPayment)}
                className="akd-btn-primary h-9 text-xs"
              >
                <FileText className="w-3.5 h-3.5" /> Export Payment Receipt PDF
              </button>
            </>
          ) : undefined
        }
      >
        {viewPayment && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
                  Confirmed Amount Received
                </span>
                <span className="text-2xl font-bold text-slate-900 font-display tabular-nums mt-0.5 block">
                  {formatINR(viewPayment.amount)}
                </span>
              </div>
              <Badge variant="indigo">{viewPayment.payment_type}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-white border border-slate-200">
              <div>
                <span className="text-slate-500 block">Receipt Number</span>
                <span className="font-mono font-semibold text-slate-900">
                  {viewPayment.receipt_number}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Payment ID</span>
                <span className="font-mono text-slate-900">{viewPayment.payment_code}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Payment Date</span>
                <span className="font-medium text-slate-900">
                  {formatDate(viewPayment.payment_date, settings.date_format)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Payment Method</span>
                <span className="font-medium text-slate-900">
                  {viewPayment.payment_method}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500 block">Client &amp; Project</span>
                <span className="font-semibold text-slate-900">
                  {clientMap.get(viewPayment.client_id)?.full_name || '—'} &bull;{' '}
                  {projectMap.get(viewPayment.project_id)?.project_name || '—'}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500 block">Transaction Reference</span>
                <span className="font-mono text-slate-900">
                  {viewPayment.transaction_reference || 'Not provided'}
                </span>
              </div>
              {viewPayment.notes && (
                <div className="col-span-2">
                  <span className="text-slate-500 block">Payment Notes</span>
                  <p className="text-slate-700 mt-0.5">{viewPayment.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        title="Remove Payment Record"
        description={
          deleteTarget
            ? `Are you sure you want to remove payment receipt ${deleteTarget.receipt_number} (${formatINR(deleteTarget.amount)})? The associated project's outstanding balance and studio cash flow metrics will be recalculated immediately.`
            : ''
        }
        confirmLabel="Remove Payment"
      />
      {/* Swipe Page Floating Action Button (Mobile & Tablet) */}
      <button
        type="button"
        onClick={() => openQuickModal({ type: 'payment' })}
        className="swipe-page-fab"
        title="Record New Payment"
      >
        <Plus className="w-4 h-4 stroke-[3]" />
        <span>+ Payment</span>
      </button>
    </div>
  );
};
