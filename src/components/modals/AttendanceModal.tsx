import React, { useState, useEffect, useMemo } from 'react';
import { useCRM } from '@/context/CRMContext';
import { useToast } from '@/context/ToastContext';
import {
  ATTENDANCE_STATUSES,
  AttendanceStatus,
  TeamAttendance,
} from '@/types/crm';
import { calculateWorkingHours } from '@/services/database';
import { todayISO } from '@/lib/formatters';
import {
  X,
  CalendarCheck,
  Clock,
  AlertCircle,
  CheckCircle2,
  Edit3,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultProjectId?: string;
  defaultMemberId?: string;
  defaultDate?: string;
  editRecord?: TeamAttendance | null;
}

export const AttendanceModal: React.FC<Props> = ({
  isOpen,
  onClose,
  defaultProjectId,
  defaultMemberId,
  defaultDate,
  editRecord,
}) => {
  const {
    projects,
    teamMembers,
    teamAssignments,
    teamAttendance,
    createAttendance,
    updateAttendance,
  } = useCRM();
  const { success, error: showError } = useToast();

  const [editingEntry, setEditingEntry] = useState<TeamAttendance | null>(
    editRecord || null
  );
  const [projectId, setProjectId] = useState('');
  const [teamMemberId, setTeamMemberId] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(todayISO());
  const [status, setStatus] = useState<AttendanceStatus>('Present');
  const [inTime, setInTime] = useState('09:00');
  const [outTime, setOutTime] = useState('18:00');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setEditingEntry(editRecord || null);
  }, [editRecord, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (editingEntry) {
      setProjectId(editingEntry.project_id);
      setTeamMemberId(editingEntry.team_member_id);
      setAttendanceDate(editingEntry.attendance_date || todayISO());
      setStatus(editingEntry.status);
      setInTime(editingEntry.in_time || '09:00');
      setOutTime(editingEntry.out_time || '18:00');
      setNotes(editingEntry.notes || '');
    } else {
      const initialProject =
        defaultProjectId || (projects.length > 0 ? projects[0].id : '');
      setProjectId(initialProject);
      setTeamMemberId(defaultMemberId || '');
      setAttendanceDate(defaultDate || todayISO());
      setStatus('Present');
      setInTime('09:00');
      setOutTime('18:00');
      setNotes('');
    }
  }, [
    isOpen,
    editingEntry,
    defaultProjectId,
    defaultMemberId,
    defaultDate,
    projects,
  ]);

  // Prioritize members assigned to the selected project
  const sortedMembers = useMemo(() => {
    const activeList = teamMembers.filter(
      (m) => m.is_active || m.id === teamMemberId
    );
    const assignedSet = new Set(
      teamAssignments
        .filter((a) => a.project_id === projectId)
        .map((a) => a.team_member_id)
    );
    return [...activeList].sort((a, b) => {
      const aAssigned = assignedSet.has(a.id) ? 0 : 1;
      const bAssigned = assignedSet.has(b.id) ? 0 : 1;
      if (aAssigned !== bAssigned) return aAssigned - bAssigned;
      return a.full_name.localeCompare(b.full_name);
    });
  }, [teamMembers, teamAssignments, projectId, teamMemberId]);

  const assignedMemberIds = useMemo(
    () =>
      new Set(
        teamAssignments
          .filter((a) => a.project_id === projectId)
          .map((a) => a.team_member_id)
      ),
    [teamAssignments, projectId]
  );

  // Detect duplicate attendance for (teamMemberId, projectId, attendanceDate)
  const duplicateRecord = useMemo(() => {
    if (!teamMemberId || !projectId || !attendanceDate) return undefined;
    return teamAttendance.find(
      (a) =>
        a.id !== editingEntry?.id &&
        a.team_member_id === teamMemberId &&
        a.project_id === projectId &&
        a.attendance_date === attendanceDate
    );
  }, [teamAttendance, teamMemberId, projectId, attendanceDate, editingEntry]);

  const calculatedHours = useMemo(() => {
    return calculateWorkingHours(inTime, outTime, status);
  }, [inTime, outTime, status]);

  const hasInvalidTimeOrder = useMemo(() => {
    if (status === 'Absent' || !inTime || !outTime) return false;
    const [inH, inM] = inTime.split(':').map(Number);
    const [outH, outM] = outTime.split(':').map(Number);
    return outH * 60 + outM <= inH * 60 + inM;
  }, [inTime, outTime, status]);

  if (!isOpen) return null;

  const handleStatusChange = (nextStatus: AttendanceStatus) => {
    setStatus(nextStatus);
    if (nextStatus === 'Present') {
      if (!inTime) setInTime('09:00');
      if (!outTime || outTime === '13:30') setOutTime('18:00');
    } else if (nextStatus === 'Half Day') {
      if (!inTime) setInTime('09:00');
      if (!outTime || outTime === '18:00') setOutTime('13:30');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      showError('Validation Error', 'Please select a project/site');
      return;
    }
    if (!teamMemberId) {
      showError('Validation Error', 'Please select a team member');
      return;
    }
    if (!attendanceDate) {
      showError('Validation Error', 'Please select an attendance date');
      return;
    }
    if (duplicateRecord) {
      showError(
        'Duplicate Attendance',
        'Attendance is already recorded for this member, project, and date.'
      );
      return;
    }
    if (status !== 'Absent' && hasInvalidTimeOrder) {
      showError('Invalid Time', 'OUT time must be later than IN time');
      return;
    }

    setSubmitting(true);
    try {
      if (editingEntry) {
        await updateAttendance(editingEntry.id, {
          project_id: projectId,
          team_member_id: teamMemberId,
          attendance_date: attendanceDate,
          status,
          in_time: status === 'Absent' ? null : inTime || null,
          out_time: status === 'Absent' ? null : outTime || null,
          notes,
        });
        success('Attendance Updated', 'Attendance record updated');
      } else {
        await createAttendance({
          project_id: projectId,
          team_member_id: teamMemberId,
          attendance_date: attendanceDate,
          status,
          in_time: status === 'Absent' ? null : inTime || null,
          out_time: status === 'Absent' ? null : outTime || null,
          notes,
        });
        success('Attendance Recorded', 'Daily attendance recorded');
      }
      onClose();
    } catch (err: any) {
      showError('Save Failed', err.message || 'Failed to save attendance');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <CalendarCheck className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-semibold">
              {editingEntry ? 'Edit Site Attendance' : 'Mark Daily Site Attendance'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-4 max-h-[82vh] overflow-y-auto"
        >
          <div>
            <label className="akd-label">Project / Site *</label>
            <select
              className="akd-input"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              required
            >
              <option value="">Select Project / Site...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_name} ({p.project_code} • {p.property_location})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="akd-label">Team Member *</label>
              <select
                className="akd-input"
                value={teamMemberId}
                onChange={(e) => setTeamMemberId(e.target.value)}
                required
              >
                <option value="">Select Member...</option>
                {sortedMembers.map((m) => {
                  const isAssigned = assignedMemberIds.has(m.id);
                  return (
                    <option key={m.id} value={m.id}>
                      {m.full_name} ({m.role})
                      {isAssigned ? ' — [Assigned to Site]' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="akd-label">Attendance Date *</label>
              <input
                type="date"
                className="akd-input"
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
                required
              />
            </div>
          </div>

          {duplicateRecord && (
            <div className="flex items-start justify-between gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
              <div className="flex items-start gap-2.5 text-xs">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">
                    Attendance already marked for this member, site & date
                  </p>
                  <p className="text-amber-700 mt-0.5">
                    Status: <strong>{duplicateRecord.status}</strong>
                    {duplicateRecord.in_time && duplicateRecord.out_time
                      ? ` (${duplicateRecord.in_time} – ${duplicateRecord.out_time} • ${duplicateRecord.working_hours} hrs)`
                      : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingEntry(duplicateRecord)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 shrink-0"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit Existing
              </button>
            </div>
          )}

          <div>
            <label className="akd-label">Attendance Status *</label>
            <div className="grid grid-cols-3 gap-2.5">
              {ATTENDANCE_STATUSES.map((st) => {
                const isSelected = status === st;
                const activeClasses =
                  st === 'Present'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                    : st === 'Half Day'
                    ? 'bg-amber-50 border-amber-500 text-amber-800 ring-2 ring-amber-500/20'
                    : 'bg-rose-50 border-rose-500 text-rose-800 ring-2 ring-rose-500/20';
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleStatusChange(st)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? activeClasses
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {st}
                  </button>
                );
              })}
            </div>
          </div>

          {status !== 'Absent' ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="akd-label">IN Time</label>
                  <input
                    type="time"
                    className="akd-input bg-white"
                    value={inTime}
                    onChange={(e) => setInTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="akd-label">OUT Time</label>
                  <input
                    type="time"
                    className="akd-input bg-white"
                    value={outTime}
                    onChange={(e) => setOutTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200/70">
                <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" />
                  Auto-Calculated Working Hours
                </span>
                {hasInvalidTimeOrder ? (
                  <span className="text-xs font-semibold text-rose-600">
                    OUT time must be after IN time
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold">
                    {calculatedHours.toFixed(2)} hrs
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-center justify-between">
              <span>Member marked Absent — IN/OUT time not applicable</span>
              <span className="font-semibold text-slate-700">0.00 hrs</span>
            </div>
          )}

          <div>
            <label className="akd-label">Work / Shift Notes</label>
            <textarea
              rows={2}
              className="akd-input"
              placeholder="Optional site task notes, overtime details, or remarks..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="akd-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || Boolean(duplicateRecord)}
              className="akd-btn-primary"
            >
              {submitting
                ? 'Saving...'
                : editingEntry
                ? 'Update Attendance'
                : 'Save Attendance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
