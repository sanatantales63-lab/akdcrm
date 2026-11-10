import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  MessageSquarePlus,
  FileDown,
  FileSpreadsheet,
  ArrowUpDown,
  Edit3,
  Trash2,
  UserCheck,
  Clock,
  ChevronLeft,
  ChevronRight,
  Phone,
  MapPin,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { useCRM } from '@/context/CRMContext';
import { useToast } from '@/context/ToastContext';
import {
  Enquiry,
  ENQUIRY_STATUSES,
  EnquiryStatus,
} from '@/types/crm';
import {
  formatDate,
  formatINR,
  isFollowUpOverdue,
  safeSum,
} from '@/lib/formatters';
import { Badge, getEnquiryStatusVariant } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ConvertEnquiryModal } from '@/components/modals/EnquiryModals';
import { exportEnquiriesExcel, exportEnquiriesPDF } from '@/lib/exporters';

type SortField = 'follow_up_date' | 'enquiry_date' | 'estimated_budget';

export const EnquiriesPage: React.FC = () => {
  const {
    settings,
    enquiries,
    updateEnquiry,
    addEnquiryFollowUpNote,
    archiveEnquiry,
    openQuickModal,
  } = useCRM();
  const { success, error: showError } = useToast();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [sortField, setSortField] = useState<SortField>('follow_up_date');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Follow-up Note Modal State
  const [noteTarget, setNoteTarget] = useState<Enquiry | null>(null);
  const [followUpNoteText, setFollowUpNoteText] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Convert to Client Modal State
  const [convertTarget, setConvertTarget] = useState<Enquiry | null>(null);

  // Archive Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<Enquiry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredEnquiries = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = enquiries.filter((e) => {
      if (statusFilter !== 'ALL' && e.status !== statusFilter) return false;
      if (typeFilter !== 'ALL' && e.project_type !== typeFilter) return false;
      if (onlyOverdue && !isFollowUpOverdue(e.follow_up_date, e.status)) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.phone.toLowerCase().includes(q) ||
        (e.email && e.email.toLowerCase().includes(q)) ||
        e.enquiry_code.toLowerCase().includes(q) ||
        (e.property_location && e.property_location.toLowerCase().includes(q))
      );
    });

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'estimated_budget') {
        cmp = (a.estimated_budget || 0) - (b.estimated_budget || 0);
      } else if (sortField === 'enquiry_date') {
        cmp = a.enquiry_date.localeCompare(b.enquiry_date);
      } else {
        const fA = a.follow_up_date || '9999-12-31';
        const fB = b.follow_up_date || '9999-12-31';
        cmp = fA.localeCompare(fB);
      }
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [
    enquiries,
    search,
    statusFilter,
    typeFilter,
    onlyOverdue,
    sortField,
    sortAsc,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredEnquiries.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedEnquiries = useMemo(
    () =>
      filteredEnquiries.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredEnquiries, currentPage, pageSize]
  );

  const metrics = useMemo(() => {
    const overdueCount = enquiries.filter((e) =>
      isFollowUpOverdue(e.follow_up_date, e.status)
    ).length;
    const convertedCount = filteredEnquiries.filter((e) => e.status === 'Converted').length;
    const totalPipeline = safeSum(
      filteredEnquiries.map((e) => e.estimated_budget || 0)
    );
    return {
      total: filteredEnquiries.length,
      overdueCount,
      convertedCount,
      totalPipeline,
    };
  }, [enquiries, filteredEnquiries]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(field === 'follow_up_date');
    }
  };

  const handleStatusChange = async (enquiryId: string, nextStatus: EnquiryStatus) => {
    try {
      await updateEnquiry(enquiryId, { status: nextStatus });
      success('Status Updated', `Enquiry status changed to ${nextStatus}.`);
    } catch (err: any) {
      showError('Update Failed', err?.message || 'Could not update status.');
    }
  };

  const handleSaveFollowUpNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTarget || !followUpNoteText.trim()) return;
    setSavingNote(true);
    try {
      await addEnquiryFollowUpNote(
        noteTarget.id,
        followUpNoteText,
        nextFollowUpDate || undefined
      );
      success('Follow-up Recorded', `Saved note for ${noteTarget.name}.`);
      setNoteTarget(null);
      setFollowUpNoteText('');
    } catch (err: any) {
      showError('Failed to save note', err?.message || 'Could not save follow-up note.');
    } finally {
      setSavingNote(false);
    }
  };

  const handleConfirmArchive = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await archiveEnquiry(deleteTarget.id);
      success('Enquiry Archived', `Archived enquiry from ${deleteTarget.name}.`);
      setDeleteTarget(null);
    } catch (err: any) {
      showError('Archive Failed', err?.message || 'Could not archive enquiry.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getFilterScope = () => {
    const parts: string[] = [];
    if (statusFilter !== 'ALL') parts.push(`Status: ${statusFilter}`);
    if (typeFilter !== 'ALL') parts.push(`Type: ${typeFilter}`);
    if (onlyOverdue) parts.push('Overdue Follow-ups Only');
    if (search.trim()) parts.push(`Search: "${search.trim()}"`);
    return parts.length ? parts.join(' | ') : 'All Enquiries';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-display tracking-tight">
            Enquiry &amp; Lead Management
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Track prospective clients, site visits, follow-up schedules, and convert qualified leads into studio projects.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              exportEnquiriesPDF({
                enquiries: filteredEnquiries,
                settings,
                filterScope: getFilterScope(),
              })
            }
            disabled={filteredEnquiries.length === 0}
            className="akd-btn-secondary h-[34px] px-3 text-xs"
          >
            <FileDown className="w-3.5 h-3.5 text-indigo-600" /> Export PDF
          </button>
          <button
            type="button"
            onClick={() =>
              exportEnquiriesExcel({
                enquiries: filteredEnquiries,
                settings,
                filterScope: getFilterScope(),
              })
            }
            disabled={filteredEnquiries.length === 0}
            className="akd-btn-secondary h-[34px] px-3 text-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Export Excel
          </button>
          <button
            type="button"
            onClick={() => openQuickModal({ type: 'enquiry' })}
            className="akd-btn-primary h-[34px] px-3.5 text-xs"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" /> Add Enquiry
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="akd-card p-4">
          <span className="text-xs text-slate-600 font-medium">Enquiries in Scope</span>
          <p className="text-2xl font-bold text-slate-900 font-display mt-1 tabular-nums">
            {metrics.total}
          </p>
        </div>
        <div className="akd-card p-4">
          <span className="text-xs text-slate-600 font-medium">Overdue Follow-ups</span>
          <p className="text-2xl font-bold text-rose-600 font-display mt-1 tabular-nums">
            {metrics.overdueCount}
          </p>
        </div>
        <div className="akd-card p-4">
          <span className="text-xs text-slate-600 font-medium">Converted Leads</span>
          <p className="text-2xl font-bold text-emerald-600 font-display mt-1 tabular-nums">
            {metrics.convertedCount}
          </p>
        </div>
        <div className="akd-card p-4">
          <span className="text-xs text-slate-600 font-medium">Pipeline Budget</span>
          <p className="text-2xl font-bold text-slate-900 font-display mt-1 tabular-nums">
            {formatINR(metrics.totalPipeline)}
          </p>
        </div>
      </div>

      {/* Filters & Search */}
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
            placeholder="Search by prospect name, phone, email, ID, or location..."
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
            aria-label="Filter by enquiry status"
          >
            <option value="ALL">All Statuses</option>
            {ENQUIRY_STATUSES.map((st) => (
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
            className="akd-select w-auto min-w-[150px]"
            aria-label="Filter by project type"
          >
            <option value="ALL">All Project Types</option>
            {settings.project_categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              setOnlyOverdue((prev) => !prev);
              setPage(1);
            }}
            className={`h-9 px-3 rounded-lg text-xs font-medium border transition-colors inline-flex items-center gap-1.5 ${
              onlyOverdue
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Overdue Follow-ups ({metrics.overdueCount})
          </button>
        </div>
      </div>

      {/* Enquiries Table */}
      <div className="akd-card overflow-hidden">
        {filteredEnquiries.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-900">
              No enquiries match your current criteria
            </p>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              Log a new prospective lead or clear your active search and filters.
            </p>
            <button
              type="button"
              onClick={() => openQuickModal({ type: 'enquiry' })}
              className="akd-btn-primary h-[34px] text-xs mt-1"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" /> Add Enquiry
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                    <th className="py-3 px-4">Prospect &amp; ID</th>
                    <th className="py-3 px-4">Project Type &amp; Location</th>
                    <th className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => toggleSort('estimated_budget')}
                        className="inline-flex items-center gap-1 hover:text-slate-900 ml-auto"
                      >
                        Est. Budget <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => toggleSort('enquiry_date')}
                        className="inline-flex items-center gap-1 hover:text-slate-900"
                      >
                        Enquiry Date <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => toggleSort('follow_up_date')}
                        className="inline-flex items-center gap-1 hover:text-slate-900"
                      >
                        Follow-up Date <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Latest Notes</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {paginatedEnquiries.map((enq) => {
                    const overdue = isFollowUpOverdue(enq.follow_up_date, enq.status);

                    return (
                      <tr
                        key={enq.id}
                        className={`transition-colors ${
                          overdue
                            ? 'bg-amber-50/40 hover:bg-amber-50/70'
                            : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-900 block">
                            {enq.name}
                          </span>
                          <div className="flex items-center gap-2 text-[11px] text-slate-600 mt-0.5">
                            <span className="font-mono">{enq.enquiry_code}</span>
                            <span>&bull;</span>
                            <span className="inline-flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {enq.phone}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-medium text-slate-900 block">
                            {enq.project_type}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                            <MapPin className="w-3 h-3 shrink-0" />
                            {enq.property_location || 'Kharagpur'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-slate-900">
                          {enq.estimated_budget ? formatINR(enq.estimated_budget) : '—'}
                        </td>

                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          {formatDate(enq.enquiry_date, settings.date_format)}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="text-slate-800 font-medium">
                            {formatDate(enq.follow_up_date, settings.date_format)}
                          </div>
                          {overdue && (
                            <Badge variant="danger" className="mt-1">
                              Overdue Follow-up
                            </Badge>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-1 items-start">
                            <Badge variant={getEnquiryStatusVariant(enq.status)}>
                              {enq.status}
                            </Badge>
                            {enq.status !== 'Converted' && (
                              <select
                                aria-label={`Change status for ${enq.name}`}
                                value={enq.status}
                                onChange={(e) =>
                                  handleStatusChange(
                                    enq.id,
                                    e.target.value as EnquiryStatus
                                  )
                                }
                                className="text-[11px] bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-700"
                              >
                                {ENQUIRY_STATUSES.map((st) => (
                                  <option key={st} value={st}>
                                    {st}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 max-w-[220px]">
                          <p className="text-slate-600 line-clamp-2">
                            {enq.notes || 'No notes recorded'}
                          </p>
                          {enq.converted_client_id && (
                            <button
                              type="button"
                              onClick={() => navigate(`/clients/${enq.converted_client_id}`)}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 hover:underline mt-1"
                            >
                              View Converted Client <ExternalLink className="w-3 h-3" />
                            </button>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {enq.status !== 'Converted' && (
                              <button
                                type="button"
                                onClick={() => setConvertTarget(enq)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#5448ED] hover:bg-[#4338CA] text-white text-[11px] font-medium transition-colors shadow-xs"
                                title="Convert Enquiry to Client &amp; Project"
                              >
                                <UserCheck className="w-3 h-3" /> Convert
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setNoteTarget(enq);
                                setFollowUpNoteText('');
                                setNextFollowUpDate(enq.follow_up_date || '');
                              }}
                              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                              title="Add Follow-up Note"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                openQuickModal({
                                  type: 'enquiry',
                                  editEnquiry: enq,
                                })
                              }
                              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                              title="Edit Enquiry"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeleteTarget(enq)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Archive Enquiry"
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
                  {Math.min(currentPage * pageSize, filteredEnquiries.length)} of{' '}
                  {filteredEnquiries.length} enquiries
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

      {/* Follow-Up Note Modal */}
      <Modal
        isOpen={Boolean(noteTarget)}
        onClose={() => setNoteTarget(null)}
        title={noteTarget ? `Follow-up Log — ${noteTarget.name}` : 'Follow-up Log'}
        subtitle="Record discussion notes and schedule the next follow-up date."
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setNoteTarget(null)}
              className="akd-btn-secondary h-9 text-xs"
            >
              Close
            </button>
            <button
              type="submit"
              form="followup-note-form"
              disabled={savingNote || !followUpNoteText.trim()}
              className="akd-btn-primary h-9 text-xs"
            >
              {savingNote ? 'Saving...' : 'Save Follow-up Note'}
            </button>
          </>
        }
      >
        {noteTarget && (
          <div className="space-y-4">
            <form
              id="followup-note-form"
              onSubmit={handleSaveFollowUpNote}
              className="space-y-3"
            >
              <div>
                <label className="akd-label">New Follow-up Note</label>
                <textarea
                  rows={3}
                  value={followUpNoteText}
                  onChange={(e) => setFollowUpNoteText(e.target.value)}
                  placeholder="Call outcome, site visit confirmation, quotation revisions..."
                  className="akd-textarea"
                  required
                />
              </div>

              <div>
                <label className="akd-label">Update Next Follow-up Date</label>
                <input
                  type="date"
                  value={nextFollowUpDate}
                  onChange={(e) => setNextFollowUpDate(e.target.value)}
                  className="akd-input"
                />
              </div>
            </form>

            {noteTarget.follow_up_history && noteTarget.follow_up_history.length > 0 && (
              <div className="pt-3 border-t border-slate-100 space-y-2 max-h-52 overflow-y-auto">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Previous Follow-up History
                </p>
                {noteTarget.follow_up_history.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs"
                  >
                    <p className="text-slate-800">{entry.content}</p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {formatDate(entry.created_at.slice(0, 10), settings.date_format)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Convert to Client & Project Modal */}
      <ConvertEnquiryModal
        isOpen={Boolean(convertTarget)}
        onClose={() => setConvertTarget(null)}
        enquiry={convertTarget}
        onConverted={(clientId, projectId) => {
          if (projectId) {
            navigate(`/projects/${projectId}`);
          } else {
            navigate(`/clients/${clientId}`);
          }
        }}
      />

      {/* Archive Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmArchive}
        isLoading={isDeleting}
        title="Archive Enquiry"
        description={
          deleteTarget
            ? `Are you sure you want to archive the enquiry from ${deleteTarget.name} (${deleteTarget.enquiry_code})?`
            : ''
        }
        confirmLabel="Archive Enquiry"
      />
    </div>
  );
};
