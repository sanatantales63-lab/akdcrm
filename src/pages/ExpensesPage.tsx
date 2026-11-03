import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Receipt,
  FileDown,
  FileSpreadsheet,
  ArrowUpDown,
  Edit3,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { useCRM } from '@/context/CRMContext';
import { useToast } from '@/context/ToastContext';
import { Expense } from '@/types/crm';
import {
  formatDate,
  formatINR,
  safePercentage,
  safeSum,
} from '@/lib/formatters';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { exportExpensesExcel, exportExpensesPDF } from '@/lib/exporters';

export const ExpensesPage: React.FC = () => {
  const {
    settings,
    projects,
    expenses,
    archiveExpense,
    openQuickModal,
  } = useCRM();
  const { success, error: showError } = useToast();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [viewExpense, setViewExpense] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const enrichedExpenses = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = expenses
      .map((expense) => {
        const project = expense.project_id ? projectMap.get(expense.project_id) : undefined;
        return {
          expense,
          project,
          projectName: project?.project_name,
          projectCode: project?.project_code,
        };
      })
      .filter((item) => {
        const { expense, projectName, projectCode } = item;
        if (categoryFilter !== 'ALL' && expense.category !== categoryFilter) return false;
        if (projectFilter === 'OVERHEAD' && expense.project_id) return false;
        if (
          projectFilter !== 'ALL' &&
          projectFilter !== 'OVERHEAD' &&
          expense.project_id !== projectFilter
        ) {
          return false;
        }
        if (startDate && expense.expense_date < startDate) return false;
        if (endDate && expense.expense_date > endDate) return false;

        if (!q) return true;
        return (
          expense.title.toLowerCase().includes(q) ||
          expense.expense_code.toLowerCase().includes(q) ||
          expense.category.toLowerCase().includes(q) ||
          (expense.vendor_name && expense.vendor_name.toLowerCase().includes(q)) ||
          (expense.reference_number &&
            expense.reference_number.toLowerCase().includes(q)) ||
          (projectName && projectName.toLowerCase().includes(q)) ||
          (projectCode && projectCode.toLowerCase().includes(q))
        );
      });

    list.sort((a, b) => {
      const cmp = a.expense.expense_date.localeCompare(b.expense.expense_date);
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [
    expenses,
    projectMap,
    search,
    categoryFilter,
    projectFilter,
    startDate,
    endDate,
    sortAsc,
  ]);

  const totalPages = Math.max(1, Math.ceil(enrichedExpenses.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedExpenses = useMemo(
    () =>
      enrichedExpenses.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [enrichedExpenses, currentPage, pageSize]
  );

  // Expense Analytics Breakdown
  const expenseMetrics = useMemo(() => {
    const totalScopeExpenses = safeSum(enrichedExpenses.map((e) => e.expense.amount));
    const currentMonthKey = format(new Date(), 'yyyy-MM');
    const currentMonthExpenses = safeSum(
      expenses
        .filter((e) => e.expense_date.startsWith(currentMonthKey))
        .map((e) => e.amount)
    );
    const projectLinkedExpenses = safeSum(
      enrichedExpenses
        .filter((e) => Boolean(e.expense.project_id))
        .map((e) => e.expense.amount)
    );

    // Category-wise breakdown
    const catMap = new Map<string, number>();
    enrichedExpenses.forEach(({ expense }) => {
      catMap.set(
        expense.category,
        safeSum([catMap.get(expense.category) || 0, expense.amount])
      );
    });

    const categoryBreakdown = Array.from(catMap.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        pct: safePercentage(amount, totalScopeExpenses),
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      totalScopeExpenses,
      currentMonthExpenses,
      projectLinkedExpenses,
      categoryBreakdown,
    };
  }, [enrichedExpenses, expenses]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await archiveExpense(deleteTarget.id);
      success(
        'Expense Removed',
        `Archived expense "${deleteTarget.title}" (${deleteTarget.expense_code}).`
      );
      setDeleteTarget(null);
    } catch (err: any) {
      showError('Delete Failed', err?.message || 'Could not remove expense.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getFilterScope = () => {
    const parts: string[] = [];
    if (categoryFilter !== 'ALL') parts.push(`Category: ${categoryFilter}`);
    if (projectFilter === 'OVERHEAD') parts.push('Studio Overhead Only');
    else if (projectFilter !== 'ALL') {
      const p = projectMap.get(projectFilter);
      if (p) parts.push(`Project: ${p.project_name}`);
    }
    if (startDate || endDate)
      parts.push(`Dates: ${startDate || 'Start'} to ${endDate || 'Present'}`);
    return parts.length ? parts.join(' | ') : 'All Recorded Expenses';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-display tracking-tight">
            Expense &amp; Expenditure Tracking
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Record materials, labour, contractor payouts, and studio overheads separately from client receivables.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              exportExpensesPDF({
                expenses: enrichedExpenses,
                settings,
                filterScope: getFilterScope(),
              })
            }
            disabled={enrichedExpenses.length === 0}
            className="akd-btn-secondary h-[34px] px-3 text-xs"
          >
            <FileDown className="w-3.5 h-3.5 text-indigo-600" /> Export PDF
          </button>
          <button
            type="button"
            onClick={() =>
              exportExpensesExcel({
                expenses: enrichedExpenses,
                settings,
                filterScope: getFilterScope(),
              })
            }
            disabled={enrichedExpenses.length === 0}
            className="akd-btn-secondary h-[34px] px-3 text-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Export Excel
          </button>
          <button
            type="button"
            onClick={() => openQuickModal({ type: 'expense' })}
            className="akd-btn-primary h-[34px] px-3.5 text-xs"
          >
            <Receipt className="w-3.5 h-3.5" /> Record Expense
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="akd-card p-4">
          <span className="text-xs text-slate-600 font-medium">Total Recorded Expenses (Scope)</span>
          <p className="text-2xl font-bold text-slate-900 font-display mt-1 tabular-nums">
            {formatINR(expenseMetrics.totalScopeExpenses)}
          </p>
          <p className="text-[11px] text-slate-600 mt-1">
            Across {enrichedExpenses.length} expense vouchers
          </p>
        </div>

        <div className="akd-card p-4">
          <span className="text-xs text-slate-600 font-medium">Current Month Expenditure</span>
          <p className="text-2xl font-bold text-slate-900 font-display mt-1 tabular-nums">
            {formatINR(expenseMetrics.currentMonthExpenses)}
          </p>
          <p className="text-[11px] text-slate-600 mt-1">
            Recorded in {format(new Date(), 'MMMM yyyy')}
          </p>
        </div>

        <div className="akd-card p-4">
          <span className="text-xs text-slate-600 font-medium">Project-Specific Expenses</span>
          <p className="text-2xl font-bold text-rose-600 font-display mt-1 tabular-nums">
            {formatINR(expenseMetrics.projectLinkedExpenses)}
          </p>
          <p className="text-[11px] text-slate-600 mt-1">
            Direct site &amp; project expenditure
          </p>
        </div>
      </div>

      {/* Category-Wise Breakdown Bar */}
      {expenseMetrics.categoryBreakdown.length > 0 && (
        <div className="akd-card p-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            Category-Wise Expenditure Breakdown
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {expenseMetrics.categoryBreakdown.map((item) => (
              <div
                key={item.category}
                className="p-3 rounded-lg bg-slate-50 border border-slate-200/80"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 truncate">
                    {item.category}
                  </span>
                  <span className="text-[11px] text-slate-600 tabular-nums">
                    {item.pct}%
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-900 tabular-nums mt-1">
                  {formatINR(item.amount)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filters */}
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
              placeholder="Search by expense title, vendor, ID, project, or reference..."
              className="akd-input pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="akd-select w-auto min-w-[150px]"
              aria-label="Filter by expense category"
            >
              <option value="ALL">All Categories</option>
              {settings.expense_categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <select
              value={projectFilter}
              onChange={(e) => {
                setProjectFilter(e.target.value);
                setPage(1);
              }}
              className="akd-select w-auto min-w-[170px]"
              aria-label="Filter by project"
            >
              <option value="ALL">All Projects &amp; Overhead</option>
              <option value="OVERHEAD">General Studio Overhead Only</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-600 font-medium">Expense Date Range:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="h-7.5 px-2 rounded-md border border-slate-200 bg-white text-xs text-slate-800"
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
            />
          </div>

          {(search ||
            categoryFilter !== 'ALL' ||
            projectFilter !== 'ALL' ||
            startDate ||
            endDate) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setCategoryFilter('ALL');
                setProjectFilter('ALL');
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

      {/* Expenses Table */}
      <div className="akd-card overflow-hidden">
        {enrichedExpenses.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-900">
              No expense records match your current criteria
            </p>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              Record a business or site expenditure entry or reset your filters.
            </p>
            <button
              type="button"
              onClick={() => openQuickModal({ type: 'expense' })}
              className="akd-btn-primary h-[34px] text-xs mt-1"
            >
              <Receipt className="w-3.5 h-3.5" /> Record Expense
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                    <th className="py-3 px-4">Expense &amp; ID</th>
                    <th className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => setSortAsc((p) => !p)}
                        className="inline-flex items-center gap-1 hover:text-slate-900"
                      >
                        Date <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Associated Project</th>
                    <th className="py-3 px-4">Vendor / Payee</th>
                    <th className="py-3 px-4">Method &amp; Ref</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {paginatedExpenses.map(({ expense, projectName, projectCode }) => (
                    <tr key={expense.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-900 block">
                          {expense.title}
                        </span>
                        <span className="text-[11px] font-mono text-slate-600">
                          {expense.expense_code}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-800 whitespace-nowrap">
                        {formatDate(expense.expense_date, settings.date_format)}
                      </td>

                      <td className="py-3.5 px-4">
                        <Badge variant="default">{expense.category}</Badge>
                      </td>

                      <td className="py-3.5 px-4">
                        {expense.project_id && projectName ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/projects/${expense.project_id}`)}
                            className="text-left font-medium text-slate-900 hover:text-[#5448ED]"
                          >
                            <span className="block">{projectName}</span>
                            <span className="text-[11px] font-mono text-slate-600">
                              {projectCode}
                            </span>
                          </button>
                        ) : (
                          <span className="text-slate-600">General Overhead</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-800">
                        {expense.vendor_name || '—'}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        <span className="block">{expense.payment_method}</span>
                        {expense.reference_number && (
                          <span className="text-[11px] font-mono text-slate-600">
                            {expense.reference_number}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right tabular-nums font-bold text-slate-900">
                        {formatINR(expense.amount)}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setViewExpense(expense)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              openQuickModal({
                                type: 'expense',
                                editExpense: expense,
                              })
                            }
                            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            title="Edit Expense"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(expense)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete / Archive Expense"
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
                  {Math.min(currentPage * pageSize, enrichedExpenses.length)} of{' '}
                  {enrichedExpenses.length} expenses
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

      {/* Expense Details Modal */}
      <Modal
        isOpen={Boolean(viewExpense)}
        onClose={() => setViewExpense(null)}
        title={viewExpense ? `Expense Voucher — ${viewExpense.expense_code}` : 'Expense Details'}
        size="md"
        footer={
          <button
            type="button"
            onClick={() => setViewExpense(null)}
            className="akd-btn-secondary h-9 text-xs"
          >
            Close
          </button>
        }
      >
        {viewExpense && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
                  Recorded Expense Amount
                </span>
                <span className="text-2xl font-bold text-slate-900 font-display tabular-nums mt-0.5 block">
                  {formatINR(viewExpense.amount)}
                </span>
              </div>
              <Badge variant="default">{viewExpense.category}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-white border border-slate-200">
              <div className="col-span-2">
                <span className="text-slate-500 block">Expense Title</span>
                <span className="font-semibold text-slate-900">{viewExpense.title}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Expense Date</span>
                <span className="font-medium text-slate-900">
                  {formatDate(viewExpense.expense_date, settings.date_format)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Payment Method</span>
                <span className="font-medium text-slate-900">
                  {viewExpense.payment_method}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Vendor / Payee</span>
                <span className="font-medium text-slate-900">
                  {viewExpense.vendor_name || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Reference / Invoice No.</span>
                <span className="font-mono text-slate-900">
                  {viewExpense.reference_number || '—'}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500 block">Associated Project</span>
                <span className="font-medium text-slate-900">
                  {viewExpense.project_id
                    ? projectMap.get(viewExpense.project_id)?.project_name || '—'
                    : 'General Studio Overhead'}
                </span>
              </div>
              {viewExpense.notes && (
                <div className="col-span-2">
                  <span className="text-slate-500 block">Notes</span>
                  <p className="text-slate-700 mt-0.5">{viewExpense.notes}</p>
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
        title="Remove Expense Record"
        description={
          deleteTarget
            ? `Are you sure you want to remove expense "${deleteTarget.title}" (${formatINR(deleteTarget.amount)})?`
            : ''
        }
        confirmLabel="Remove Expense"
      />
    </div>
  );
};
