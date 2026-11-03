import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  FolderPlus,
  FileDown,
  FileSpreadsheet,
  ArrowUpDown,
  Eye,
  Edit3,
  Trash2,
  PlusCircle,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  Camera,
  FileText,
  Plus,
} from 'lucide-react';
import { useCRM } from '@/context/CRMContext';
import { useToast } from '@/context/ToastContext';
import {
  PROJECT_STATUSES,
  ProjectFinancialSummary,
  ProjectStatus,
} from '@/types/crm';
import {
  formatDate,
  formatINR,
  getDeadlineInfo,
  safeSum,
} from '@/lib/formatters';
import { Badge, getProjectStatusVariant } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { exportProjectsExcel, exportProjectsPDF } from '@/lib/exporters';

type SortField =
  | 'expected_completion_date'
  | 'totalValue'
  | 'outstandingBalance'
  | 'progress_percentage';

export const ProjectsPage: React.FC = () => {
  const {
    settings,
    clients,
    projectFinancials,
    updateProject,
    archiveProject,
    openQuickModal,
  } = useCRM();
  const { success, error: showError } = useToast();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [clientFilter, setClientFilter] = useState('ALL');
  const [sortField, setSortField] = useState<SortField>('expected_completion_date');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [deleteTarget, setDeleteTarget] = useState<ProjectFinancialSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = projectFinancials.filter((pf) => {
      const { project, client } = pf;
      if (statusFilter !== 'ALL' && project.status !== statusFilter) return false;
      if (categoryFilter !== 'ALL' && project.category !== categoryFilter) return false;
      if (clientFilter !== 'ALL' && project.client_id !== clientFilter) return false;
      if (!q) return true;
      return (
        project.project_name.toLowerCase().includes(q) ||
        project.project_code.toLowerCase().includes(q) ||
        project.property_location.toLowerCase().includes(q) ||
        (client && client.full_name.toLowerCase().includes(q))
      );
    });

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'totalValue') {
        cmp = a.totalValue - b.totalValue;
      } else if (sortField === 'outstandingBalance') {
        cmp = a.outstandingBalance - b.outstandingBalance;
      } else if (sortField === 'progress_percentage') {
        cmp = a.project.progress_percentage - b.project.progress_percentage;
      } else {
        const dA = a.project.expected_completion_date || '9999-12-31';
        const dB = b.project.expected_completion_date || '9999-12-31';
        cmp = dA.localeCompare(dB);
      }
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [
    projectFinancials,
    search,
    statusFilter,
    categoryFilter,
    clientFilter,
    sortField,
    sortAsc,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedProjects = useMemo(
    () =>
      filteredProjects.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredProjects, currentPage, pageSize]
  );

  const scopeMetrics = useMemo(() => {
    return {
      count: filteredProjects.length,
      totalValue: safeSum(filteredProjects.map((p) => p.totalValue)),
      paymentsReceived: safeSum(filteredProjects.map((p) => p.paymentsReceived)),
      outstandingBalance: safeSum(filteredProjects.map((p) => p.outstandingBalance)),
      recordedExpenses: safeSum(filteredProjects.map((p) => p.recordedExpenses)),
    };
  }, [filteredProjects]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(field === 'expected_completion_date');
    }
  };

  const handleStatusChange = async (projectId: string, nextStatus: ProjectStatus) => {
    try {
      await updateProject(projectId, { status: nextStatus });
      success('Project Status Updated', `Status changed to ${nextStatus}.`);
    } catch (err: any) {
      showError('Update Failed', err?.message || 'Could not update project.');
    }
  };

  const handleConfirmArchive = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await archiveProject(deleteTarget.project.id);
      success(
        'Project Archived',
        `"${deleteTarget.project.project_name}" has been archived.`
      );
      setDeleteTarget(null);
    } catch (err: any) {
      showError('Cannot Archive Project', err?.message || 'Could not archive project.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getFilterScope = () => {
    const parts: string[] = [];
    if (statusFilter !== 'ALL') parts.push(`Status: ${statusFilter}`);
    if (categoryFilter !== 'ALL') parts.push(`Category: ${categoryFilter}`);
    if (clientFilter !== 'ALL') {
      const cl = clients.find((c) => c.id === clientFilter);
      if (cl) parts.push(`Client: ${cl.full_name}`);
    }
    if (search.trim()) parts.push(`Search: "${search.trim()}"`);
    return parts.length ? parts.join(' | ') : 'All Projects';
  };

  const handleExportPDF = async () => {
    await exportProjectsPDF({
      projects: filteredProjects,
      settings,
      filterScope: getFilterScope(),
    });
    success('PDF Exported', `Exported ${filteredProjects.length} projects to PDF.`);
  };

  const handleExportExcel = () => {
    exportProjectsExcel({
      projects: filteredProjects,
      settings,
      filterScope: getFilterScope(),
    });
    success('Excel Exported', `Exported ${filteredProjects.length} projects to .xlsx.`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-display tracking-tight">
            Interior Projects &amp; Turnkey Execution
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Track project milestones, completion deadlines, contract values, and receivable balances.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={filteredProjects.length === 0}
            className="akd-btn-secondary h-[34px] px-3 text-xs"
          >
            <FileDown className="w-3.5 h-3.5 text-indigo-600" /> Export PDF
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={filteredProjects.length === 0}
            className="akd-btn-secondary h-[34px] px-3 text-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Export Excel
          </button>
          <button
            type="button"
            onClick={() => openQuickModal({ type: 'project' })}
            className="akd-btn-primary h-[34px] px-3.5 text-xs"
          >
            <FolderPlus className="w-3.5 h-3.5" /> Create Project
          </button>
        </div>
      </div>

      {/* Financial Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="akd-card p-4">
          <span className="text-xs text-slate-600 font-medium">Projects in Scope</span>
          <p className="text-2xl font-bold text-slate-900 font-display mt-1 tabular-nums">
            {scopeMetrics.count}
          </p>
        </div>
        <div className="akd-card p-4">
          <span className="text-xs text-slate-600 font-medium">Total Project Value</span>
          <p className="text-2xl font-bold text-slate-900 font-display mt-1 tabular-nums">
            {formatINR(scopeMetrics.totalValue)}
          </p>
        </div>
        <div className="akd-card p-4">
          <span className="text-xs text-slate-600 font-medium">Confirmed Received</span>
          <p className="text-2xl font-bold text-emerald-600 font-display mt-1 tabular-nums">
            {formatINR(scopeMetrics.paymentsReceived)}
          </p>
        </div>
        <div className="akd-card p-4">
          <span className="text-xs text-slate-600 font-medium">Outstanding Balance</span>
          <p className="text-2xl font-bold text-amber-600 font-display mt-1 tabular-nums">
            {formatINR(scopeMetrics.outstandingBalance)}
          </p>
        </div>
        <div className="akd-card p-4 col-span-2 lg:col-span-1">
          <span className="text-xs text-slate-600 font-medium">Project Expenses</span>
          <p className="text-2xl font-bold text-rose-600 font-display mt-1 tabular-nums">
            {formatINR(scopeMetrics.recordedExpenses)}
          </p>
        </div>
      </div>

      {/* Swipe Horizontal Filter Pills (Instant Tap Filtering) */}
      <div className="swipe-pill-scroll">
        <button
          type="button"
          onClick={() => {
            setStatusFilter('ALL');
            setCategoryFilter('ALL');
            setPage(1);
          }}
          className={`swipe-pill-item ${
            statusFilter === 'ALL' && categoryFilter === 'ALL' ? 'active' : ''
          }`}
        >
          All ({projectFinancials.length})
        </button>
        {PROJECT_STATUSES.map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => {
              setStatusFilter(statusFilter === st ? 'ALL' : st);
              setPage(1);
            }}
            className={`swipe-pill-item ${statusFilter === st ? 'active' : ''}`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="akd-card p-3.5 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by project name, ID, client, or site location..."
            className="akd-input pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="akd-select w-auto min-w-[140px]"
            aria-label="Filter by project status"
          >
            <option value="ALL">All Statuses</option>
            {PROJECT_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="akd-select w-auto min-w-[150px]"
            aria-label="Filter by category"
          >
            <option value="ALL">All Categories</option>
            {settings.project_categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={clientFilter}
            onChange={(e) => {
              setClientFilter(e.target.value);
              setPage(1);
            }}
            className="akd-select w-auto min-w-[150px]"
            aria-label="Filter by client"
          >
            <option value="ALL">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>

          {(search ||
            statusFilter !== 'ALL' ||
            categoryFilter !== 'ALL' ||
            clientFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('ALL');
                setCategoryFilter('ALL');
                setClientFilter('ALL');
                setPage(1);
              }}
              className="text-xs font-semibold text-[#5448ED] hover:underline px-2"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Projects Table */}
      <div className="akd-card overflow-hidden">
        {filteredProjects.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-900">
              No projects match your current filters
            </p>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              Initialize a new interior project or adjust your search and filter criteria.
            </p>
            <button
              type="button"
              onClick={() => openQuickModal({ type: 'project' })}
              className="akd-btn-primary h-[34px] text-xs mt-1"
            >
              <FolderPlus className="w-3.5 h-3.5" /> Create Project
            </button>
          </div>
        ) : (
          <>
            {/* Mobile & Tablet Project Cards (Swipe App Style) */}
            <div className="lg:hidden p-3 space-y-3 bg-slate-50/40">
              {paginatedProjects.map((item) => {
                const { project, client } = item;
                const deadline = getDeadlineInfo(
                  project.expected_completion_date,
                  project.status
                );

                return (
                  <div
                    key={project.id}
                    className="swipe-list-card bg-white"
                  >
                    {/* Top Row: Project Name, Code & Status Badge */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => navigate(`/projects/${project.id}`)}
                          className="text-left font-bold text-slate-900 text-sm hover:text-[#5448ED] truncate block"
                        >
                          {project.project_name}
                        </button>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                          <span className="font-mono font-medium">{project.project_code}</span>
                          <span>&bull;</span>
                          <span>{project.category}</span>
                        </div>
                      </div>

                      <Badge variant={getProjectStatusVariant(project.status)}>
                        {project.status}
                      </Badge>
                    </div>

                    {/* Middle Row: Client & Site Location */}
                    <div className="flex flex-wrap items-center justify-between gap-2 py-1.5 border-y border-slate-100 text-xs text-slate-600">
                      <div>
                        {client ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/clients/${client.id}`)}
                            className="font-medium text-slate-800 hover:text-[#5448ED] truncate"
                          >
                            {client.full_name}
                          </button>
                        ) : (
                          <span className="text-slate-400">No client linked</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-slate-500 truncate max-w-[170px]">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{project.property_location}</span>
                      </div>
                    </div>

                    {/* Progress Bar Strip */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-medium">Work Progress</span>
                        <span className="font-bold text-slate-800 font-display">
                          {project.progress_percentage}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#5448ED] rounded-full transition-all"
                          style={{ width: `${project.progress_percentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Financial Summary Strip */}
                    <div className="grid grid-cols-3 gap-2 bg-slate-50 rounded-xl p-2.5 text-center">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">
                          Value
                        </span>
                        <span className="text-xs font-bold text-slate-900 font-display tabular-nums">
                          {formatINR(item.totalValue)}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">
                          Received
                        </span>
                        <span className="text-xs font-bold text-emerald-600 font-display tabular-nums">
                          {formatINR(item.paymentsReceived)}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">
                          Due
                        </span>
                        {item.outstandingBalance > 0 ? (
                          <span className="text-xs font-bold text-amber-600 font-display tabular-nums">
                            {formatINR(item.outstandingBalance)}
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-emerald-600">
                            Cleared
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Target Deadline Badge if set */}
                    {deadline.label && (
                      <div className="flex items-center justify-between text-[11px] px-1 text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>Deadline: {formatDate(project.expected_completion_date)}</span>
                        </span>
                        <span
                          className={`font-semibold ${
                            deadline.isOverdue
                              ? 'text-rose-600'
                              : deadline.isApproaching
                              ? 'text-amber-600'
                              : 'text-slate-600'
                          }`}
                        >
                          {deadline.label}
                        </span>
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="flex items-center justify-between gap-1.5 pt-1">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => navigate(`/projects/${project.id}`)}
                          className="swipe-card-action-btn call"
                          title="Post Site Photo / Progress"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Update</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            openQuickModal({
                              type: 'payment',
                              projectId: project.id,
                              clientId: project.client_id,
                            })
                          }
                          className="swipe-card-action-btn"
                          title="Record Payment"
                        >
                          <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Pay</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => navigate(`/projects/${project.id}`)}
                          className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            openQuickModal({
                              type: 'project',
                              editProject: project,
                            })
                          }
                          className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                          title="Edit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
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
                    <th className="py-3 px-4">Project &amp; Category</th>
                    <th className="py-3 px-4">Client &amp; Location</th>
                    <th className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => toggleSort('progress_percentage')}
                        className="inline-flex items-center gap-1 hover:text-slate-900"
                      >
                        Status &amp; Progress <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => toggleSort('expected_completion_date')}
                        className="inline-flex items-center gap-1 hover:text-slate-900"
                      >
                        Target Completion <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => toggleSort('totalValue')}
                        className="inline-flex items-center gap-1 hover:text-slate-900 ml-auto"
                      >
                        Project Value <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4 text-right">Received</th>
                    <th className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => toggleSort('outstandingBalance')}
                        className="inline-flex items-center gap-1 hover:text-slate-900 ml-auto"
                      >
                        Outstanding <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {paginatedProjects.map((pf) => {
                    const { project, client } = pf;
                    const deadline = getDeadlineInfo(
                      project.expected_completion_date,
                      project.status
                    );

                    return (
                      <tr
                        key={project.id}
                        className="hover:bg-slate-50/70 transition-colors group"
                      >
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => navigate(`/projects/${project.id}`)}
                            className="text-left"
                          >
                            <span className="font-semibold text-slate-900 group-hover:text-[#5448ED] transition-colors block">
                              {project.project_name}
                            </span>
                            <span className="text-[11px] text-slate-600">
                              <span className="font-mono">{project.project_code}</span> &bull;{' '}
                              {project.category}
                            </span>
                          </button>
                        </td>

                        <td className="py-3.5 px-4">
                          {client ? (
                            <button
                              type="button"
                              onClick={() => navigate(`/clients/${client.id}`)}
                              className="font-medium text-slate-800 hover:text-[#5448ED] hover:underline block"
                            >
                              {client.full_name}
                            </button>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 mt-0.5">
                            <MapPin className="w-3 h-3 shrink-0" />
                            {project.property_location}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="space-y-1.5 min-w-[140px]">
                            <div className="flex items-center justify-between gap-2">
                              <Badge variant={getProjectStatusVariant(project.status)}>
                                {project.status}
                              </Badge>
                              <span className="text-[11px] font-semibold text-slate-800 tabular-nums">
                                {project.progress_percentage}%
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#5448ED] rounded-full transition-all"
                                style={{ width: `${project.progress_percentage}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="text-slate-800">
                            {formatDate(
                              project.expected_completion_date,
                              settings.date_format
                            )}
                          </div>
                          {(deadline.isOverdue || deadline.isApproaching) && (
                            <div className="mt-1">
                              <Badge
                                variant={deadline.isOverdue ? 'danger' : 'warning'}
                              >
                                <Clock className="w-3 h-3 mr-1" />
                                {deadline.label}
                              </Badge>
                            </div>
                          )}
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

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => navigate(`/projects/${project.id}`)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                              title="Open Project Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                openQuickModal({
                                  type: 'payment',
                                  projectId: project.id,
                                  clientId: project.client_id,
                                })
                              }
                              className="p-1.5 rounded-md text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                              title="Record Payment for Project"
                            >
                              <PlusCircle className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                openQuickModal({
                                  type: 'project',
                                  editProject: project,
                                })
                              }
                              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                              title="Edit Project"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <select
                              aria-label={`Change status for ${project.project_name}`}
                              value={project.status}
                              onChange={(e) =>
                                handleStatusChange(
                                  project.id,
                                  e.target.value as ProjectStatus
                                )
                              }
                              className="hidden sm:inline-block text-[11px] bg-white border border-slate-200 rounded-md px-1.5 py-1 text-slate-800"
                            >
                              {PROJECT_STATUSES.map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(pf)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Archive Project"
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

            {/* Pagination */}
            <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span>
                  Showing {(currentPage - 1) * pageSize + 1}&ndash;
                  {Math.min(currentPage * pageSize, filteredProjects.length)} of{' '}
                  {filteredProjects.length} projects
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

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmArchive}
        isLoading={isDeleting}
        title="Archive Project"
        description={
          deleteTarget
            ? `Are you sure you want to archive project "${deleteTarget.project.project_name}" (${deleteTarget.project.project_code})? Projects with recorded payments cannot be deleted unless their payments are archived first.`
            : ''
        }
        confirmLabel="Archive Project"
      />
      {/* Swipe Page Floating Action Button (Mobile & Tablet) */}
      <button
        type="button"
        onClick={() => openQuickModal({ type: 'project' })}
        className="swipe-page-fab"
        title="Create New Project"
      >
        <Plus className="w-4 h-4 stroke-[3]" />
        <span>+ New Project</span>
      </button>
    </div>
  );
};
