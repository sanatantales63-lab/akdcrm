import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useCRM } from '@/context/CRMContext';
import { useToast } from '@/context/ToastContext';
import { TeamMember, TeamMemberRole, TEAM_MEMBER_ROLES } from '@/types/crm';

interface TeamMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  editMember?: TeamMember;
  onCreated?: (created: TeamMember) => void;
}

export const TeamMemberModal: React.FC<TeamMemberModalProps> = ({
  isOpen,
  onClose,
  editMember,
  onCreated,
}) => {
  const { createTeamMember, updateTeamMember } = useCRM();
  const { success, error: showError } = useToast();

  const [fullName, setFullName] = useState(editMember?.full_name || '');
  const [phone, setPhone] = useState(editMember?.phone || '');
  const [role, setRole] = useState<TeamMemberRole>(editMember?.role || 'Carpenter');
  const [skill, setSkill] = useState(editMember?.skill || '');
  const [notes, setNotes] = useState(editMember?.notes || '');
  const [isActive, setIsActive] = useState(editMember ? editMember.is_active : true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editMember) {
      setFullName(editMember.full_name);
      setPhone(editMember.phone);
      setRole(editMember.role);
      setSkill(editMember.skill || '');
      setNotes(editMember.notes || '');
      setIsActive(editMember.is_active);
    } else {
      setFullName('');
      setPhone('');
      setRole('Carpenter');
      setSkill('');
      setNotes('');
      setIsActive(true);
    }
  }, [editMember, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      showError('Validation Error', 'Team member full name is required.');
      return;
    }
    if (!phone.trim()) {
      showError('Validation Error', 'Team member phone number is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editMember) {
        const updated = await updateTeamMember(editMember.id, {
          full_name: fullName.trim(),
          phone: phone.trim(),
          role,
          skill: skill.trim() || undefined,
          notes: notes.trim() || undefined,
          is_active: isActive,
        });
        success('Member Updated', `Updated details for ${updated.full_name}.`);
        onClose();
      } else {
        const created = await createTeamMember({
          full_name: fullName.trim(),
          phone: phone.trim(),
          role,
          skill: skill.trim() || undefined,
          notes: notes.trim() || undefined,
          is_active: isActive,
        });
        success('Team Member Added', `Added ${created.full_name} (${created.role}) to directory.`);
        if (onCreated) onCreated(created);
        onClose();
      }
    } catch (err: any) {
      showError('Save Failed', err?.message || 'Could not save team member.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editMember ? 'Edit Team Member' : 'Add Team Member'}
      subtitle="Record workers, specialists, and supervisors for interior projects"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="akd-label">
            Full Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Subhash Mistry"
            className="akd-input text-xs"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="akd-label">
              Phone Number <span className="text-rose-500">*</span>
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98300 00000"
              className="akd-input text-xs"
            />
          </div>

          <div>
            <label className="akd-label">Work Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as TeamMemberRole)}
              className="akd-select text-xs"
            >
              {TEAM_MEMBER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="akd-label">Skill or Specialization (Optional)</label>
          <input
            type="text"
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
            placeholder="e.g. False Ceiling & Gypsum, PU Finish, Acrylic Shutters"
            className="akd-input text-xs"
          />
        </div>

        <div>
          <label className="akd-label">Internal Notes (Optional)</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Contractor rates, availability, daily wage or milestone terms..."
            className="akd-textarea text-xs"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="is_active_member"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-[#5448ED] focus:ring-[#5448ED]"
          />
          <label htmlFor="is_active_member" className="text-xs font-medium text-slate-700 cursor-pointer">
            Active for project assignments
          </label>
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
            disabled={isSubmitting}
            className="akd-btn-primary h-9 px-5 text-xs"
          >
            {isSubmitting ? 'Saving...' : editMember ? 'Update Member' : 'Add Team Member'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
