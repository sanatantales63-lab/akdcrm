import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserPlus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Project, PROJECT_STATUSES, ProjectStatus } from '@/types/crm';
import { useCRM } from '@/context/CRMContext';
import { useToast } from '@/context/ToastContext';
import { todayISO } from '@/lib/formatters';

const projectSchema = z.object({
  project_name: z.string().trim().min(2, 'Project name is required'),
  client_id: z.string().trim().min(1, 'Please select an associated client'),
  category: z.string().trim().min(1, 'Project category is required'),
  property_location: z.string().trim().min(1, 'Property location is required'),
  site_address: z.string().trim().optional(),
  description: z.string().trim().optional(),
  total_value: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? 0 : Number(val)),
    z.number().min(0, 'Project value cannot be negative')
  ),
  estimated_start_date: z.string().optional(),
  expected_completion_date: z.string().optional(),
  actual_completion_date: z.string().optional(),
  status: z.enum([
    'Planning',
    'Design',
    'Quotation',
    'Approved',
    'In Progress',
    'On Hold',
    'Completed',
    'Cancelled',
  ]),
  progress_percentage: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? 0 : Number(val)),
    z.number().min(0, 'Min 0%').max(100, 'Max 100%')
  ),
  payment_terms: z.string().trim().optional(),
  internal_notes: z.string().trim().optional(),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

interface ProjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editProject?: Project;
  preselectedClientId?: string;
  onSuccess?: (project: Project) => void;
}

export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({
  isOpen,
  onClose,
  editProject,
  preselectedClientId,
  onSuccess,
}) => {
  const {
    settings,
    clients,
    createProject,
    updateProject,
    openQuickModal,
  } = useCRM();
  const { success, error: showError } = useToast();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      project_name: '',
      client_id: preselectedClientId || '',
      category: settings.project_categories[0] || 'Residential Interior',
      property_location: 'Kharagpur',
      site_address: '',
      description: '',
      total_value: 0,
      estimated_start_date: todayISO(),
      expected_completion_date: '',
      actual_completion_date: '',
      status: 'Planning',
      progress_percentage: 0,
      payment_terms: '30% Advance, 40% Carpentry Milestone, 20% Finishing, 10% Handover',
      internal_notes: '',
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    if (editProject) {
      reset({
        project_name: editProject.project_name,
        client_id: editProject.client_id,
        category: editProject.category,
        property_location: editProject.property_location,
        site_address: editProject.site_address || '',
        description: editProject.description || '',
        total_value: editProject.total_value,
        estimated_start_date: editProject.estimated_start_date || '',
        expected_completion_date: editProject.expected_completion_date || '',
        actual_completion_date: editProject.actual_completion_date || '',
        status: editProject.status,
        progress_percentage: editProject.progress_percentage,
        payment_terms: editProject.payment_terms || '',
        internal_notes: editProject.internal_notes || '',
      });
    } else {
      const preClient = clients.find((c) => c.id === preselectedClientId);
      reset({
        project_name: preClient ? `${preClient.full_name} — Interior Project` : '',
        client_id: preselectedClientId || (clients[0]?.id ?? ''),
        category: settings.project_categories[0] || 'Residential Interior',
        property_location: preClient?.property_location || 'Kharagpur',
        site_address: preClient?.full_address || '',
        description: '',
        total_value: preClient?.project_budget || 0,
        estimated_start_date: todayISO(),
        expected_completion_date: '',
        actual_completion_date: '',
        status: 'Planning',
        progress_percentage: 0,
        payment_terms: '30% Advance, 40% Carpentry Milestone, 20% Finishing, 10% Handover',
        internal_notes: '',
      });
    }
  }, [isOpen, editProject, preselectedClientId, clients, reset, settings.project_categories]);

  const watchedStatus = watch('status');
  const watchedProgress = watch('progress_percentage');

  useEffect(() => {
    if (watchedStatus === 'Completed') {
      setValue('progress_percentage', 100);
    }
  }, [watchedStatus, setValue]);

  const onSubmit = async (values: ProjectFormValues) => {
    try {
      if (editProject) {
        const updated = await updateProject(editProject.id, {
          project_name: values.project_name,
          client_id: values.client_id,
          category: values.category,
          property_location: values.property_location,
          site_address: values.site_address || undefined,
          description: values.description || undefined,
          total_value: values.total_value,
          estimated_start_date: values.estimated_start_date || undefined,
          expected_completion_date: values.expected_completion_date || undefined,
          actual_completion_date: values.actual_completion_date || undefined,
          status: values.status as ProjectStatus,
          progress_percentage: values.progress_percentage,
          payment_terms: values.payment_terms || undefined,
          internal_notes: values.internal_notes || undefined,
        });
        success('Project Updated', `"${updated.project_name}" has been updated.`);
        onSuccess?.(updated);
      } else {
        const created = await createProject({
          project_name: values.project_name,
          client_id: values.client_id,
          category: values.category,
          property_location: values.property_location,
          site_address: values.site_address || undefined,
          description: values.description || undefined,
          total_value: values.total_value,
          estimated_start_date: values.estimated_start_date || undefined,
          expected_completion_date: values.expected_completion_date || undefined,
          actual_completion_date: values.actual_completion_date || undefined,
          status: values.status as ProjectStatus,
          progress_percentage: values.progress_percentage,
          payment_terms: values.payment_terms || undefined,
          internal_notes: values.internal_notes || undefined,
        });
        success(
          'Project Created',
          `"${created.project_name}" (${created.project_code}) initialized.`
        );
        onSuccess?.(created);
      }
      onClose();
    } catch (err: any) {
      showError('Failed to save project', err?.message || 'An error occurred.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editProject ? `Edit Project — ${editProject.project_code}` : 'Create New Project'}
      subtitle="Configure project scope, client assignment, total agreed contract value, and execution timeline."
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="akd-btn-secondary h-9 text-xs"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="project-form"
            disabled={isSubmitting || clients.length === 0}
            className="akd-btn-primary h-9 text-xs"
          >
            {isSubmitting
              ? 'Saving...'
              : editProject
                ? 'Save Project Changes'
                : 'Create Project'}
          </button>
        </>
      }
    >
      {clients.length === 0 ? (
        <div className="py-8 text-center space-y-3">
          <p className="text-sm font-semibold text-slate-900">
            A project must be linked to a client record.
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Your client directory is currently empty. Add your first client to begin creating
            interior projects.
          </p>
          <button
            type="button"
            onClick={() => openQuickModal({ type: 'client' })}
            className="akd-btn-primary h-9 text-xs mt-2"
          >
            <UserPlus className="w-3.5 h-3.5" /> Add First Client
          </button>
        </div>
      ) : (
        <form id="project-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Section 1: Project Identity & Client */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 pb-1.5 border-b border-slate-200">
              1. Project Overview & Client
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="prj-name" className="akd-label">
                  Project Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="prj-name"
                  type="text"
                  placeholder="e.g., Sharma 3BHK Turnkey Interior — Inda"
                  className="akd-input"
                  {...register('project_name')}
                />
                {errors.project_name && (
                  <p className="text-xs text-rose-500 mt-1">{errors.project_name.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="prj-client" className="akd-label">
                  Associated Client <span className="text-rose-500">*</span>
                </label>
                <select id="prj-client" className="akd-select" {...register('client_id')}>
                  <option value="">Select client...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} ({c.client_code})
                    </option>
                  ))}
                </select>
                {errors.client_id && (
                  <p className="text-xs text-rose-500 mt-1">{errors.client_id.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="prj-category" className="akd-label">
                  Project Category <span className="text-rose-500">*</span>
                </label>
                <select id="prj-category" className="akd-select" {...register('category')}>
                  {settings.project_categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="prj-location" className="akd-label">
                  Property Location <span className="text-rose-500">*</span>
                </label>
                <input
                  id="prj-location"
                  type="text"
                  placeholder="e.g., Inda, Kharagpur"
                  className="akd-input"
                  {...register('property_location')}
                />
                {errors.property_location && (
                  <p className="text-xs text-rose-500 mt-1">
                    {errors.property_location.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="prj-address" className="akd-label">
                  Full Site Address
                </label>
                <input
                  id="prj-address"
                  type="text"
                  placeholder="Building, flat, road, pin code"
                  className="akd-input"
                  {...register('site_address')}
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="prj-desc" className="akd-label">
                  Project Scope & Description
                </label>
                <textarea
                  id="prj-desc"
                  rows={2}
                  placeholder="Detailed scope: modular kitchen, false ceiling, wardrobes, lighting..."
                  className="akd-textarea"
                  {...register('description')}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Financials & Timeline */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 pb-1.5 border-b border-slate-200">
              2. Financial Contract & Execution Schedule
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="prj-value" className="akd-label">
                  Total Project Value (INR) <span className="text-rose-500">*</span>
                </label>
                <input
                  id="prj-value"
                  type="number"
                  step="500"
                  min="0"
                  placeholder="1250000"
                  className="akd-input tabular-nums font-semibold"
                  {...register('total_value')}
                />
                {errors.total_value && (
                  <p className="text-xs text-rose-500 mt-1">{errors.total_value.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="prj-status" className="akd-label">
                  Project Status
                </label>
                <select id="prj-status" className="akd-select" {...register('status')}>
                  {PROJECT_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="prj-progress" className="akd-label">
                  Progress ({watchedProgress || 0}%)
                </label>
                <input
                  id="prj-progress"
                  type="number"
                  min="0"
                  max="100"
                  className="akd-input tabular-nums"
                  {...register('progress_percentage')}
                />
              </div>

              <div>
                <label htmlFor="prj-start" className="akd-label">
                  Estimated Start Date
                </label>
                <input
                  id="prj-start"
                  type="date"
                  className="akd-input"
                  {...register('estimated_start_date')}
                />
              </div>

              <div>
                <label htmlFor="prj-expected" className="akd-label">
                  Expected Completion Date
                </label>
                <input
                  id="prj-expected"
                  type="date"
                  className="akd-input"
                  {...register('expected_completion_date')}
                />
              </div>

              <div>
                <label htmlFor="prj-actual" className="akd-label">
                  Actual Completion Date
                </label>
                <input
                  id="prj-actual"
                  type="date"
                  className="akd-input"
                  {...register('actual_completion_date')}
                />
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="prj-terms" className="akd-label">
                  Payment Terms
                </label>
                <input
                  id="prj-terms"
                  type="text"
                  placeholder="e.g., 30% Advance, 40% Carpentry Milestone, 20% Finishing, 10% Handover"
                  className="akd-input"
                  {...register('payment_terms')}
                />
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="prj-notes" className="akd-label">
                  Internal Notes
                </label>
                <textarea
                  id="prj-notes"
                  rows={2}
                  placeholder="Site constraints, vendor milestones, private studio remarks..."
                  className="akd-textarea"
                  {...register('internal_notes')}
                />
              </div>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
};
