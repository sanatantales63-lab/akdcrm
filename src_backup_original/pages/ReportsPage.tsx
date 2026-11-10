import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileDown,
  FileSpreadsheet,
  Calendar,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  BarChart3,
  Layers,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { format, parseISO, isValid } from 'date-fns';
import { useCRM } from '@/context/CRMContext';
import { useToast } from '@/context/ToastContext';
import {
  ACTIVE_PROJECT_STATUSES,
  DateFilterRange,
  DatePreset,
  PROJECT_STATUSES,
} from '@/types/crm';
import {
  formatDate,
  formatINR,
  formatINRCompact,
  getDateFilterBounds,
  getDeadlineInfo,
  isDateInRange,
  safePercentage,
  safeSubtract,
  safeSum,
} from '@/lib/formatters';
import { Badge, getProjectStatusVariant } from '@/components/ui/Badge';
import {
  exportComprehensiveReportExcel,
  exportComprehensiveReportPDF,
} from '@/lib/exporters';

export const ReportsPage: React.FC = () => {
  const {
    settings,
    clients,
    enquiries,
    projects,
    payments,
    expenses,
    projectFinancials,
  } = useCRM();
  const { success } = useToast();
  const navigate = useNavigate();

  const [dateFilter, setDateFilter] = useState<DateFilterRange>({ preset: 'fy' });
  const [clientFilter, setClientFilter] = useState('ALL');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('ALL');

  const filterBounds = useMemo(
    () => getDateFilterBounds(dateFilter, settings.financial_year_start_month),
    [dateFilter, settings.financial_year_start_month]
  );

  // Scoped Projects
  const scopedProjectFinancials = useMemo(() => {
    return projectFinancials.filter((pf) => {
      if (clientFilter !== 'ALL' && pf.project.client_id !== clientFilter) return false;
      if (projectFilter !== 'ALL' && pf.project.id !== projectFilter) return false;
      if (statusFilter !== 'ALL' && pf.project.status !== statusFilter) return false;
      return true;
    });
  }, [projectFinancials, clientFilter, projectFilter, statusFilter]);

  const scopedProjectIdSet = useMemo(
    () => new Set(scopedProjectFinancials.map((pf) => pf.project.id)),
    [scopedProjectFinancials]
  );

  // Scoped Payments
  const scopedPayments = useMemo(() => {
    return payments.filter((pay) => {
      if (!isDateInRange(pay.payment_date, dateFilter, settings.financial_year_start_month)) {
        return false;
      }
      if (clientFilter !== 'ALL' && pay.client_id !== clientFilter) return false;
      if (projectFilter !== 'ALL' && pay.project_id !== projectFilter) return false;
      if (statusFilter !== 'ALL' && !scopedProjectIdSet.has(pay.project_id)) return false;
      return true;
    });
  }, [
    payments,
    dateFilter,
    settings.financial_year_start_month,
    clientFilter,
    projectFilter,
    statusFilter,
    scopedProjectIdSet,
  ]);

  // Scoped Expenses
  const scopedExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      if (!isDateInRange(exp.expense_date, dateFilter, settings.financial_year_start_month)) {
        return false;
      }
      if (expenseCategoryFilter !== 'ALL' && exp.category !== expenseCategoryFilter) {
        return false;
      }
      if (projectFilter !== 'ALL' && exp.project_id !== projectFilter) return false;
      if (clientFilter !== 'ALL') {
        if (!exp.project_id || !scopedProjectIdSet.has(exp.project_id)) return false;
      }
      if (statusFilter !== 'ALL') {
        if (!exp.project_id || !scopedProjectIdSet.has(exp.project_id)) return false;
      }
      return true;
    });
  }, [
    expenses,
    dateFilter,
    settings.financial_year_start_month,
    expenseCategoryFilter,
    projectFilter,
    clientFilter,
    statusFilter,
    scopedProjectIdSet,
  ]);

  // Scoped Enquiries
  const scopedEnquiries = useMemo(() => {
    return enquiries.filter((enq) =>
      isDateInRange(enq.enquiry_date, dateFilter, settings.financial_year_start_month)
    );
  }, [enquiries, dateFilter, settings.financial_year_start_month]);

  // Financial Report Metrics
  const financialMetrics = useMemo(() => {
    const totalProjectValue = safeSum(scopedProjectFinancials.map((pf) => pf.totalValue));
    const totalPaymentsReceived = safeSum(scopedPayments.map((p) => p.amount));
    const totalOutstandingReceivables = safeSum(
      scopedProjectFinancials.map((pf) => pf.outstandingBalance)
    );
    const totalRecordedExpenses = safeSum(scopedExpenses.map((e) => e.amount));
    const netRecordedCashFlow = safeSubtract(
      totalPaymentsReceived,
      totalRecordedExpenses
    );

    return {
      totalProjectValue,
      totalPaymentsReceived,
      totalOutstandingReceivables,
      totalRecordedExpenses,
      netRecordedCashFlow,
    };
  }, [scopedProjectFinancials, scopedPayments, scopedExpenses]);

  // Operational Report Metrics
  const operationalMetrics = useMemo(() => {
    const activeProjects = scopedProjectFinancials.filter((pf) =>
      ACTIVE_PROJECT_STATUSES.includes(pf.project.status)
    ).length;
    const completedProjects = scopedProjectFinancials.filter(
      (pf) => pf.project.status === 'Completed'
    ).length;
    const onHoldProjects = scopedProjectFinancials.filter(
      (pf) => pf.project.status === 'On Hold'
    ).length;
    const overdueProjects = scopedProjectFinancials.filter((pf) => {
      const info = getDeadlineInfo(
        pf.project.expected_completion_date,
        pf.project.status
      );
      return info.isOverdue;
    }).length;

    const newEnquiries = scopedEnquiries.length;
    const convertedEnquiries = scopedEnquiries.filter(
      (e) => e.status === 'Converted'
    ).length;
    const conversionRate = safePercentage(convertedEnquiries, newEnquiries);

    return {
      activeProjects,
      completedProjects,
      onHoldProjects,
      overdueProjects,
      newEnquiries,
      convertedEnquiries,
      conversionRate,
    };
  }, [scopedProjectFinancials, scopedEnquiries]);

  // Monthly Payment Collection & Monthly Expense Summary
  const monthlySeries = useMemo(() => {
    const map = new Map<
      string,
      { sortKey: string; month: string; paymentsReceived: number; expenses: number }
    >();

    scopedPayments.forEach((pay) => {
      try {
        const d = parseISO(pay.payment_date);
        if (!isValid(d)) return;
        const sortKey = format(d, 'yyyy-MM');
        const month = format(d, 'MMM yyyy');
        const entry = map.get(sortKey) || {
          sortKey,
          month,
          paymentsReceived: 0,
          expenses: 0,
        };
        entry.paymentsReceived = safeSum([entry.paymentsReceived, pay.amount]);
        map.set(sortKey, entry);
      } catch {
        // ignore
      }
    });

    scopedExpenses.forEach((exp) => {
      try {
        const d = parseISO(exp.expense_date);
        if (!isValid(d)) return;
        const sortKey = format(d, 'yyyy-MM');
        const month = format(d, 'MMM yyyy');
        const entry = map.get(sortKey) || {
          sortKey,
          month,
          paymentsReceived: 0,
          expenses: 0,
        };
        entry.expenses = safeSum([entry.expenses, exp.amount]);
        map.set(sortKey, entry);
      } catch {
        // ignore
      }
    });

    return Array.from(map.values())
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map((item) => ({
        ...item,
        netCashFlow: safeSubtract(item.paymentsReceived, item.expenses),
      }));
  }, [scopedPayments, scopedExpenses]);

  // Upcoming Project Deadlines
  const upcomingDeadlines = useMemo(() => {
    return scopedProjectFinancials
      .filter(
        (pf) =>
          pf.project.expected_completion_date &&
          pf.project.status !== 'Completed' &&
          pf.project.status !== 'Cancelled'
      )
      .map((pf) => ({
        ...pf,
        deadline: getDeadlineInfo(pf.project.expected_completion_date, pf.project.status),
      }))
      .sort(
        (a, b) =>
          (a.deadline.daysRemaining ?? 9999) - (b.deadline.daysRemaining ?? 9999)
      );
  }, [scopedProjectFinancials]);

  const filterScopeLabel = useMemo(() => {
    const parts: string[] = [filterBounds.label];
    if (clientFilter !== 'ALL') {
      const c = clients.find((cl) => cl.id === clientFilter);
      if (c) parts.push(`Client: ${c.full_name}`);
    }
    if (projectFilter !== 'ALL') {
      const p = projects.find((pr) => pr.id === projectFilter);
      if (p) parts.push(`Project: ${p.project_name}`);
    }
    if (statusFilter !== 'ALL') parts.push(`Status: ${statusFilter}`);
    if (expenseCategoryFilter !== 'ALL')
      parts.push(`Expense Cat: ${expenseCategoryFilter}`);
    return parts.join(' • ');
  }, [
    filterBounds.label,
    clientFilter,
    projectFilter,
    statusFilter,
    expenseCategoryFilter,
    clients,
    projects,
  ]);

  const handlePresetChange = (preset: DatePreset) => {
    if (preset === 'custom') {
      setDateFilter({
        preset: 'custom',
        startDate:
          dateFilter.startDate ||
          format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'),
        endDate: dateFilter.endDate || format(new Date(), 'yyyy-MM-dd'),
      });
    } else {
      setDateFilter({ preset });
    }
  };

  const handleExportPDF = async () => {
    await exportComprehensiveReportPDF({
      settings,
      filterScope: filterScopeLabel,
      financialMetrics,
      operationalMetrics,
      projectRows: scopedProjectFinancials,
      monthlySeries,
    });
    success('Report PDF Exported', 'Generated executive financial & operational PDF report.');
  };

  const handleExportExcel = () => {
    exportComprehensiveReportExcel({
      settings,
      filterScope: filterScopeLabel,
      financialMetrics,
      operationalMetrics,
      projectRows: scopedProjectFinancials,
      monthlySeries,
    });
    success('Report Excel Exported', 'Generated multi-sheet .xlsx analytics workbook.');
  };

  return (
    <div className="space-y-6">
      {/* Header (Mixpanel Explorer style) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-display tracking-tight">
            Reports &amp; Business Analytics
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Financial cash flow statements, project-wise profitability tracking, and operational KPIs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportPDF}
            className="akd-btn-secondary h-[34px] px-3.5 text-xs"
          >
            <FileDown className="w-3.5 h-3.5 text-indigo-600" /> Export PDF
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="akd-btn-primary h-[34px] px-3.5 text-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Export Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* Multi-Dimensional Report Filter Panel (Mixpanel Toolbar Style) */}
      <div className="akd-card p-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span>Scope:</span>
            <span className="font-normal text-slate-600">{filterScopeLabel}</span>
          </div>

          <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200/80">
            {(
              [
                { id: '30d', label: '30D' },
                { id: '90d', label: '90D' },
                { id: 'fy', label: 'Current FY' },
                { id: 'all', label: 'All Time' },
                { id: 'custom', label: 'Custom' },
              ] as Array<{ id: DatePreset; label: string }>
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handlePresetChange(item.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  dateFilter.preset === item.id
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {dateFilter.preset === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-slate-100 text-xs">
            <span className="text-slate-600">Custom Period:</span>
            <input
              type="date"
              value={dateFilter.startDate || ''}
              onChange={(e) =>
                setDateFilter((prev) => ({ ...prev, startDate: e.target.value }))
              }
              className="h-7.5 px-2 border border-slate-200 rounded-md bg-white text-xs text-slate-800"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={dateFilter.endDate || ''}
              onChange={(e) =>
                setDateFilter((prev) => ({ ...prev, endDate: e.target.value }))
              }
              className="h-7.5 px-2 border border-slate-200 rounded-md bg-white text-xs text-slate-800"
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2.5 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Filter by Client
            </label>
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="akd-select h-[34px] text-xs"
            >
              <option value="ALL">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Filter by Project
            </label>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="akd-select h-[34px] text-xs"
            >
              <option value="ALL">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_name} ({p.project_code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Filter by Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="akd-select h-[34px] text-xs"
            >
              <option value="ALL">All Project Statuses</option>
              {PROJECT_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Filter by Expense Category
            </label>
            <select
              value={expenseCategoryFilter}
              onChange={(e) => setExpenseCategoryFilter(e.target.value)}
              className="akd-select h-[34px] text-xs"
            >
              <option value="ALL">All Expense Categories</option>
              {settings.expense_categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Section 1: Financial Reports Summary */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          1. Financial Performance Summary
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          <div className="akd-card p-4">
            <span className="text-xs text-slate-600 font-medium">Total Project Value</span>
            <p className="text-2xl font-bold text-slate-900 font-display mt-1 tabular-nums">
              {formatINR(financialMetrics.totalProjectValue)}
            </p>
            <p className="text-[11px] text-slate-600 mt-1">
              Contract value
            </p>
          </div>

          <div className="akd-card p-4">
            <span className="text-xs text-slate-600 font-medium">Payments Received</span>
            <p className="text-2xl font-bold text-emerald-600 font-display mt-1 tabular-nums">
              {formatINR(financialMetrics.totalPaymentsReceived)}
            </p>
            <p className="text-[11px] text-slate-600 mt-1">
              Confirmed collections
            </p>
          </div>

          <div className="akd-card p-4">
            <span className="text-xs text-slate-600 font-medium">Outstanding Balance</span>
            <p className="text-2xl font-bold text-amber-600 font-display mt-1 tabular-nums">
              {formatINR(financialMetrics.totalOutstandingReceivables)}
            </p>
            <p className="text-[11px] text-slate-600 mt-1">
              Uncollected balances
            </p>
          </div>

          <div className="akd-card p-4">
            <span className="text-xs text-slate-600 font-medium">Recorded Expenses</span>
            <p className="text-2xl font-bold text-rose-600 font-display mt-1 tabular-nums">
              {formatINR(financialMetrics.totalRecordedExpenses)}
            </p>
            <p className="text-[11px] text-slate-600 mt-1">
              Expenditure in period
            </p>
          </div>

          <div className="akd-card p-4 bg-indigo-50/40 border-indigo-200/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#5448ED]">
                Net Cash Flow
              </span>
              <TrendingUp className="w-4 h-4 text-[#5448ED]" />
            </div>
            <p
              className={`text-2xl font-bold font-display mt-1 tabular-nums ${
                financialMetrics.netRecordedCashFlow >= 0
                  ? 'text-emerald-600'
                  : 'text-rose-600'
              }`}
            >
              {formatINR(financialMetrics.netRecordedCashFlow)}
            </p>
            <p className="text-[10px] text-slate-600 mt-1">
              Collections minus Expenses
            </p>
          </div>
        </div>
      </div>

      {/* Section 2: Operational Reports */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          2. Operational &amp; Lead Conversion Metrics
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="akd-card p-3.5">
            <span className="text-[11px] text-slate-600 font-medium">Active Projects</span>
            <p className="text-xl font-bold text-slate-900 font-display mt-0.5 tabular-nums">
              {operationalMetrics.activeProjects}
            </p>
          </div>
          <div className="akd-card p-3.5">
            <span className="text-[11px] text-slate-600 font-medium">Completed</span>
            <p className="text-xl font-bold text-emerald-600 font-display mt-0.5 tabular-nums">
              {operationalMetrics.completedProjects}
            </p>
          </div>
          <div className="akd-card p-3.5">
            <span className="text-[11px] text-slate-600 font-medium">On Hold</span>
            <p className="text-xl font-bold text-amber-600 font-display mt-0.5 tabular-nums">
              {operationalMetrics.onHoldProjects}
            </p>
          </div>
          <div className="akd-card p-3.5">
            <span className="text-[11px] text-slate-600 font-medium">Overdue</span>
            <p className="text-xl font-bold text-rose-600 font-display mt-0.5 tabular-nums">
              {operationalMetrics.overdueProjects}
            </p>
          </div>
          <div className="akd-card p-3.5">
            <span className="text-[11px] text-slate-600 font-medium">New Enquiries</span>
            <p className="text-xl font-bold text-slate-900 font-display mt-0.5 tabular-nums">
              {operationalMetrics.newEnquiries}
            </p>
          </div>
          <div className="akd-card p-3.5">
            <span className="text-[11px] text-slate-600 font-medium">Converted</span>
            <p className="text-xl font-bold text-emerald-600 font-display mt-0.5 tabular-nums">
              {operationalMetrics.convertedEnquiries}
            </p>
          </div>
          <div className="akd-card p-3.5 col-span-2 sm:col-span-1">
            <span className="text-[11px] text-slate-600 font-medium">Conversion Rate</span>
            <p className="text-xl font-bold text-indigo-600 font-display mt-0.5 tabular-nums">
              {operationalMetrics.conversionRate}%
            </p>
          </div>
        </div>
      </div>

      {/* Monthly Chart & Statement (Mixpanel Visual Design) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="akd-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 font-display">
                Monthly Collections vs. Expenses
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Cash inflows and outflows grouped by calendar month
              </p>
            </div>
            <BarChart3 className="w-4 h-4 text-indigo-600" />
          </div>

          {monthlySeries.length === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-xs text-slate-600 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              No monthly transactions in the selected filter scope.
            </div>
          ) : (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlySeries} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#64748B', fontSize: 11 }}
                    axisLine={{ stroke: '#E2E8F0' }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => formatINRCompact(Number(v))}
                    tick={{ fill: '#64748B', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={68}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      formatINR(value),
                      name === 'paymentsReceived'
                        ? 'Confirmed Payments Received'
                        : 'Recorded Expenses',
                    ]}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E8F0',
                      borderRadius: '10px',
                      fontSize: '12px',
                      boxShadow: '0 10px 25px -3px rgba(15, 23, 42, 0.1)',
                    }}
                  />
                  <Legend
                    formatter={(val) =>
                      val === 'paymentsReceived'
                        ? 'Confirmed Payments Received'
                        : 'Recorded Expenses'
                    }
                    wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                  />
                  <Bar
                    dataKey="paymentsReceived"
                    fill="#5448ED"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                  />
                  <Bar
                    dataKey="expenses"
                    fill="#F59E0B"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Monthly Ledger Table */}
        <div className="akd-card overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900 font-display">
              Monthly Cash Flow Statement
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Receipts minus expenses by month
            </p>
          </div>

          {monthlySeries.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-600">
              No monthly figures available.
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[290px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                    <th className="py-2.5 px-4">Month</th>
                    <th className="py-2.5 px-3 text-right">Received</th>
                    <th className="py-2.5 px-3 text-right">Expenses</th>
                    <th className="py-2.5 px-4 text-right">Net Flow</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthlySeries.map((m) => (
                    <tr key={m.sortKey} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{m.month}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-emerald-600 font-semibold">
                        {formatINR(m.paymentsReceived)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-rose-600">
                        {formatINR(m.expenses)}
                      </td>
                      <td
                        className={`py-2.5 px-4 text-right tabular-nums font-bold ${
                          m.netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {formatINR(m.netCashFlow)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Project-Wise Financial Report Table */}
      <div className="akd-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 font-display">
              Project-Wise Financial Summary Report
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Complete breakdown of contract value, confirmed payments received, outstanding balance, and project expenses
            </p>
          </div>
          <span className="text-xs text-slate-600 font-medium">
            {scopedProjectFinancials.length} project{scopedProjectFinancials.length === 1 ? '' : 's'}
          </span>
        </div>

        {scopedProjectFinancials.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-600">
            No projects match the selected report filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-4">Project ID</th>
                  <th className="py-3 px-4">Project Name</th>
                  <th className="py-3 px-4">Client Name</th>
                  <th className="py-3 px-4 text-right">Project Value</th>
                  <th className="py-3 px-4 text-right">Payments Received</th>
                  <th className="py-3 px-4 text-right">Outstanding Balance</th>
                  <th className="py-3 px-4 text-right">Recorded Expenses</th>
                  <th className="py-3 px-4">Project Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scopedProjectFinancials.map((pf) => (
                  <tr
                    key={pf.project.id}
                    onClick={() => navigate(`/projects/${pf.project.id}`)}
                    className="hover:bg-slate-50/70 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {pf.project.project_code}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 hover:text-[#5448ED]">
                      {pf.project.project_name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-800">
                      {pf.client?.full_name || '—'}
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
                    <td className="py-3.5 px-4 text-right tabular-nums font-medium text-rose-600">
                      {formatINR(pf.recordedExpenses)}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant={getProjectStatusVariant(pf.project.status)}>
                        {pf.project.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-900">
                  <td className="py-3.5 px-4">TOTAL</td>
                  <td className="py-3.5 px-4">{scopedProjectFinancials.length} Projects</td>
                  <td className="py-3.5 px-4" />
                  <td className="py-3.5 px-4 text-right tabular-nums">
                    {formatINR(safeSum(scopedProjectFinancials.map((p) => p.totalValue)))}
                  </td>
                  <td className="py-3.5 px-4 text-right tabular-nums text-emerald-600">
                    {formatINR(
                      safeSum(scopedProjectFinancials.map((p) => p.paymentsReceived))
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right tabular-nums text-amber-600">
                    {formatINR(
                      safeSum(scopedProjectFinancials.map((p) => p.outstandingBalance))
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right tabular-nums text-rose-600">
                    {formatINR(
                      safeSum(scopedProjectFinancials.map((p) => p.recordedExpenses))
                    )}
                  </td>
                  <td className="py-3.5 px-4" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Upcoming Deadlines Schedule */}
      {upcomingDeadlines.length > 0 && (
        <div className="akd-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900 font-display">
              Upcoming Project Deadlines Schedule
            </h2>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {upcomingDeadlines.map((item) => (
              <div
                key={item.project.id}
                onClick={() => navigate(`/projects/${item.project.id}`)}
                className="px-5 py-3 hover:bg-slate-50/70 cursor-pointer flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {item.deadline.isOverdue ? (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  ) : item.deadline.isApproaching ? (
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-900 truncate block">
                      {item.project.project_name} ({item.project.project_code})
                    </span>
                    <span className="text-slate-600">
                      {item.client?.full_name} &bull; {item.project.progress_percentage}% Complete
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <Badge
                    variant={
                      item.deadline.isOverdue
                        ? 'danger'
                        : item.deadline.isApproaching
                          ? 'warning'
                          : 'default'
                    }
                  >
                    {item.deadline.label}
                  </Badge>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    {formatDate(item.project.expected_completion_date, settings.date_format)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
