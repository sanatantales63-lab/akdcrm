import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  X,
  Lock,
  Eye,
  Trash2,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useCRM } from '@/context/CRMContext';
import { useToast } from '@/context/ToastContext';
import { WorkStage, WORK_STAGES, ProjectWorkUpdate } from '@/types/crm';
import { todayISO } from '@/lib/formatters';

interface WorkUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  editUpdate?: ProjectWorkUpdate;
  currentProjectProgress?: number;
}

interface PendingPhoto {
  file: File;
  previewUrl: string;
  caption: string;
  isVisibleToClient: boolean;
}

interface ExistingPhotoEdit {
  id: string;
  photo_url: string;
  caption: string;
  isVisibleToClient: boolean;
}

export const WorkUpdateModal: React.FC<WorkUpdateModalProps> = ({
  isOpen,
  onClose,
  projectId,
  editUpdate,
  currentProjectProgress = 0,
}) => {
  const {
    projectPhotos,
    createWorkUpdate,
    updateWorkUpdate,
    uploadProjectPhoto,
    updateProjectPhoto,
    deleteProjectPhoto,
  } = useCRM();
  const { success, error: showError } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [updateDate, setUpdateDate] = useState<string>(
    editUpdate?.update_date || todayISO()
  );
  const [workStage, setWorkStage] = useState<WorkStage>(
    editUpdate?.work_stage || 'Work in Progress'
  );
  const [workCompleted, setWorkCompleted] = useState<string>(
    editUpdate?.work_completed || ''
  );
  const [progressPercentage, setProgressPercentage] = useState<number>(
    editUpdate ? editUpdate.progress_percentage : Math.max(currentProjectProgress, 10)
  );
  const [workRemaining, setWorkRemaining] = useState<string>(
    editUpdate?.work_remaining || ''
  );
  const [clientNote, setClientNote] = useState<string>(
    editUpdate?.client_note || ''
  );
  const [internalNote, setInternalNote] = useState<string>(
    editUpdate?.internal_note || ''
  );
  const [isVisibleToClient, setIsVisibleToClient] = useState<boolean>(
    editUpdate ? editUpdate.is_visible_to_client : true
  );

  const [existingPhotos, setExistingPhotos] = useState<ExistingPhotoEdit[]>([]);
  const [deletedPhotoIds, setDeletedPhotoIds] = useState<string[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setUpdateDate(editUpdate?.update_date || todayISO());
    setWorkStage(editUpdate?.work_stage || 'Work in Progress');
    setWorkCompleted(editUpdate?.work_completed || '');
    setProgressPercentage(
      editUpdate ? editUpdate.progress_percentage : Math.max(currentProjectProgress, 10)
    );
    setWorkRemaining(editUpdate?.work_remaining || '');
    setClientNote(editUpdate?.client_note || '');
    setInternalNote(editUpdate?.internal_note || '');
    setIsVisibleToClient(editUpdate ? editUpdate.is_visible_to_client : true);
    setPendingPhotos([]);
    setDeletedPhotoIds([]);

    if (editUpdate) {
      const attached = projectPhotos
        .filter((ph) => ph.work_update_id === editUpdate.id)
        .map((ph) => ({
          id: ph.id,
          photo_url: ph.photo_url,
          caption: ph.caption || '',
          isVisibleToClient: ph.is_visible_to_client,
        }));
      setExistingPhotos(attached);
    } else {
      setExistingPhotos([]);
    }
  }, [isOpen, editUpdate?.id]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newPending: PendingPhoto[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        showError('Invalid File', `${file.name} is not a JPG, PNG, or WebP image.`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        showError('File Too Large', `${file.name} exceeds the 10MB size limit.`);
        continue;
      }

      newPending.push({
        file,
        previewUrl: URL.createObjectURL(file),
        caption: '',
        isVisibleToClient: isVisibleToClient,
      });
    }

    setPendingPhotos((prev) => [...prev, ...newPending]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemovePendingPhoto = (index: number) => {
    setPendingPhotos((prev) => {
      const target = prev[index];
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleUpdatePhotoCaption = (index: number, caption: string) => {
    setPendingPhotos((prev) =>
      prev.map((p, i) => (i === index ? { ...p, caption } : p))
    );
  };

  const handleUpdateExistingCaption = (id: string, caption: string) => {
    setExistingPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, caption } : p))
    );
  };

  const handleToggleExistingVisibility = (id: string) => {
    setExistingPhotos((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, isVisibleToClient: !p.isVisibleToClient } : p
      )
    );
  };

  const handleMarkExistingDeleted = (id: string) => {
    setExistingPhotos((prev) => prev.filter((p) => p.id !== id));
    setDeletedPhotoIds((prev) => [...prev, id]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workCompleted.trim()) {
      showError('Validation Error', 'Please describe the work completed.');
      return;
    }

    setIsSubmitting(true);
    try {
      const clampedProgress = Math.min(100, Math.max(0, Number(progressPercentage) || 0));

      if (editUpdate) {
        await updateWorkUpdate(editUpdate.id, {
          update_date: updateDate,
          work_stage: workStage,
          work_completed: workCompleted.trim(),
          progress_percentage: clampedProgress,
          work_remaining: workRemaining.trim() || undefined,
          client_note: clientNote.trim() || undefined,
          internal_note: internalNote.trim() || undefined,
          is_visible_to_client: isVisibleToClient,
        });

        for (const delId of deletedPhotoIds) {
          await deleteProjectPhoto(delId);
        }

        for (const ex of existingPhotos) {
          await updateProjectPhoto(ex.id, {
            caption: ex.caption.trim() || undefined,
            is_visible_to_client: isVisibleToClient ? ex.isVisibleToClient : false,
          });
        }

        // Upload any newly selected photos linked to this update
        for (const p of pendingPhotos) {
          await uploadProjectPhoto(projectId, p.file, {
            caption: p.caption.trim() || undefined,
            workUpdateId: editUpdate.id,
            isVisibleToClient: p.isVisibleToClient && isVisibleToClient,
          });
        }

        success('Update Saved', 'Work progress update and project completion synced.');
      } else {
        // 1. Upload photos first
        const uploadedIds: string[] = [];
        for (const p of pendingPhotos) {
          const photo = await uploadProjectPhoto(projectId, p.file, {
            caption: p.caption.trim() || undefined,
            isVisibleToClient: p.isVisibleToClient && isVisibleToClient,
          });
          uploadedIds.push(photo.id);
        }

        // 2. Create work update and link photos
        await createWorkUpdate({
          project_id: projectId,
          update_date: updateDate,
          work_stage: workStage,
          work_completed: workCompleted.trim(),
          progress_percentage: clampedProgress,
          work_remaining: workRemaining.trim() || undefined,
          client_note: clientNote.trim() || undefined,
          internal_note: internalNote.trim() || undefined,
          is_visible_to_client: isVisibleToClient,
          photo_ids: uploadedIds,
        });

        success('Work Progress Updated', `Project updated to ${workStage} (${clampedProgress}%).`);
      }

      onClose();
    } catch (err: any) {
      showError('Save Failed', err?.message || 'Could not save work update.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editUpdate ? 'Edit Work Progress Update' : 'Add Dated Work Update'}
      subtitle="Record site milestones, completed work, next steps, and progress photographs"
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Row 1: Date & Work Stage */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="akd-label">Update Date</label>
            <input
              type="date"
              required
              value={updateDate}
              onChange={(e) => setUpdateDate(e.target.value)}
              className="akd-input text-xs"
            />
          </div>

          <div>
            <label className="akd-label">Current Work Stage</label>
            <select
              value={workStage}
              onChange={(e) => setWorkStage(e.target.value as WorkStage)}
              className="akd-select text-xs"
            >
              {WORK_STAGES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Progress Percentage Slider */}
        <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-800">
              Overall Project Completion (%)
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={100}
                value={progressPercentage}
                onChange={(e) =>
                  setProgressPercentage(Math.min(100, Math.max(0, Number(e.target.value) || 0)))
                }
                className="w-16 text-right px-2 py-0.5 text-xs font-bold text-[#5448ED] border border-slate-300 rounded bg-white"
              />
              <span className="font-bold text-[#5448ED] text-xs">%</span>
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={progressPercentage}
            onChange={(e) => setProgressPercentage(Number(e.target.value))}
            className="w-full accent-[#5448ED] cursor-pointer"
          />
          <p className="text-[11px] text-slate-500">
            Saving the latest dated update automatically synchronizes the project&apos;s overall completion percentage and work stage across the CRM and client tracking portal.
          </p>
        </div>

        {/* Work Completed */}
        <div>
          <label className="akd-label">
            Work Completed (Client-Visible Description) <span className="text-rose-500">*</span>
          </label>
          <textarea
            required
            rows={3}
            value={workCompleted}
            onChange={(e) => setWorkCompleted(e.target.value)}
            placeholder="e.g. Completed living room false ceiling framing and drywall boarding; electrical conduit boxes placed."
            className="akd-textarea text-xs"
          />
        </div>

        {/* Work Remaining / Next Planned Work */}
        <div>
          <label className="akd-label">Next Steps / Upcoming Work (Optional)</label>
          <input
            type="text"
            value={workRemaining}
            onChange={(e) => setWorkRemaining(e.target.value)}
            placeholder="e.g. Master wardrobe carcass assembly and veneer spray priming"
            className="akd-input text-xs"
          />
        </div>

        {/* Visibility Setting & Notes */}
        <div className="p-4 rounded-xl border border-slate-200/80 bg-white space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-900 block">
                Client Portal Visibility
              </span>
              <span className="text-[11px] text-slate-500 block">
                Control whether this update appears on the public client tracking link
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsVisibleToClient(!isVisibleToClient)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  isVisibleToClient ? 'bg-[#5448ED]' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    isVisibleToClient ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-xs font-semibold text-slate-800">
                {isVisibleToClient ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600">
                    <Eye className="w-3.5 h-3.5" /> Visible to Client
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <Lock className="w-3.5 h-3.5" /> Internal Only
                  </span>
                )}
              </span>
            </div>
          </div>

          {isVisibleToClient && (
            <div>
              <label className="akd-label">
                Client-Visible Note (Optional — Shown on Client Portal)
              </label>
              <textarea
                rows={2}
                value={clientNote}
                onChange={(e) => setClientNote(e.target.value)}
                placeholder="e.g. Your plywood carcass structure has been inspected and approved. Surface polish begins next week."
                className="akd-textarea text-xs"
              />
            </div>
          )}

          <div>
            <label className="akd-label">
              Internal Studio Note (Optional — Never Visible to Client)
            </label>
            <input
              type="text"
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              placeholder="e.g. Hardware invoice pending clearance with vendor; check edge-band margin."
              className="akd-input text-xs"
            />
          </div>
        </div>

        {/* Photo Upload & Existing Photos Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="akd-label mb-0">Progress Photographs &amp; Captions</label>
              <p className="text-[11px] text-slate-500">
                Upload clear JPG, PNG, or WebP site photos (stored in Supabase Storage, max 10MB each)
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="akd-btn-secondary h-8 px-3 text-xs inline-flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-600" /> Upload Photos
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {(existingPhotos.length > 0 || pendingPhotos.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              {existingPhotos.map((ex) => (
                <div
                  key={ex.id}
                  className="relative rounded-lg overflow-hidden border border-slate-200 bg-white flex flex-col"
                >
                  <div className="relative">
                    <img
                      src={ex.photo_url}
                      alt={ex.caption || 'Existing project photo'}
                      className="w-full h-28 object-cover"
                    />
                    <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleToggleExistingVisibility(ex.id)}
                        title={ex.isVisibleToClient ? 'Visible to client' : 'Hidden from client'}
                        className={`p-1 rounded-full text-white transition-colors ${
                          ex.isVisibleToClient ? 'bg-emerald-600/90' : 'bg-slate-800/80'
                        }`}
                      >
                        {ex.isVisibleToClient ? (
                          <Eye className="w-3 h-3" />
                        ) : (
                          <Lock className="w-3 h-3" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMarkExistingDeleted(ex.id)}
                        title="Delete photo"
                        className="p-1 rounded-full bg-slate-900/75 text-white hover:bg-rose-600 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="p-2">
                    <input
                      type="text"
                      placeholder="Photo caption..."
                      value={ex.caption}
                      onChange={(e) => handleUpdateExistingCaption(ex.id, e.target.value)}
                      className="w-full text-[11px] px-2 py-1 border border-slate-200 rounded text-slate-800 focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>
                </div>
              ))}

              {pendingPhotos.map((p, idx) => (
                <div
                  key={idx}
                  className="relative rounded-lg overflow-hidden border border-indigo-200 bg-white flex flex-col"
                >
                  <div className="relative">
                    <img
                      src={p.previewUrl}
                      alt={`New upload ${idx + 1}`}
                      className="w-full h-28 object-cover"
                    />
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-indigo-600 text-white">
                      New
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemovePendingPhoto(idx)}
                      className="absolute top-1.5 right-1.5 p-1 rounded-full bg-slate-900/75 text-white hover:bg-rose-600 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="p-2">
                    <input
                      type="text"
                      placeholder="Add photo caption..."
                      value={p.caption}
                      onChange={(e) => handleUpdatePhotoCaption(idx, e.target.value)}
                      className="w-full text-[11px] px-2 py-1 border border-slate-200 rounded text-slate-800 focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
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
            className="akd-btn-primary h-9 px-5 text-xs inline-flex items-center gap-1.5"
          >
            {isSubmitting ? 'Saving Update...' : 'Save Work Update'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
