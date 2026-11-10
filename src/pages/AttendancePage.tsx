import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarCheck,
  Plus,
  Search,
  Clock,
  Users,
  Briefcase,
  CheckCircle2,
  Edit2,
  Trash2,
  Phone,
  UserPlus,
  Wrench,
  Calendar,
} from 'lucide-react';
import { useCRM } from '@/context/CRMContext';
import { formatDate, todayISO } from '@/lib/formatters';
import {
  ATTENDANCE_STATUSES,
  AttendanceStatus,
  TeamAttendance,
  TeamMember,
} from '@/types/crm';
import { AttendanceModal } from '@/components/modals/AttendanceModal';
import { TeamMemberModal } from '@/components/modals/TeamMemberModal';
import { AssignTeamMemberModal } from '@/components/modals/AssignTeamMemberModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/context/ToastContext';

export const AttendancePage: React.FC = () => {
  const {
    projects,
    teamMembers,
    teamAssignments,
    teamAttendance,
    settings,
    deleteAttendance,
    deleteTeamMember,
  } = useCRM();
  const { success, error: showError } = useToast();

  const [activeSection, setActiveSection] = useState<'history' | 'directory'>(
    'history'
  );

  // Filters
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState<string>('ALL');
  const [memberFilter, setMemberFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('');

  // Modals
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [defaultModalProjectId, setDefaultModalProjectId] = useState<
    string | undefined
  >(undefined);
  const [defaultModalMemberId, setDefaultModalMemberId] = useState<
    string | undefined
  >(undefined);
  const [defaultModalDate, setDefaultModalDate] = useState<string | undefined>(
    undefined
  );
  const [editAttendanceRecord, setEditAttendanceRecord] =
    useState<TeamAttendance | null>(null);

  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [assignModalProjectId, setAssignModalProjectId] = useState<
    string | null
  >(null);

  const [deletingAttendance, setDeletingAttendance] =
    useState<TeamAttendance | null>(null);
  const [deletingMember, setDeletingMember] = useState<TeamMember | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const memberMap = useMemo(
    () => new Map(teamMembers.map((m) => [m.id, m])),
    [teamMembers]
  );
  const projectMap = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects]
  );

  const today = todayISO();

  const todayStats = useMemo(() => {
    const todayRecords = teamAttendance.filter(
      (a) => a.attendance_date === today
    );
    const present = todayRecords.filter((a) => a.status === 'Present').length;
    const halfDay = todayRecords.filter((a) => a.status === 'Half Day').length;
    const absent = todayRecords.filter((a) => a.status === 'Absent').length;
    const totalHoursToday = todayRecords.reduce(
      (acc, r) => acc + (Number(r.working_hours) || 0),
      0
    );
    return {
      total: todayRecords.length,
      present,
      halfDay,
      absent,
      totalHoursToday,
    };
  }, [teamAttendance, today]);

  const filteredAttendance = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...teamAttendance]
      .filter((record) => {
        if (projectFilter !== 'ALL' && record.project_id !== projectFilter)
          return false;
        if (memberFilter !== 'ALL' && record.team_member_id !== memberFilter)
          return false;
        if (statusFilter !== 'ALL' && record.status !== statusFilter)
          return false;
        if (dateFilter && record.attendance_date !== dateFilter) return false;

        if (!q) return true;
        const member = memberMap.get(record.team_member_id);
        const project = projectMap.get(record.project_id);
        return (
          member?.full_name.toLowerCase().includes(q) ||
          member?.role.toLowerCase().includes(q) ||
          project?.project_name.toLowerCase().includes(q) ||
          project?.project_code.toLowerCase().includes(q) ||
          record.notes?.toLowerCase().includes(q) ||
          record.attendance_date.includes(q)
        );
      })
      .sort((a, b) => {
        const dCmp = (b.attendance_date || '').localeCompare(
          a.attendance_date || ''
        );
        if (dCmp !== 0) return dCmp;
        return (b.created_at || '').localeCompare(a.created_at || '');
      });
  }, [
    teamAttendance,
    projectFilter,
    memberFilter,
    statusFilter,
    dateFilter,
    search,
    memberMap,
    projectMap,
  ]);

  const filteredSummary = useMemo(() => {
    const present = filteredAttendance.filter(
      (a) => a.status === 'Present'
    ).length;
    const halfDay = filteredAttendance.filter(
      (a) => a.status === 'Half Day'
    ).length;
    const absent = filteredAttendance.filter(
      (a) => a.status === 'Absent'
    ).length;
    const totalHours = filteredAttendance.reduce(
      (sum, a) => sum + (Number(a.working_hours) || 0),
      0
    );
    const uniqueProjects = new Set(filteredAttendance.map((a) => a.project_id))
      .size;
    return { present, halfDay, absent, totalHours, uniqueProjects };
  }, [filteredAttendance]);

  const handleOpenMarkModal = (options?: {
    projectId?: string;
    memberId?: string;
    date?: string;
    edit?: TeamAttendance;
  }) => {
    setEditAttendanceRecord(options?.edit || null);
    setDefaultModalProjectId(
      options?.projectId ||
        (projectFilter !== 'ALL' ? projectFilter : undefined)
    );
    setDefaultModalMemberId(
      options?.memberId || (memberFilter !== 'ALL' ? memberFilter : undefined)
    );
    setDefaultModalDate(options?.date || dateFilter || todayISO());
    setAttendanceModalOpen(true);
  };

  const handleConfirmDeleteAttendance = async () => {
    if (!deletingAttendance) return;
    setIsDeleting(true);
    try {
      await deleteAttendance(deletingAttendance.id);
      success('Attendance Deleted', 'Attendance entry deleted');
      setDeletingAttendance(null);
    } catch (err: any) {
      showError('Delete Failed', err.message || 'Failed to delete attendance entry');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmDeleteMember = async () => {
    if (!deletingMember) return;
    setIsDeleting(true);
    try {
      await deleteTeamMember(deletingMember.id);
      success('Member Removed', 'Team member removed');
      setDeletingMember(null);
    } catch (err: any) {
      showError('Remove Failed', err.message || 'Failed to remove team member');
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadgeClass = (status: AttendanceStatus) => {
    if (status === 'Present') {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (status === 'Half Day') {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    return 'bg-rose-50 text-rose-700 border-rose-200';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Team &amp; Site Attendance
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Project-wise daily attendance, IN/OUT working hours &amp; site
            workforce directory
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setEditingMember(null);
              setTeamModalOpen(true);
            }}
            className="akd-btn-secondary"
          >
            <UserPlus className="w-4 h-4" />
            Add Team Member
          </button>
          <button
            onClick={() => handleOpenMarkModal()}
            className="akd-btn-primary"
          >
            <Plus className="w-4 h-4" />
            Mark Site Attendance
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="akd-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Today&apos;s Site Attendance
            </p>
            <CalendarCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {todayStats.present + todayStats.halfDay}
            <span className="text-sm font-normal text-slate-500 ml-1.5">
              on site today
            </span>
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {todayStats.present} Present • {todayStats.halfDay} Half Day •{' '}
            {todayStats.absent} Absent
          </p>
        </div>

        <div className="akd-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Working Hours (Filtered)
            </p>
            <Clock className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {filteredSummary.totalHours.toFixed(1)} hrs
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Across {filteredAttendance.length} attendance entries
          </p>
        </div>

        <div className="akd-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Status Breakdown
            </p>
            <CheckCircle2 className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-center gap-3 mt-2.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {filteredSummary.present} Present
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              {filteredSummary.halfDay} Half
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
              {filteredSummary.absent} Absent
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {filteredSummary.uniqueProjects} active project site(s) in view
          </p>
        </div>

        <div className="akd-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Studio Team Directory
            </p>
            <Users className="w-4 h-4 text-slate-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {teamMembers.filter((m) => m.is_active).length}
            <span className="text-sm font-normal text-slate-500 ml-1.5">
              active members
            </span>
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {teamAssignments.length} project site assignments
          </p>
        </div>
      </div>

      {/* Section Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveSection('history')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
            activeSection === 'history'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <CalendarCheck className="w-4 h-4" />
          Date-wise Attendance History ({teamAttendance.length})
        </button>
        <button
          onClick={() => setActiveSection('directory')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
            activeSection === 'directory'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4" />
          Team Members &amp; Site Assignments ({teamMembers.length})
        </button>
      </div>

      {activeSection === 'history' ? (
        <>
          {/* Filter Bar */}
          <div className="akd-card p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="relative lg:col-span-2">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search member, role, project, date, or notes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="akd-input pl-9"
                />
              </div>

              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="akd-select"
              >
                <option value="ALL">All Projects / Sites</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.project_name} ({p.project_code})
                  </option>
                ))}
              </select>

              <select
                value={memberFilter}
                onChange={(e) => setMemberFilter(e.target.value)}
                className="akd-select"
              >
                <option value="ALL">All Team Members</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} ({m.role})
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="akd-select"
              >
                <option value="ALL">All Statuses</option>
                {ATTENDANCE_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Filter by Date:
                </span>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-white text-slate-700"
                />
                <button
                  type="button"
                  onClick={() => setDateFilter(today)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                    dateFilter === today
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Today
                </button>
                {(dateFilter ||
                  projectFilter !== 'ALL' ||
                  memberFilter !== 'ALL' ||
                  statusFilter !== 'ALL' ||
                  search) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDateFilter('');
                      setProjectFilter('ALL');
                      setMemberFilter('ALL');
                      setStatusFilter('ALL');
                      setSearch('');
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800"
                  >
                    Clear Filters
                  </button>
                )}
              </div>

              <span className="text-xs text-slate-500">
                Showing <strong>{filteredAttendance.length}</strong> record(s)
              </span>
            </div>
          </div>

          {/* Attendance History Table */}
          {filteredAttendance.length === 0 ? (
            <div className="akd-card p-12 text-center">
              <CalendarCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-800">
                No attendance records found
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                Mark daily site attendance with IN/OUT time and automatic
                working hours calculation for your team members.
              </p>
              <button
                onClick={() => handleOpenMarkModal()}
                className="akd-btn-primary"
              >
                <Plus className="w-4 h-4" />
                Mark First Attendance
              </button>
            </div>
          ) : (
            <div className="akd-card overflow-hidden">
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="akd-th">Date</th>
                      <th className="akd-th">Team Member</th>
                      <th className="akd-th">Project / Site</th>
                      <th className="akd-th">Status</th>
                      <th className="akd-th">IN Time – OUT Time</th>
                      <th className="akd-th text-right">Working Hours</th>
                      <th className="akd-th">Notes</th>
                      <th className="akd-th text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAttendance.map((record) => {
                      const member = memberMap.get(record.team_member_id);
                      const project = projectMap.get(record.project_id);
                      return (
                        <tr
                          key={record.id}
                          className="hover:bg-slate-50/80 transition-colors"
                        >
                          <td className="akd-td whitespace-nowrap font-medium text-slate-900">
                            {formatDate(
                              record.attendance_date,
                              settings.date_format
                            )}
                          </td>
                          <td className="akd-td">
                            <div className="font-semibold text-slate-900">
                              {member?.full_name || 'Unknown Member'}
                            </div>
                            <div className="text-xs text-slate-500">
                              {member?.role || 'Team'}
                            </div>
                          </td>
                          <td className="akd-td">
                            {project ? (
                              <Link
                                to={`/projects/${project.id}`}
                                className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                              >
                                {project.project_name}
                              </Link>
                            ) : (
                              <span className="text-slate-400">
                                Project Archived
                              </span>
                            )}
                            {project && (
                              <div className="text-[11px] text-slate-400">
                                {project.project_code} •{' '}
                                {project.property_location}
                              </div>
                            )}
                          </td>
                          <td className="akd-td">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadgeClass(
                                record.status
                              )}`}
                            >
                              {record.status}
                            </span>
                          </td>
                          <td className="akd-td whitespace-nowrap text-xs font-mono text-slate-700">
                            {record.status === 'Absent' ? (
                              <span className="text-slate-400">—</span>
                            ) : record.in_time && record.out_time ? (
                              `${record.in_time} – ${record.out_time}`
                            ) : (
                              <span className="text-slate-400">Not set</span>
                            )}
                          </td>
                          <td className="akd-td text-right whitespace-nowrap">
                            <span className="font-mono font-bold text-slate-900">
                              {Number(record.working_hours || 0).toFixed(2)} hrs
                            </span>
                          </td>
                          <td className="akd-td max-w-xs truncate text-xs text-slate-600">
                            {record.notes || '—'}
                          </td>
                          <td className="akd-td text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() =>
                                  handleOpenMarkModal({ edit: record })
                                }
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                                title="Edit Attendance"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeletingAttendance(record)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                title="Delete Attendance"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-slate-100">
                {filteredAttendance.map((record) => {
                  const member = memberMap.get(record.team_member_id);
                  const project = projectMap.get(record.project_id);
                  return (
                    <div key={record.id} className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">
                            {member?.full_name || 'Unknown Member'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {member?.role} •{' '}
                            {formatDate(
                              record.attendance_date,
                              settings.date_format
                            )}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadgeClass(
                            record.status
                          )}`}
                        >
                          {record.status}
                        </span>
                      </div>

                      {project && (
                        <div className="text-xs">
                          <Link
                            to={`/projects/${project.id}`}
                            className="font-medium text-indigo-600 hover:underline"
                          >
                            {project.project_name}
                          </Link>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
                        <span>
                          {record.status === 'Absent'
                            ? 'Absent'
                            : record.in_time && record.out_time
                            ? `IN ${record.in_time} • OUT ${record.out_time}`
                            : 'Time not set'}
                        </span>
                        <span className="font-bold text-slate-900">
                          {Number(record.working_hours || 0).toFixed(2)} hrs
                        </span>
                      </div>

                      {record.notes && (
                        <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg">
                          {record.notes}
                        </p>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          onClick={() => handleOpenMarkModal({ edit: record })}
                          className="text-xs font-medium text-indigo-600 hover:underline flex items-center gap-1"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => setDeletingAttendance(record)}
                          className="text-xs font-medium text-rose-600 hover:underline flex items-center gap-1 ml-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        /* Team Directory & Assignments Section */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teamMembers.length === 0 ? (
            <div className="col-span-full akd-card p-12 text-center">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-800">
                No team members added yet
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                Add your supervisors, carpenters, electricians, painters, and
                contractors to assign them to projects and track daily
                attendance.
              </p>
              <button
                onClick={() => {
                  setEditingMember(null);
                  setTeamModalOpen(true);
                }}
                className="akd-btn-primary"
              >
                <UserPlus className="w-4 h-4" />
                Add First Team Member
              </button>
            </div>
          ) : (
            teamMembers.map((member) => {
              const memberAssignments = teamAssignments.filter(
                (a) => a.team_member_id === member.id
              );
              const memberAttendance = teamAttendance.filter(
                (a) => a.team_member_id === member.id
              );
              const totalHours = memberAttendance.reduce(
                (sum, a) => sum + (Number(a.working_hours) || 0),
                0
              );
              const presentDays = memberAttendance.filter(
                (a) => a.status === 'Present'
              ).length;
              const halfDays = memberAttendance.filter(
                (a) => a.status === 'Half Day'
              ).length;

              return (
                <div
                  key={member.id}
                  className="akd-card p-5 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          {member.full_name}
                        </h3>
                        <p className="text-xs font-medium text-indigo-600 mt-0.5">
                          {member.role}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          member.is_active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {member.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{member.phone}</span>
                      </div>
                      {member.skill && (
                        <div className="flex items-center gap-2">
                          <Wrench className="w-3.5 h-3.5 text-slate-400" />
                          <span>{member.skill}</span>
                        </div>
                      )}
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-[10px] uppercase text-slate-400 font-semibold">
                          Present
                        </p>
                        <p className="text-xs font-bold text-emerald-700">
                          {presentDays}d
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-slate-400 font-semibold">
                          Half Day
                        </p>
                        <p className="text-xs font-bold text-amber-700">
                          {halfDays}d
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-slate-400 font-semibold">
                          Hours
                        </p>
                        <p className="text-xs font-bold text-slate-900">
                          {totalHours.toFixed(1)}h
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
                        <Briefcase className="w-3.5 h-3.5" />
                        Assigned Projects ({memberAssignments.length})
                      </p>
                      {memberAssignments.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">
                          Not assigned to a site yet
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {memberAssignments.map((a) => {
                            const proj = projectMap.get(a.project_id);
                            if (!proj) return null;
                            return (
                              <Link
                                key={a.id}
                                to={`/projects/${proj.id}`}
                                className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-medium hover:bg-indigo-100"
                              >
                                {proj.project_name}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <button
                      onClick={() =>
                        handleOpenMarkModal({
                          memberId: member.id,
                          projectId: memberAssignments[0]?.project_id,
                        })
                      }
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      <CalendarCheck className="w-3.5 h-3.5" />
                      Mark Attendance
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingMember(member);
                          setTeamModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                        title="Edit Member"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingMember(member)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Remove Member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modals */}
      <AttendanceModal
        isOpen={attendanceModalOpen}
        onClose={() => {
          setAttendanceModalOpen(false);
          setEditAttendanceRecord(null);
        }}
        defaultProjectId={defaultModalProjectId}
        defaultMemberId={defaultModalMemberId}
        defaultDate={defaultModalDate}
        editRecord={editAttendanceRecord}
      />

      <TeamMemberModal
        isOpen={teamModalOpen}
        onClose={() => {
          setTeamModalOpen(false);
          setEditingMember(null);
        }}
        editMember={editingMember || undefined}
      />

      {assignModalProjectId && (
        <AssignTeamMemberModal
          isOpen={Boolean(assignModalProjectId)}
          onClose={() => setAssignModalProjectId(null)}
          projectId={assignModalProjectId}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(deletingAttendance)}
        onClose={() => setDeletingAttendance(null)}
        onConfirm={handleConfirmDeleteAttendance}
        title="Delete Attendance Entry?"
        description="Are you sure you want to remove this attendance entry? This action cannot be undone."
        confirmLabel="Delete Entry"
        isLoading={isDeleting}
      />

      <ConfirmDialog
        isOpen={Boolean(deletingMember)}
        onClose={() => setDeletingMember(null)}
        onConfirm={handleConfirmDeleteMember}
        title="Remove Team Member?"
        description={`Remove ${deletingMember?.full_name} from the studio directory?`}
        confirmLabel="Remove Member"
        isLoading={isDeleting}
      />
    </div>
  );
};
