import React, { useState, useEffect } from 'react';
import { UserPlus, Plus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useCRM } from '@/context/CRMContext';
import { useToast } from '@/context/ToastContext';
import { ProjectTeamAssignment } from '@/types/crm';
import { TeamMemberModal } from './TeamMemberModal';

interface AssignTeamMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  editAssignment?: ProjectTeamAssignment;
}

export const AssignTeamMemberModal: React.FC<AssignTeamMemberModalProps> = ({
  isOpen,
  onClose,
  projectId,
  editAssignment,
}) => {
  const { teamMembers, teamAssignments, assignTeamMember, updateTeamAssignment } = useCRM();
  const { success, error: showError } = useToast();

  const [selectedMemberId, setSelectedMemberId] = useState(
    editAssignment?.team_member_id || ''
  );
  const [roleOnProject, setRoleOnProject] = useState(
    editAssignment?.role_on_project || ''
  );
  const [notes, setNotes] = useState(editAssignment?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createMemberModalOpen, setCreateMemberModalOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedMemberId(editAssignment?.team_member_id || '');
    setRoleOnProject(editAssignment?.role_on_project || '');
    setNotes(editAssignment?.notes || '');
  }, [isOpen, editAssignment?.id]);

  // Filter out members already assigned to this project (unless editing that assignment)
  const assignedMemberIds = new Set(
    teamAssignments
      .filter((a) => a.project_id === projectId && a.id !== editAssignment?.id)
      .map((a) => a.team_member_id)
  );
  const availableMembers = teamMembers.filter(
    (m) => m.is_active && !assignedMemberIds.has(m.id)
  );

  const handleMemberChange = (memberId: string) => {
    setSelectedMemberId(memberId);
    const member = teamMembers.find((m) => m.id === memberId);
    if (member && !roleOnProject) {
      setRoleOnProject(member.role);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId) {
      showError('Selection Required', 'Please select a team member to assign.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editAssignment) {
        await updateTeamAssignment(editAssignment.id, {
          role_on_project: roleOnProject.trim() || undefined,
          notes: notes.trim() || undefined,
        });
        success('Assignment Updated', 'Project role and assignment notes updated.');
      } else {
        await assignTeamMember(
          projectId,
          selectedMemberId,
          roleOnProject.trim() || undefined,
          notes.trim() || undefined
        );
        success('Team Member Assigned', 'Member successfully added to project team.');
      }
      onClose();
    } catch (err: any) {
      showError('Assignment Failed', err?.message || 'Could not save team assignment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={editAssignment ? 'Edit Project Team Assignment' : 'Assign Team Member to Project'}
        subtitle="Record site role and responsibilities for this project"
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="akd-label mb-0">
                Select Team Member <span className="text-rose-500">*</span>
              </label>
              {!editAssignment && (
                <button
                  type="button"
                  onClick={() => setCreateMemberModalOpen(true)}
                  className="text-xs font-semibold text-[#5448ED] hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> New Member
                </button>
              )}
            </div>

            {availableMembers.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center space-y-2">
                <p className="text-xs text-slate-600">
                  No available unassigned team members found.
                </p>
                <button
                  type="button"
                  onClick={() => setCreateMemberModalOpen(true)}
                  className="akd-btn-primary h-7 px-3 text-xs inline-flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Add New Team Member
                </button>
              </div>
            ) : (
              <select
                required
                disabled={Boolean(editAssignment)}
                value={selectedMemberId}
                onChange={(e) => handleMemberChange(e.target.value)}
                className="akd-select text-xs disabled:opacity-70"
              >
                <option value="">— Choose a team member —</option>
                {availableMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} ({m.role}){m.skill ? ` — ${m.skill}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="akd-label">Role on this Project</label>
            <input
              type="text"
              value={roleOnProject}
              onChange={(e) => setRoleOnProject(e.target.value)}
              placeholder="e.g. Master Cabinet Maker, Site Electrical Lead"
              className="akd-input text-xs"
            />
          </div>

          <div>
            <label className="akd-label">Assignment Notes (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Full-time on site for living room carpentry phase"
              className="akd-input text-xs"
            />
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-lg text-[11px] text-slate-500">
            <strong>Internal Use:</strong> Assigned team members are tracked privately for site management. Their phone numbers and internal assignment notes are never displayed on the public client portal.
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="akd-btn-secondary h-9 px-4 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedMemberId}
              className="akd-btn-primary h-9 px-5 text-xs"
            >
              {isSubmitting
                ? 'Saving...'
                : editAssignment
                ? 'Update Assignment'
                : 'Assign to Project'}
            </button>
          </div>
        </form>
      </Modal>

      {createMemberModalOpen && (
        <TeamMemberModal
          isOpen={createMemberModalOpen}
          onClose={() => setCreateMemberModalOpen(false)}
          onCreated={(newMember) => {
            setSelectedMemberId(newMember.id);
            setRoleOnProject(newMember.role);
          }}
        />
      )}
    </>
  );
};
