import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users,
  FolderKanban,
  IndianRupee,
  Receipt,
  AlertCircle,
  Clock,
  ArrowUpRight,
  UserPlus,
  MessageSquarePlus,
  FolderPlus,
  PlusCircle,
  Calendar,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  TrendingUp,
  BarChart2,
  Layers,
  ChevronRight,
  FileText,
  Activity,
  ShieldCheck,
  ExternalLink,
  Camera,
  Share2,
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
import { format, parseISO, isValid, differenceInCalendarDays } from 'date-fns';
import { useCRM } from '@/context/CRMContext';
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
  isFollowUpOverdue,
  safeSum,
} from '@/lib/formatters';
import {
  Badge,
  getClientStatusVariant,
  getProjectStatusVariant,
} from '@/components/ui/Badge';

export const DashboardPage: React.FC = () => {
  const {
    settings,
    clients,
    enquiries,
    projects,
    payments,
    expenses,
    activityLogs,
    projectFinancials,
    openQuickModal,
    workUpdates,
  } = useCRM();
  const navigate = useNavigate();

  const [dateFilter, setDateFilter] = useState<DateFilterRange>({
    preset: 'fy',
  });

  const filterBounds = useMemo(
    () => getDateFilterBounds(dateFilter, settings.financial_year_start_month),
    [dateFilter, settings.financial_year_start_month]
  );

  const isDatabaseEmpty =
    clients.length === 0 &&
    projects.length === 0 &&
    enquiries.length === 0 &&
    payments.length === 0 &&
    expenses.length === 0;

  // Filtered records for date-scoped analytics
  const filteredPayments = useMemo(
    () =>
      payments.filter((p) =>
        isDateInRange(p.payment_date, dateFilter, settings.financial_year_start_month)
      ),
    [payments, dateFilter, settings.financial_year_start_month]
  );

  const filteredExpenses = useMemo(
    () =>
      expenses.filter((e) =>
        isDateInRange(e.expense_date, dateFilter, settings.financial_year_start_month)
      ),
    [expenses, dateFilter, settings.financial_year_start_month]
  );

  // Authoritative Summary Card Totals
  const summaryMetrics = useMemo(() => {
    const totalClients = clients.length;
    const activeProjects = projects.filter((p) =>
      ACTIVE_PROJECT_STATUSES.includes(p.status)
    ).length;

    const totalProjectValue = safeSum(projectFinancials.map((pf) => pf.totalValue));
    const totalPaymentsReceived =
      dateFilter.preset === 'all'
        ? safeSum(projectFinancials.map((pf) => pf.paymentsReceived))
        : safeSum(filteredPayments.map((p) => p.amount));
    const allTimePaymentsReceived = safeSum(
      projectFinancials.map((pf) => pf.paymentsReceived)
    );
    const totalOutstandingPayments = safeSum(
      projectFinancials.map((pf) => pf.outstandingBalance)
    );
    const totalRecordedExpenses =
      dateFilter.preset === 'all'
        ? safeSum(expenses.map((e) => e.amount))
        : safeSum(filteredExpenses.map((e) => e.amount));
    const allTimeExpenses = safeSum(expenses.map((e) => e.amount));

    return {
      totalClients,
      activeProjects,
      totalProjectValue,
      totalPaymentsReceived,
      allTimePaymentsReceived,
      totalOutstandingPayments,
      totalRecordedExpenses,
      allTimeExpenses,
    };
  }, [
    clients.length,
    projects,
    projectFinancials,
    dateFilter.preset,
    filteredPayments,
    expenses,
    filteredExpenses,
  ]);

  // Monthly Payments Received vs. Monthly Expenses Chart Data
  const monthlyChartData = useMemo(() => {
    const monthBuckets = new Map<
      string,
      { sortKey: string; label: string; paymentsReceived: number; expenses: number }
    >();

    filteredPayments.forEach((pay) => {
      try {
        const d = parseISO(pay.payment_date);
        if (!isValid(d)) return;
        const sortKey = format(d, 'yyyy-MM');
        const label = format(d, 'MMM yyyy');
        const current = monthBuckets.get(sortKey) || {
          sortKey,
          label,
          paymentsReceived: 0,
          expenses: 0,
        };
        current.paymentsReceived = safeSum([current.paymentsReceived, pay.amount]);
        monthBuckets.set(sortKey, current);
      } catch {
        // ignore invalid date
      }
    });

    filteredExpenses.forEach((exp) => {
      try {
        const d = parseISO(exp.expense_date);
        if (!isValid(d)) return;
        const sortKey = format(d, 'yyyy-MM');
        const label = format(d, 'MMM yyyy');
        const current = monthBuckets.get(sortKey) || {
          sortKey,
          label,
          paymentsReceived: 0,
          expenses: 0,
        };
        current.expenses = safeSum([current.expenses, exp.amount]);
        monthBuckets.set(sortKey, current);
      } catch {
        // ignore invalid date
      }
    });

    return Array.from(monthBuckets.values()).sort((a, b) =>
      a.sortKey.localeCompare(b.sortKey)
    );
  }, [filteredPayments, filteredExpenses]);

  // Project Status Distribution
  const statusDistribution = useMemo(() => {
    return PROJECT_STATUSES.map((status) => {
      const count = projects.filter((p) => p.status === status).length;
      const pct = projects.length > 0 ? Math.round((count / projects.length) * 100) : 0;
      return { status, count, pct };
    }).filter((item) => item.count > 0);
  }, [projects]);

  // Upcoming Project Deadlines & Attention List
  const deadlineAlerts = useMemo(() => {
    return projectFinancials
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
      )
      .slice(0, 6);
  }, [projectFinancials]);

  // Outstanding Payment Alerts (Projects with uncollected balances)
  const outstandingAlerts = useMemo(() => {
    return projectFinancials
      .filter((pf) => pf.outstandingBalance > 0 && pf.project.status !== 'Cancelled')
      .sort((a, b) => {
        if (a.project.status === 'Completed' && b.project.status !== 'Completed') return -1;
        if (b.project.status === 'Completed' && a.project.status !== 'Completed') return 1;
        return b.outstandingBalance - a.outstandingBalance;
      })
      .slice(0, 6);
  }, [projectFinancials]);

  // Projects Needing Work Update (Active projects with 0 updates or latest update >= 7 days ago)
  const projectsNeedingUpdate = useMemo(() => {
    const activeProjects = projects.filter((p) =>
      ACTIVE_PROJECT_STATUSES.includes(p.status)
    );
    const today = new Date();

    return activeProjects
      .map((proj) => {
        const projectUpdates = workUpdates
          .filter((u) => u.project_id === proj.id)
          .sort((a, b) => b.update_date.localeCompare(a.update_date));
        const latest = projectUpdates[0];
        const daysSinceLastUpdate = latest
          ? differenceInCalendarDays(today, parseISO(latest.update_date))
          : 999;
        const client = clients.find((c) => c.id === proj.client_id);

        return {
          project: proj,
          client,
          latestUpdate: latest,
          daysSinceLastUpdate,
          hasNoUpdates: !latest,
        };
      })
      .filter((item) => item.hasNoUpdates || item.daysSinceLastUpdate >= 7)
      .sort((a, b) => b.daysSinceLastUpdate - a.daysSinceLastUpdate)
      .slice(0, 5);
  }, [projects, workUpdates, clients]);

  // Recently Updated Projects (Latest unique projects with recorded site updates)
  const recentlyUpdatedProjects = useMemo(() => {
    const sortedUpdates = [...workUpdates].sort((a, b) =>
      b.update_date.localeCompare(a.update_date)
    );

    const seenProjects = new Set<string>();
    const recents: Array<{
      update: (typeof workUpdates)[0];
      project: (typeof projects)[0];
      client?: (typeof clients)[0];
    }> = [];

    for (const update of sortedUpdates) {
      if (seenProjects.has(update.project_id)) continue;
      const proj = projects.find((p) => p.id === update.project_id);
      if (!proj) continue;
      seenProjects.add(update.project_id);
      const client = clients.find((c) => c.id === proj.client_id);
      recents.push({
        update,
        project: proj,
        client,
      });
      if (recents.length >= 5) break;
    }

    return recents;
  }, [workUpdates, projects, clients]);

  // Recent Client Additions
  const recentClients = useMemo(() => clients.slice(0, 5), [clients]);

  // Overdue Enquiry Follow-ups
  const overdueEnquiries = useMemo(
    () =>
      enquiries.filter((e) => isFollowUpOverdue(e.follow_up_date, e.status)).slice(0, 4),
    [enquiries]
  );

  const handlePresetChange = (preset: DatePreset) => {
    if (preset === 'custom') {
      setDateFilter({
        preset: 'custom',
        startDate: dateFilter.startDate || format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'),
        endDate: dateFilter.endDate || format(new Date(), 'yyyy-MM-dd'),
      });
    } else {
      setDateFilter({ preset });
    }
  };

  // Dynamic Time Greeting (Matches Mixpanel "Good Morning")
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  return (
    <div className="space-y-6 sm:space-y-7">
      {/* -------------------------------------------------------------
          SWIPE-STYLE MOBILE & TABLET HERO & QUICK ACTIONS (< 1024px)
          ------------------------------------------------------------- */}
      <div className="lg:hidden space-y-4">
        {/* Mobile Header Card with Glassmorphic Dual Metrics */}
        <div className="swipe-glass-card p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                {greeting}
              </span>
              <h1 className="text-lg font-bold text-slate-900 font-display truncate">
                {settings.business_name}
              </h1>
            </div>
            {/* Mobile Preset Selector */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[11px]">
              {(
                [
                  { id: '30d', label: '30D' },
                  { id: 'fy', label: 'FY' },
                  { id: 'all', label: 'All' },
                ] as Array<{ id: DatePreset; label: string }>
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handlePresetChange(item.id)}
                  className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                    dateFilter.preset === item.id
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Swipe App Dual Metric Strip (Received vs Due) */}
          <div className="swipe-metric-strip">
            <div
              onClick={() => navigate('/payments')}
              className="swipe-metric-box swipe-metric-box-collect cursor-pointer"
            >
              <div className="swipe-metric-label text-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Collected</span>
              </div>
              <div className="swipe-metric-amount text-emerald-900">
                {formatINR(summaryMetrics.totalPaymentsReceived)}
              </div>
              <span className="text-[10px] text-emerald-700 font-medium mt-0.5">
                Receipts ledger &rarr;
              </span>
            </div>

            <div
              onClick={() => navigate('/payments')}
              className="swipe-metric-box swipe-metric-box-pay cursor-pointer"
            >
              <div className="swipe-metric-label text-amber-800">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                <span>Pending Due</span>
              </div>
              <div className="swipe-metric-amount text-amber-900">
                {formatINR(summaryMetrics.totalOutstandingPayments)}
              </div>
              <span className="text-[10px] text-amber-700 font-medium mt-0.5">
                Receivables &rarr;
              </span>
            </div>
          </div>
        </div>

        {/* Swipe Quick "Create" Grid (Image 1 & 3 Aesthetic) */}
        <div className="swipe-glass-card p-3.5 space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Quick Actions
            </span>
            <span className="text-[10px] text-[#5448ED] font-semibold">
              1-Tap Entry
            </span>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pt-1">
            {/* 1. Client */}
            <button
              type="button"
              onClick={() => openQuickModal({ type: 'client' })}
              className="swipe-quick-tile"
            >
              <div className="swipe-quick-icon-box bg-indigo-50 text-[#5448ED] border border-indigo-100">
                <UserPlus className="w-5 h-5" />
              </div>
              <span className="swipe-quick-label">+ Client</span>
            </button>

            {/* 2. Project */}
            <button
              type="button"
              onClick={() => openQuickModal({ type: 'project' })}
              className="swipe-quick-tile"
            >
              <div className="swipe-quick-icon-box bg-blue-50 text-blue-600 border border-blue-100">
                <FolderPlus className="w-5 h-5" />
              </div>
              <span className="swipe-quick-label">+ Project</span>
            </button>

            {/* 3. Payment */}
            <button
              type="button"
              onClick={() => openQuickModal({ type: 'payment' })}
              className="swipe-quick-tile"
            >
              <div className="swipe-quick-icon-box bg-emerald-50 text-emerald-600 border border-emerald-100">
                <PlusCircle className="w-5 h-5" />
              </div>
              <span className="swipe-quick-label">+ Payment</span>
            </button>

            {/* 4. Expense */}
            <button
              type="button"
              onClick={() => openQuickModal({ type: 'expense' })}
              className="swipe-quick-tile"
            >
              <div className="swipe-quick-icon-box bg-rose-50 text-rose-600 border border-rose-100">
                <Receipt className="w-5 h-5" />
              </div>
              <span className="swipe-quick-label">+ Expense</span>
            </button>

            {/* 5. Enquiry */}
            <button
              type="button"
              onClick={() => openQuickModal({ type: 'enquiry' })}
              className="swipe-quick-tile"
            >
              <div className="swipe-quick-icon-box bg-amber-50 text-amber-600 border border-amber-100">
                <MessageSquarePlus className="w-5 h-5" />
              </div>
              <span className="swipe-quick-label">+ Enquiry</span>
            </button>

            {/* 6. Quotation / Projects */}
            <button
              type="button"
              onClick={() => navigate('/projects')}
              className="swipe-quick-tile"
            >
              <div className="swipe-quick-icon-box bg-violet-50 text-violet-600 border border-violet-100">
                <FileText className="w-5 h-5" />
              </div>
              <span className="swipe-quick-label">Quotes</span>
            </button>
          </div>
        </div>

        {/* Swipe Quick Access Shortcuts (2x2 Grid) */}
        <div className="grid grid-cols-2 gap-2.5">
          <div
            onClick={() => navigate('/projects')}
            className="swipe-quick-access-card"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/70 flex items-center justify-center shrink-0">
              <FolderKanban className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">
                Active Works
              </p>
              <p className="text-[11px] font-semibold text-amber-600">
                {summaryMetrics.activeProjects} In Progress
              </p>
            </div>
          </div>

          <div
            onClick={() => navigate('/clients')}
            className="swipe-quick-access-card"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/70 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">
                Clients
              </p>
              <p className="text-[11px] font-semibold text-emerald-600">
                {summaryMetrics.totalClients} Registered
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------
          DESKTOP GREETING & HEADER (Visible on >= 1024px)
          ------------------------------------------------------------- */}
      <div className="hidden lg:flex lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display tracking-tight">
            {greeting}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            {settings.business_name} &bull; Operational overview and financial performance
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openQuickModal({ type: 'client' })}
            className="akd-btn-secondary h-[34px] px-3 text-xs"
          >
            <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
            <span>Add Client</span>
          </button>
          <button
            type="button"
            onClick={() => openQuickModal({ type: 'project' })}
            className="akd-btn-secondary h-[34px] px-3 text-xs"
          >
            <FolderPlus className="w-3.5 h-3.5 text-indigo-600" />
            <span>New Project</span>
          </button>
          <button
            type="button"
            onClick={() => openQuickModal({ type: 'payment' })}
            className="akd-btn-primary h-[34px] px-3 text-xs"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* "Your Recents" Section (Mixpanel Board Preview Carousel) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
            Your Recents
          </h2>
          <Link
            to="/projects"
            className="text-xs font-semibold text-[#5448ED] hover:text-[#4338CA] inline-flex items-center gap-1"
          >
            View All Projects <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Card 1: Main Dashboard */}
          <div
            onClick={() => navigate('/')}
            className="akd-card p-3 hover:border-slate-300 hover:shadow-card-hover cursor-pointer transition-all flex flex-col justify-between group"
          >
            {/* Visual Micro Preview Bar */}
            <div className="h-12 w-full rounded-md bg-slate-50 border border-slate-100 p-2 flex items-end gap-1 overflow-hidden">
              <div className="w-2 h-4 bg-indigo-200 rounded-sm" />
              <div className="w-2 h-7 bg-indigo-500 rounded-sm" />
              <div className="w-2 h-5 bg-indigo-300 rounded-sm" />
              <div className="w-2 h-9 bg-indigo-600 rounded-sm" />
              <div className="w-2 h-6 bg-indigo-400 rounded-sm" />
              <div className="w-2 h-8 bg-indigo-500 rounded-sm" />
            </div>
            <div className="mt-2.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                <p className="text-xs font-semibold text-slate-900 group-hover:text-[#5448ED] transition-colors truncate">
                  Main Dashboard
                </p>
              </div>
              <p className="text-[10px] text-slate-600 mt-0.5 truncate">
                Executive Overview
              </p>
            </div>
          </div>

          {/* Card 2: Active Projects */}
          <div
            onClick={() => navigate('/projects')}
            className="akd-card p-3 hover:border-slate-300 hover:shadow-card-hover cursor-pointer transition-all flex flex-col justify-between group"
          >
            <div className="h-12 w-full rounded-md bg-amber-50/60 border border-amber-100/80 p-2 flex items-center justify-center">
              <FolderKanban className="w-5 h-5 text-amber-600" />
            </div>
            <div className="mt-2.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <p className="text-xs font-semibold text-slate-900 group-hover:text-[#5448ED] transition-colors truncate">
                  Active Projects
                </p>
              </div>
              <p className="text-[10px] text-slate-600 mt-0.5 truncate">
                {summaryMetrics.activeProjects} active works
              </p>
            </div>
          </div>

          {/* Card 3: Client Directory */}
          <div
            onClick={() => navigate('/clients')}
            className="akd-card p-3 hover:border-slate-300 hover:shadow-card-hover cursor-pointer transition-all flex flex-col justify-between group"
          >
            <div className="h-12 w-full rounded-md bg-emerald-50/60 border border-emerald-100/80 p-2 flex items-center justify-center">
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="mt-2.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <p className="text-xs font-semibold text-slate-900 group-hover:text-[#5448ED] transition-colors truncate">
                  Client Directory
                </p>
              </div>
              <p className="text-[10px] text-slate-600 mt-0.5 truncate">
                {summaryMetrics.totalClients} registered accounts
              </p>
            </div>
          </div>

          {/* Card 4: Payments Ledger */}
          <div
            onClick={() => navigate('/payments')}
            className="akd-card p-3 hover:border-slate-300 hover:shadow-card-hover cursor-pointer transition-all flex flex-col justify-between group"
          >
            <div className="h-12 w-full rounded-md bg-emerald-50/60 border border-emerald-100/80 p-2 flex items-center justify-center">
              <IndianRupee className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="mt-2.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <p className="text-xs font-semibold text-slate-900 group-hover:text-[#5448ED] transition-colors truncate">
                  Payments Ledger
                </p>
              </div>
              <p className="text-[10px] text-slate-600 mt-0.5 truncate">
                Receipts &amp; Collections
              </p>
            </div>
          </div>

          {/* Card 5: Financial Reports */}
          <div
            onClick={() => navigate('/reports')}
            className="akd-card p-3 hover:border-slate-300 hover:shadow-card-hover cursor-pointer transition-all flex flex-col justify-between group"
          >
            <div className="h-12 w-full rounded-md bg-violet-50/60 border border-violet-100/80 p-2 flex items-center justify-center">
              <BarChart2 className="w-5 h-5 text-violet-600" />
            </div>
            <div className="mt-2.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-violet-500" />
                <p className="text-xs font-semibold text-slate-900 group-hover:text-[#5448ED] transition-colors truncate">
                  Studio Analytics
                </p>
              </div>
              <p className="text-[10px] text-slate-600 mt-0.5 truncate">
                Profitability &amp; Cash Flow
              </p>
            </div>
          </div>

          {/* Card 6: See All Board */}
          <div
            onClick={() => navigate('/reports')}
            className="akd-card p-3 hover:border-slate-300 hover:shadow-card-hover cursor-pointer transition-all flex flex-col items-center justify-center text-center group border-dashed"
          >
            <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-[#EEF2FF] text-slate-500 group-hover:text-[#5448ED] flex items-center justify-center transition-colors">
              <ArrowRight className="w-4 h-4" />
            </div>
            <p className="text-xs font-semibold text-slate-700 group-hover:text-[#5448ED] mt-2 transition-colors">
              See All
            </p>
            <p className="text-[10px] text-slate-600 mt-0.5">
              Studio reports
            </p>
          </div>
        </div>
      </div>

      {/* First-Run Onboarding (Empty State) */}
      {isDatabaseEmpty && (
        <div className="akd-card p-6 sm:p-8 bg-white border border-indigo-200/80">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#EEF2FF] border border-[#C7D2FE] text-[11px] font-semibold text-[#5448ED] mb-3">
              <Sparkles className="w-3.5 h-3.5" /> First-Run Studio Setup
            </div>
            <h2 className="text-lg font-bold text-slate-900 font-display">
              Welcome to Your AKD Interior Management Workspace
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
              Your production database is clean. Begin recording your studio ledger by creating your first client, logging a prospective enquiry, or initializing an interior design project.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#5448ED]">
                    Step 01
                  </span>
                  <h3 className="text-sm font-semibold text-slate-900 mt-1">
                    Add Your First Client
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Register a residential or commercial client profile.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openQuickModal({ type: 'client' })}
                  className="akd-btn-primary h-[34px] text-xs mt-4 w-full"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Add Client
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#5448ED]">
                    Step 02
                  </span>
                  <h3 className="text-sm font-semibold text-slate-900 mt-1">
                    Log a New Enquiry
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Track prospective leads and convert them directly to projects.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openQuickModal({ type: 'enquiry' })}
                  className="akd-btn-secondary h-[34px] text-xs mt-4 w-full"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5 text-indigo-600" /> Log Enquiry
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#5448ED]">
                    Step 03
                  </span>
                  <h3 className="text-sm font-semibold text-slate-900 mt-1">
                    Create an Interior Project
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Set project budget, address, milestones, and receivables.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openQuickModal({ type: 'project' })}
                  className="akd-btn-primary h-[34px] text-xs mt-4 w-full"
                >
                  <FolderPlus className="w-3.5 h-3.5" /> Create Project
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mixpanel-style "Studio Performance" Metrics with Integrated Sparklines */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Studio Performance Metrics
            </h2>
          </div>

          {/* Date Filter Segmented Toolbar (Mixpanel Screenshot 2 Style) */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-100/90 p-1 rounded-lg border border-slate-200/80 text-xs">
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

            {dateFilter.preset === 'custom' && (
              <div className="flex items-center gap-1.5 px-1">
                <input
                  type="date"
                  value={dateFilter.startDate || ''}
                  onChange={(e) =>
                    setDateFilter((prev) => ({ ...prev, startDate: e.target.value }))
                  }
                  className="h-7 px-1.5 text-xs border border-slate-200 rounded bg-white text-slate-800"
                  aria-label="Start date"
                />
                <span className="text-slate-400 text-[10px]">to</span>
                <input
                  type="date"
                  value={dateFilter.endDate || ''}
                  onChange={(e) =>
                    setDateFilter((prev) => ({ ...prev, endDate: e.target.value }))
                  }
                  className="h-7 px-1.5 text-xs border border-slate-200 rounded bg-white text-slate-800"
                  aria-label="End date"
                />
              </div>
            )}
          </div>
        </div>

        {/* 6 Executive KPI Cards with Mixpanel Big Number + Sparkline Styling */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
          {/* Card 1: Active Projects */}
          <div className="akd-card p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="font-medium">Active Projects</span>
              <FolderKanban className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="mt-3">
              <p className="text-3xl font-bold text-slate-900 font-display tabular-nums">
                {summaryMetrics.activeProjects}
              </p>
              <p className="text-[11px] text-slate-600 mt-1">
                {projects.length} total projects in studio
              </p>
            </div>
            {/* Minimal SVG Sparkline */}
            <div className="mt-3 h-5 w-full flex items-end">
              <svg className="w-full h-full text-indigo-500 overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 25">
                <path
                  d="M0,20 Q25,5 50,15 T100,5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          {/* Card 2: Total Clients */}
          <div className="akd-card p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="font-medium">Total Clients</span>
              <Users className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="mt-3">
              <p className="text-3xl font-bold text-slate-900 font-display tabular-nums">
                {summaryMetrics.totalClients}
              </p>
              <p className="text-[11px] text-slate-600 mt-1">
                Registered client profiles
              </p>
            </div>
            <div className="mt-3 h-5 w-full flex items-end">
              <svg className="w-full h-full text-indigo-400 overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 25">
                <path
                  d="M0,22 Q30,18 50,10 T100,4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          {/* Card 3: Payments Received */}
          <div className="akd-card p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="font-medium">Payments Received</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-3">
              <p className="text-xl sm:text-2xl font-bold text-emerald-600 font-display tabular-nums">
                {formatINR(summaryMetrics.totalPaymentsReceived)}
              </p>
              <p className="text-[11px] text-slate-600 mt-1 truncate">
                {dateFilter.preset === 'all'
                  ? 'All-time collections'
                  : `Scope: ${filterBounds.label}`}
              </p>
            </div>
            <div className="mt-3 h-5 w-full flex items-end">
              <svg className="w-full h-full text-emerald-500 overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 25">
                <path
                  d="M0,20 Q35,22 60,8 T100,2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          {/* Card 4: Outstanding Payments */}
          <div className="akd-card p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="font-medium">Outstanding Balances</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="mt-3">
              <p className="text-xl sm:text-2xl font-bold text-amber-600 font-display tabular-nums">
                {formatINR(summaryMetrics.totalOutstandingPayments)}
              </p>
              <p className="text-[11px] text-slate-600 mt-1 truncate">
                Pending contract collection
              </p>
            </div>
            <div className="mt-3 h-5 w-full flex items-end">
              <svg className="w-full h-full text-amber-500 overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 25">
                <path
                  d="M0,8 Q30,12 60,18 T100,10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          {/* Card 5: Total Project Value */}
          <div className="akd-card p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="font-medium">Total Project Value</span>
              <IndianRupee className="w-4 h-4 text-slate-600" />
            </div>
            <div className="mt-3">
              <p className="text-xl sm:text-2xl font-bold text-slate-900 font-display tabular-nums">
                {formatINR(summaryMetrics.totalProjectValue)}
              </p>
              <p className="text-[11px] text-slate-600 mt-1 truncate">
                Contracted interior value
              </p>
            </div>
            <div className="mt-3 h-5 w-full flex items-end">
              <svg className="w-full h-full text-slate-400 overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 25">
                <path
                  d="M0,15 Q35,8 65,12 T100,6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          {/* Card 6: Total Expenses */}
          <div className="akd-card p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="font-medium">Recorded Expenses</span>
              <Receipt className="w-4 h-4 text-rose-600" />
            </div>
            <div className="mt-3">
              <p className="text-xl sm:text-2xl font-bold text-slate-900 font-display tabular-nums">
                {formatINR(summaryMetrics.totalRecordedExpenses)}
              </p>
              <p className="text-[11px] text-slate-600 mt-1 truncate">
                {dateFilter.preset === 'all'
                  ? 'All-time expenses'
                  : `In period`}
              </p>
            </div>
            <div className="mt-3 h-5 w-full flex items-end">
              <svg className="w-full h-full text-rose-400 overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 25">
                <path
                  d="M0,18 Q40,10 70,16 T100,12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Main Analytics Row: Cash Flow Chart + Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Payments Received vs Expenses Chart */}
        <div className="akd-card p-5 lg:col-span-2 flex flex-col">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 font-display">
                Monthly Collections vs. Studio Expenses
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Confirmed client receipts compared against studio expenditures ({filterBounds.label})
              </p>
            </div>
            <Link
              to="/reports"
              className="text-xs font-semibold text-[#5448ED] hover:text-[#4338CA] inline-flex items-center gap-1 shrink-0"
            >
              Full Analytics <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {monthlyChartData.length === 0 ? (
            <div className="flex-1 min-h-[260px] flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <Activity className="w-6 h-6 text-slate-400 mb-2" />
              <p className="text-xs font-semibold text-slate-700">
                No financial activity recorded in the selected period
              </p>
              <p className="text-xs text-slate-600 mt-1 max-w-sm">
                Record a client payment or business expense, or switch the date range above to view historical trends.
              </p>
            </div>
          ) : (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlyChartData}
                  margin={{ top: 10, right: 12, left: 4, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#64748B', fontSize: 11 }}
                    axisLine={{ stroke: '#E2E8F0' }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(val) => formatINRCompact(Number(val))}
                    tick={{ fill: '#64748B', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={68}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      formatINR(value),
                      name === 'paymentsReceived'
                        ? 'Payments Received'
                        : 'Recorded Expenses',
                    ]}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E8F0',
                      borderRadius: '10px',
                      fontSize: '12px',
                      color: '#0F172A',
                      boxShadow: '0 10px 25px -3px rgba(15, 23, 42, 0.1)',
                    }}
                  />
                  <Legend
                    formatter={(value) =>
                      value === 'paymentsReceived'
                        ? 'Payments Received'
                        : 'Recorded Expenses'
                    }
                    wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
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

        {/* Project Status Distribution */}
        <div className="akd-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 font-display">
                  Project Status Breakdown
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Portfolio split across {projects.length} studio projects
                </p>
              </div>
              <Link
                to="/projects"
                className="text-xs font-semibold text-[#5448ED] hover:text-[#4338CA] inline-flex items-center gap-1"
              >
                View <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {statusDistribution.length === 0 ? (
              <div className="min-h-[210px] flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-xs font-semibold text-slate-700">No projects created yet</p>
                <button
                  type="button"
                  onClick={() => openQuickModal({ type: 'project' })}
                  className="text-xs font-semibold text-[#5448ED] hover:underline mt-1.5"
                >
                  + Create your first project
                </button>
              </div>
            ) : (
              <div className="space-y-3.5 mt-2">
                {statusDistribution.map((item) => (
                  <div key={item.status} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <Badge variant={getProjectStatusVariant(item.status)} dot>
                        {item.status}
                      </Badge>
                      <span className="font-semibold text-slate-800 tabular-nums">
                        {item.count} ({item.pct}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#5448ED] rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(4, item.pct)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {overdueEnquiries.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="text-xs font-medium text-amber-800 truncate">
                    {overdueEnquiries.length} Enquiry Follow-up{overdueEnquiries.length > 1 ? 's' : ''}{' '}
                    Overdue
                  </span>
                </div>
                <Link
                  to="/enquiries"
                  className="text-xs font-semibold text-[#5448ED] hover:underline shrink-0"
                >
                  Review &rarr;
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Two-Column Attention Sections: Upcoming Completions & Outstanding Balances */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Project Deadlines */}
        <div className="akd-card overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 font-display">
                Upcoming Project Completions
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Active projects sorted by target handover and delivery schedule
              </p>
            </div>
            <Link
              to="/projects"
              className="text-xs font-semibold text-[#5448ED] hover:underline"
            >
              All Projects
            </Link>
          </div>

          {deadlineAlerts.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-600">
              No active projects with upcoming deadlines.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {deadlineAlerts.map((item) => (
                <div
                  key={item.project.id}
                  onClick={() => navigate(`/projects/${item.project.id}`)}
                  className="px-5 py-3.5 hover:bg-slate-50/80 transition-colors cursor-pointer flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-900 truncate">
                        {item.project.project_name}
                      </span>
                      <Badge variant={getProjectStatusVariant(item.project.status)}>
                        {item.project.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 truncate">
                      {item.client?.full_name || '&mdash;'} &bull; {item.project.property_location} &bull;{' '}
                      {item.project.progress_percentage}% completed
                    </p>
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
                    <p className="text-[11px] text-slate-600 mt-1">
                      Target: {formatDate(item.project.expected_completion_date, settings.date_format)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Outstanding Receivable Balances */}
        <div className="akd-card overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 font-display">
                Outstanding Receivable Balances
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Client balances awaiting settlement
              </p>
            </div>
            <Link
              to="/payments"
              className="text-xs font-semibold text-[#5448ED] hover:underline"
            >
              Payment Ledger
            </Link>
          </div>

          {outstandingAlerts.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-600">
              All active project balances are fully settled.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {outstandingAlerts.map((item) => (
                <div
                  key={item.project.id}
                  className="px-5 py-3.5 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-4"
                >
                  <div
                    onClick={() => navigate(`/projects/${item.project.id}`)}
                    className="min-w-0 cursor-pointer flex-1"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-900 truncate">
                        {item.project.project_name}
                      </span>
                      {item.project.status === 'Completed' && (
                        <Badge variant="danger">Completed &bull; Balance Due</Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 truncate">
                      {item.client?.full_name} &bull; Received {formatINR(item.paymentsReceived)} of{' '}
                      {formatINR(item.totalValue)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-xs font-bold text-amber-600 tabular-nums block">
                        {formatINR(item.outstandingBalance)}
                      </span>
                      <span className="text-[10px] text-slate-600">Outstanding</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        openQuickModal({
                          type: 'payment',
                          projectId: item.project.id,
                          clientId: item.project.client_id,
                        })
                      }
                      className="akd-btn-secondary h-8 px-2.5 text-[11px]"
                    >
                      Collect
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Site Work & Progress Tracking Sections (Section 11) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Projects Needing a Work Update */}
        <div className="akd-card overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 font-display">
                Projects Needing Work Update
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Active projects with no progress logged in the past 7 days
              </p>
            </div>
            {projectsNeedingUpdate.length > 0 && (
              <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                {projectsNeedingUpdate.length} Need Update
              </span>
            )}
          </div>

          {projectsNeedingUpdate.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-600">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1.5" />
              All active projects have recent progress updates logged.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {projectsNeedingUpdate.map((item) => (
                <div
                  key={item.project.id}
                  className="px-5 py-3.5 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-4"
                >
                  <div
                    onClick={() => navigate(`/projects/${item.project.id}?tab=work_updates`)}
                    className="min-w-0 cursor-pointer flex-1"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-900 truncate">
                        {item.project.project_name}
                      </span>
                      <Badge variant={getProjectStatusVariant(item.project.status)}>
                        {item.project.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 truncate">
                      {item.client?.full_name || 'Client'} &bull; {item.project.progress_percentage}% completed &bull;{' '}
                      {item.hasNoUpdates
                        ? 'No site updates recorded yet'
                        : `Last update: ${formatDate(item.latestUpdate!.update_date, settings.date_format)}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${
                        item.hasNoUpdates
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {item.hasNoUpdates ? 'No Updates' : `${item.daysSinceLastUpdate}d ago`}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/projects/${item.project.id}?tab=work_updates&action=new_update`)
                      }
                      className="akd-btn-primary h-8 px-2.5 text-[11px]"
                    >
                      Post Update
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recently Updated Projects */}
        <div className="akd-card overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 font-display">
                Recently Updated Projects
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Latest site progress updates and client tracking links
              </p>
            </div>
            <Link
              to="/projects"
              className="text-xs font-semibold text-[#5448ED] hover:underline"
            >
              All Projects
            </Link>
          </div>

          {recentlyUpdatedProjects.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-600">
              No site work updates recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentlyUpdatedProjects.map((item) => (
                <div
                  key={item.update.id}
                  className="px-5 py-3.5 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-4"
                >
                  <div
                    onClick={() => navigate(`/projects/${item.project.id}?tab=work_updates`)}
                    className="min-w-0 cursor-pointer flex-1"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-900 truncate">
                        {item.project.project_name}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {item.update.work_stage}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 truncate">
                      {item.client?.full_name || 'Client'} &bull; {item.update.progress_percentage}% &bull;{' '}
                      {item.update.work_completed}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-slate-500">
                      {formatDate(item.update.update_date, settings.date_format)}
                    </span>
                    {item.project.is_sharing_enabled && item.project.sharing_token ? (
                      <a
                        href={`/track/${item.project.sharing_token}`}
                        target="_blank"
                        rel="noreferrer"
                        className="akd-btn-secondary h-8 px-2.5 text-[11px] inline-flex items-center gap-1 text-[#5448ED]"
                        title="Open client tracking page"
                      >
                        <span>Client Page</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/projects/${item.project.id}?tab=work_updates&action=share`)
                        }
                        className="akd-btn-secondary h-8 px-2.5 text-[11px]"
                      >
                        Share
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Recent Client Additions & Studio Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Client Additions */}
        <div className="akd-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 font-display">
                Recent Client Additions
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Latest client profiles onboarded
              </p>
            </div>
            <Link
              to="/clients"
              className="text-xs font-semibold text-[#5448ED] hover:underline"
            >
              Client Directory
            </Link>
          </div>

          {recentClients.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-600">
              No clients added yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentClients.map((client) => (
                <div
                  key={client.id}
                  onClick={() => navigate(`/clients/${client.id}`)}
                  className="px-5 py-3 hover:bg-slate-50/80 transition-colors cursor-pointer flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-indigo-50 text-[#5448ED] flex items-center justify-center font-bold text-xs shrink-0">
                      {client.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-900 truncate">
                          {client.full_name}
                        </span>
                        <span className="text-[11px] text-slate-600 font-mono">
                          {client.client_code}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5 truncate">
                        {client.client_type} &bull; {client.property_location || 'Kharagpur'} &bull;{' '}
                        {client.phone}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant={getClientStatusVariant(client.status)}>
                      {client.status}
                    </Badge>
                    <p className="text-[10px] text-slate-600 mt-1">
                      {formatDate(client.date_added, settings.date_format)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Studio Activity Log */}
        <div className="akd-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900 font-display">
              Recent Studio Activity Log
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Live audit trail of actions taken in CRM
            </p>
          </div>

          {activityLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-600">
              No recent studio activity recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
              {activityLogs.slice(0, 8).map((log) => (
                <div
                  key={log.id}
                  className="px-5 py-3 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{log.action}</p>
                    <p className="text-slate-600 mt-0.5 truncate">{log.description}</p>
                  </div>
                  <span className="text-[11px] text-slate-600 whitespace-nowrap shrink-0">
                    {formatDate(log.created_at.slice(0, 10), settings.date_format)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
