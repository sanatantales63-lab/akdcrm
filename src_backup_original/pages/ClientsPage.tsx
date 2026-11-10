import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  UserPlus,
  FileDown,
  FileSpreadsheet,
  ArrowUpDown,
  Eye,
  Edit3,
  Trash2,
  FolderPlus,
  ChevronLeft,
  ChevronRight,
  Phone,
  MapPin,
} from 'lucide-react';
import { useCRM } from '@/context/CRMContext';
import { useToast } from '@/context/ToastContext';
import {
  CLIENT_STATUSES,
  ClientFinancialSummary,
  ClientStatus,
} from '@/types/crm';
import { formatDate, formatINR, safeSum } from '@/lib/formatters';
import { Badge, getClientStatusVariant } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { exportClientsExcel, exportClientsPDF } from '@/lib/exporters';

type SortField = 'date_added' | 'full_name' | 'totalProjectValue' | 'outstandingBalance';

export const ClientsPage: React.FC = () => {
  const {
    settings,
    clientFinancials,
    updateClient,
    archiveClient,
    openQuickModal,
  } = useCRM();
  const { success, error: showError } = useToast();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<SortField>('date_added');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [deleteTarget, setDeleteTarget] = useState<ClientFinancialSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = clientFinancials.filter(({ client }) => {
      if (statusFilter !== 'ALL' && client.status !== statusFilter) return false;
      if (typeFilter !== 'ALL' && client.client_type !== typeFilter) return false;
      if (!q) return true;
      return (
        client.full_name.toLowerCase().includes(q) ||
        client.phone.toLowerCase().includes(q) ||
        (client.whatsapp && client.whatsapp.toLowerCase().includes(q)) ||
        (client.email && client.email.toLowerCase().includes(q)) ||
        client.client_code.toLowerCase().includes(q) ||
        (client.property_location && client.property_location.toLowerCase().includes(q))
      );
    });

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'full_name') {
        cmp = a.client.full_name.localeCompare(b.client.full_name);
      } else if (sortField === 'totalProjectValue') {
        cmp = a.totalProjectValue - b.totalProjectValue;
      } else if (sortField === 'outstandingBalance') {
        cmp = a.outstandingBalance - b.outstandingBalance;
      } else {
        cmp = a.client.date_added.localeCompare(b.client.date_added);
      }
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [clientFinancials, search, statusFilter, typeFilter, sortField, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedClients = useMemo(
    () =>
      filteredClients.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredClients, currentPage, pageSize]
  );

  const scopeMetrics = useMemo(() => {
    return {
      count: filteredClients.length,
      totalProjectValue: safeSum(filteredClients.map((c) => c.totalProjectValue)),
      totalReceived: safeSum(filteredClients.map((c) => c.totalPaymentsReceived)),
      totalOutstanding: safeSum(filteredClients.map((c) => c.outstandingBalance)),
    };
  }, [filteredClients]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(field === 'full_name');
    }
  };

  const handleStatusChange = async (clientId: string, newStatus: ClientStatus) => {
    try {
      await updateClient(clientId, { status: newStatus });
      success('Status Updated', `Client status set to ${newStatus}.`);
    } catch (err: any) {
      showError('Update Failed', err?.message || 'Could not update client status.');
    }
  };

  const handleConfirmArchive = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await archiveClient(deleteTarget.client.id);
      success(
        'Client Archived',
        `${deleteTarget.client.full_name} has been archived.`
      );
      setDeleteTarget(null);
    } catch (err: any) {
      showError('Cannot Archive Client', err?.message || 'Failed to archive client.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getFilterScopeDescription = () => {
    const parts: string[] = [];
    if (statusFilter !== 'ALL') parts.push(`Status: ${statusFilter}`);
    if (typeFilter !== 'ALL') parts.push(`Type: ${typeFilter}`);
    if (search.trim()) parts.push(`Search: "${search.trim()}"`);
    return parts.length ? parts.join(' | ') : 'All Active Clients';
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      await exportClientsPDF({
        clients: filteredClients,
        settings,
        filterScope: getFilterScopeDescription(),
      });
      success('PDF Exported', `Exported ${filteredClients.length} client records to PDF.`);
    } catch (err: any) {
      showError('Export Failed', err?.message || 'Failed to generate PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = () => {
    try {
      exportClientsExcel({
        clients: filteredClients,
        settings,
        filterScope: getFilterScopeDescription(),
      });
      success(
        'Excel Exported',
        `Exported ${filteredClients.length} client records to .xlsx.`
      );
    } catch (err: any) {
      showError('Export Failed', err?.message || 'Failed to generate Excel file.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-display tracking-tight">
            Client Directory
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Manage residential and commercial clients, project portfolios, and receivable balances.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={isExporting || filteredClients.length === 0}
            className="akd-btn-secondary h-[34px] px-3 text-xs"
          >
            <FileDown className="w-3.5 h-3.5 text-indigo-600" /> Export PDF
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={filteredClients.length === 0}
            className="akd-btn-secondary h-[34px] px-3 text-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Export Excel
          </button>
          <button
            type="button"
            onClick={() => openQuickModal({ type: 'client' })}
            className="akd-btn-primary h-[34px] px-3 text-xs"
          >
            <UserPlus className="w-3.5 h-3.5" /> Add Client
          </button>
        </div>
      </div>

      {/* Summary Strip (Mixpanel KPI format) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="akd-card p-4">
          <span className="text-xs text-slate-600 font-medium">Clients in Scope</span>
          <p className="text-2xl font-bold text-slate-900 font-display mt-1 tabular-nums">
            {scopeMetrics.count}
          </p>
        </div>
        <div className="akd-card p-4">
          <span className="text-xs text-slate-600 font-medium">Total Project Value</span>
          <p className="text-2xl font-bold text-slate-900 font-display mt-1 tabular-nums">
            {formatINR(scopeMetrics.totalProjectValue)}
          </p>
        </div>
        <div className="akd-card p-4">
          <span className="text-xs text-slate-600 font-medium">Payments Received</span>
          <p className="text-2xl font-bold text-emerald-600 font-display mt-1 tabular-nums">
            {formatINR(scopeMetrics.totalReceived)}
          </p>
        </div>
        <div className="akd-card p-4">
          <span className="text-xs text-slate-600 font-medium">Outstanding Balance</span>
          <p className="text-2xl font-bold text-amber-600 font-display mt-1 tabular-nums">
            {formatINR(scopeMetrics.totalOutstanding)}
          </p>
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div className="akd-card p-3.5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by client name, phone, email, ID, or location..."
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
            aria-label="Filter by client status"
          >
            <option value="ALL">All Statuses</option>
            {CLIENT_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="akd-select w-auto min-w-[140px]"
            aria-label="Filter by client type"
          >
            <option value="ALL">All Client Types</option>
            <option value="Residential">Residential</option>
            <option value="Commercial">Commercial</option>
          </select>

          {(search || statusFilter !== 'ALL' || typeFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('ALL');
                setTypeFilter('ALL');
                setPage(1);
              }}
              className="text-xs font-semibold text-[#5448ED] hover:underline px-2"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Clients Data Table */}
      <div className="akd-card overflow-hidden">
        {filteredClients.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-900">
              No client records match your current criteria
            </p>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              Add a new client record or clear your active search and status filters.
            </p>
            <button
              type="button"
              onClick={() => openQuickModal({ type: 'client' })}
              className="akd-btn-primary h-[34px] text-xs mt-1"
            >
              <UserPlus className="w-3.5 h-3.5" /> Add Client
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                    <th className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => toggleSort('full_name')}
                        className="inline-flex items-center gap-1 hover:text-slate-900"
                      >
                        Client <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4">Contact &amp; Location</th>
                    <th className="py-3 px-4">Type / Property</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Projects</th>
                    <th className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => toggleSort('totalProjectValue')}
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
                    <th className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => toggleSort('date_added')}
                        className="inline-flex items-center gap-1 hover:text-slate-900"
                      >
                        Added <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {paginatedClients.map((item) => {
                    const { client } = item;
                    return (
                      <tr
                        key={client.id}
                        className="hover:bg-slate-50/70 transition-colors group"
                      >
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => navigate(`/clients/${client.id}`)}
                            className="text-left group-hover:text-[#5448ED] transition-colors"
                          >
                            <span className="font-semibold text-slate-900 group-hover:text-[#5448ED] block">
                              {client.full_name}
                            </span>
                            <span className="text-[11px] font-mono text-slate-600">
                              {client.client_code}
                            </span>
                          </button>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 text-slate-800">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{client.phone}</span>
                          </div>
                          {client.property_location && (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-600 mt-0.5">
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span className="truncate max-w-[160px]">
                                {client.property_location}
                              </span>
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-medium text-slate-900 block">
                            {client.client_type}
                          </span>
                          <span className="text-[11px] text-slate-600 truncate block max-w-[150px]">
                            {client.property_type || '—'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <Badge variant={getClientStatusVariant(client.status)}>
                              {client.status}
                            </Badge>
                            <select
                              aria-label={`Change status for ${client.full_name}`}
                              value={client.status}
                              onChange={(e) =>
                                handleStatusChange(
                                  client.id,
                                  e.target.value as ClientStatus
                                )
                              }
                              className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-[11px] bg-white border border-slate-200 rounded px-1 py-0.5 transition-opacity"
                            >
                              {CLIENT_STATUSES.map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center tabular-nums font-medium text-slate-800">
                          {item.projectCount}
                        </td>

                        <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-slate-900">
                          {formatINR(item.totalProjectValue)}
                        </td>

                        <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-emerald-600">
                          {formatINR(item.totalPaymentsReceived)}
                        </td>

                        <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-amber-600">
                          {formatINR(item.outstandingBalance)}
                        </td>

                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          {formatDate(client.date_added, settings.date_format)}
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => navigate(`/clients/${client.id}`)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                              title="View Client Profile"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                openQuickModal({
                                  type: 'project',
                                  clientId: client.id,
                                })
                              }
                              className="p-1.5 rounded-md text-slate-500 hover:text-[#5448ED] hover:bg-indigo-50 transition-colors"
                              title="Create Project for Client"
                            >
                              <FolderPlus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                openQuickModal({
                                  type: 'client',
                                  editClient: client,
                                })
                              }
                              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                              title="Edit Client"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Archive Client"
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

            {/* Pagination Footer */}
            <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span>
                  Showing {(currentPage - 1) * pageSize + 1}&ndash;
                  {Math.min(currentPage * pageSize, filteredClients.length)} of{' '}
                  {filteredClients.length} clients
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

      {/* Confirmation Dialog for Archiving Client */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmArchive}
        isLoading={isDeleting}
        title="Archive Client Record"
        description={
          deleteTarget
            ? `Are you sure you want to archive ${deleteTarget.client.full_name} (${deleteTarget.client.client_code})? Clients with active projects cannot be deleted until their projects are archived.`
            : ''
        }
        confirmLabel="Archive Client"
      />
    </div>
  );
};
