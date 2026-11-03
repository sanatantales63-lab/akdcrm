import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, CheckCircle2, UserCheck, FolderPlus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import {
  Enquiry,
  ENQUIRY_STATUSES,
  EnquiryStatus,
  PROJECT_STATUSES,
  ProjectStatus,
} from '@/types/crm';
import { useCRM } from '@/context/CRMContext';
import { useToast } from '@/context/ToastContext';
import { formatINR, todayISO } from '@/lib/formatters';

const enquirySchema = z.object({
  name: z.string().trim().min(2, 'Prospect name is required'),
  phone: z.string().trim().min(8, 'Valid phone number is required'),
  email: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: 'Enter a valid email address',
    }),
  project_type: z.string().trim().min(1, 'Project type is required'),
  property_location: z.string().trim().optional(),
  estimated_budget: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : Number(val)),
    z.number().min(0, 'Budget cannot be negative').nullable().optional()
  ),
  lead_source: z.string().trim().optional(),
  enquiry_date: z.string().min(1, 'Enquiry date is required'),
  follow_up_date: z.string().optional(),
  status: z.enum([
    'New',
    'Contacted',
    'Follow-up Required',
    'Site Visit',
    'Quotation Sent',
    'Converted',
    'Lost',
  ]),
  notes: z.string().trim().optional(),
});

type EnquiryFormValues = z.infer<typeof enquirySchema>;

interface EnquiryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editEnquiry?: Enquiry;
}

export const EnquiryFormModal: React.FC<EnquiryFormModalProps> = ({
  isOpen,
  onClose,
  editEnquiry,
}) => {
  const { settings, createEnquiry, updateEnquiry, findDuplicateClients } = useCRM();
  const { success, error: showError } = useToast();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EnquiryFormValues>({
    resolver: zodResolver(enquirySchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      project_type: settings.project_categories[0] || 'Residential Interior',
      property_location: 'Kharagpur',
      estimated_budget: null,
      lead_source: settings.lead_sources[0] || 'Website (akdinterior.in)',
      enquiry_date: todayISO(),
      follow_up_date: '',
      status: 'New',
      notes: '',
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    if (editEnquiry) {
      reset({
        name: editEnquiry.name,
        phone: editEnquiry.phone,
        email: editEnquiry.email || '',
        project_type: editEnquiry.project_type,
        property_location: editEnquiry.property_location || '',
        estimated_budget: editEnquiry.estimated_budget ?? null,
        lead_source: editEnquiry.lead_source || '',
        enquiry_date: editEnquiry.enquiry_date || todayISO(),
        follow_up_date: editEnquiry.follow_up_date || '',
        status: editEnquiry.status,
        notes: editEnquiry.notes || '',
      });
    } else {
      reset({
        name: '',
        phone: '',
        email: '',
        project_type: settings.project_categories[0] || 'Residential Interior',
        property_location: 'Kharagpur',
        estimated_budget: null,
        lead_source: settings.lead_sources[0] || 'Website (akdinterior.in)',
        enquiry_date: todayISO(),
        follow_up_date: '',
        status: 'New',
        notes: '',
      });
    }
  }, [isOpen, editEnquiry, reset, settings.project_categories, settings.lead_sources]);

  const watchedPhone = watch('phone');
  const watchedEmail = watch('email');
  const matchingClients = useMemo(
    () => findDuplicateClients(watchedPhone, watchedEmail),
    [findDuplicateClients, watchedPhone, watchedEmail]
  );

  const onSubmit = async (values: EnquiryFormValues) => {
    try {
      if (editEnquiry) {
        await updateEnquiry(editEnquiry.id, {
          name: values.name,
          phone: values.phone,
          email: values.email || undefined,
          project_type: values.project_type,
          property_location: values.property_location || undefined,
          estimated_budget: values.estimated_budget ?? null,
          lead_source: values.lead_source || undefined,
          enquiry_date: values.enquiry_date,
          follow_up_date: values.follow_up_date || undefined,
          status: values.status as EnquiryStatus,
          notes: values.notes || undefined,
        });
        success('Enquiry Updated', `Updated enquiry for ${values.name}.`);
      } else {
        const created = await createEnquiry({
          name: values.name,
          phone: values.phone,
          email: values.email || undefined,
          project_type: values.project_type,
          property_location: values.property_location || undefined,
          estimated_budget: values.estimated_budget ?? null,
          lead_source: values.lead_source || undefined,
          enquiry_date: values.enquiry_date,
          follow_up_date: values.follow_up_date || undefined,
          status: values.status as EnquiryStatus,
          notes: values.notes || undefined,
        });
        success('Enquiry Logged', `Created ${created.enquiry_code} for ${created.name}.`);
      }
      onClose();
    } catch (err: any) {
      showError('Failed to save enquiry', err?.message || 'An error occurred.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editEnquiry ? `Edit Enquiry — ${editEnquiry.enquiry_code}` : 'Log New Enquiry'}
      subtitle="Track prospective leads, site visits, quotations, and scheduled follow-ups."
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
            form="enquiry-form"
            disabled={isSubmitting}
            className="akd-btn-primary h-9 text-xs"
          >
            {isSubmitting ? 'Saving...' : editEnquiry ? 'Save Changes' : 'Save Enquiry'}
          </button>
        </>
      }
    >
      <form id="enquiry-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {matchingClients.length > 0 && (
          <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/80 flex items-start gap-2.5 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800">Existing Client Match Found</p>
              <p className="text-amber-700 mt-0.5">
                {matchingClients[0].full_name} ({matchingClients[0].client_code}) already shares
                this phone or email. When converting this enquiry later, you can link directly to
                their existing client profile.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="enq-name" className="akd-label">
              Prospect Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="enq-name"
              type="text"
              placeholder="Full name"
              className="akd-input"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-xs text-rose-500 mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="enq-phone" className="akd-label">
              Phone Number <span className="text-rose-500">*</span>
            </label>
            <input
              id="enq-phone"
              type="tel"
              placeholder="+91 98300 00000"
              className="akd-input"
              {...register('phone')}
            />
            {errors.phone && (
              <p className="text-xs text-rose-500 mt-1">{errors.phone.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="enq-email" className="akd-label">
              Email Address <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              id="enq-email"
              type="email"
              placeholder="prospect@example.com"
              className="akd-input"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-rose-500 mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="enq-project-type" className="akd-label">
              Project Type <span className="text-rose-500">*</span>
            </label>
            <select id="enq-project-type" className="akd-select" {...register('project_type')}>
              {settings.project_categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="enq-location" className="akd-label">
              Property Location
            </label>
            <input
              id="enq-location"
              type="text"
              placeholder="e.g., Malancha, Kharagpur"
              className="akd-input"
              {...register('property_location')}
            />
          </div>

          <div>
            <label htmlFor="enq-budget" className="akd-label">
              Estimated Budget (INR)
            </label>
            <input
              id="enq-budget"
              type="number"
              step="1000"
              min="0"
              placeholder="e.g., 850000"
              className="akd-input tabular-nums"
              {...register('estimated_budget')}
            />
          </div>

          <div>
            <label htmlFor="enq-source" className="akd-label">
              Lead Source
            </label>
            <select id="enq-source" className="akd-select" {...register('lead_source')}>
              <option value="">Select source...</option>
              {settings.lead_sources.map((src) => (
                <option key={src} value={src}>
                  {src}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="enq-status" className="akd-label">
              Enquiry Status
            </label>
            <select id="enq-status" className="akd-select" {...register('status')}>
              {ENQUIRY_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="enq-date" className="akd-label">
              Enquiry Date <span className="text-rose-500">*</span>
            </label>
            <input
              id="enq-date"
              type="date"
              className="akd-input"
              {...register('enquiry_date')}
            />
          </div>

          <div>
            <label htmlFor="enq-followup" className="akd-label">
              Next Follow-up Date
            </label>
            <input
              id="enq-followup"
              type="date"
              className="akd-input"
              {...register('follow_up_date')}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="enq-notes" className="akd-label">
              Enquiry Notes & Requirements
            </label>
            <textarea
              id="enq-notes"
              rows={3}
              placeholder="Scope of work discussed, room count, site visit notes..."
              className="akd-textarea"
              {...register('notes')}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
};

// ============================================================================
// CONVERT ENQUIRY TO CLIENT (AND OPTIONAL PROJECT) MODAL
// ============================================================================

interface ConvertEnquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  enquiry: Enquiry | null;
  onConverted?: (clientId: string, projectId?: string) => void;
}

export const ConvertEnquiryModal: React.FC<ConvertEnquiryModalProps> = ({
  isOpen,
  onClose,
  enquiry,
  onConverted,
}) => {
  const { settings, findDuplicateClients, convertEnquiry } = useCRM();
  const { success, error: showError } = useToast();

  const matchingClients = useMemo(
    () => (enquiry ? findDuplicateClients(enquiry.phone, enquiry.email) : []),
    [enquiry, findDuplicateClients]
  );

  const [useExistingClient, setUseExistingClient] = useState(false);
  const [selectedExistingClientId, setSelectedExistingClientId] = useState<string>('');
  const [clientType, setClientType] = useState<'Residential' | 'Commercial'>('Residential');
  const [propertyType, setPropertyType] = useState('');
  const [fullAddress, setFullAddress] = useState('');
  const [createProject, setCreateProject] = useState(true);
  const [projectName, setProjectName] = useState('');
  const [projectCategory, setProjectCategory] = useState('');
  const [projectValue, setProjectValue] = useState<string>('');
  const [projectStatus, setProjectStatus] = useState<ProjectStatus>('Planning');
  const [startDate, setStartDate] = useState(todayISO());
  const [completionDate, setCompletionDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState(
    '30% Advance, 40% Execution Milestone, 20% Finishing, 10% Handover'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!enquiry || !isOpen) return;
    if (matchingClients.length > 0) {
      setUseExistingClient(true);
      setSelectedExistingClientId(matchingClients[0].id);
    } else {
      setUseExistingClient(false);
      setSelectedExistingClientId('');
    }
    const isCommercial =
      enquiry.project_type.toLowerCase().includes('commercial') ||
      enquiry.project_type.toLowerCase().includes('office');
    setClientType(isCommercial ? 'Commercial' : 'Residential');
    setPropertyType(enquiry.project_type);
    setFullAddress(enquiry.property_location || '');
    setCreateProject(true);
    setProjectName(`${enquiry.name} — ${enquiry.project_type}`);
    setProjectCategory(
      settings.project_categories.includes(enquiry.project_type)
        ? enquiry.project_type
        : settings.project_categories[0] || 'Residential Interior'
    );
    setProjectValue(enquiry.estimated_budget ? String(enquiry.estimated_budget) : '');
    setProjectStatus('Planning');
    setStartDate(todayISO());
    setCompletionDate('');
  }, [enquiry, isOpen, matchingClients, settings.project_categories]);

  if (!enquiry) return null;

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createProject && !projectName.trim()) {
      showError('Validation Error', 'Please provide a project name.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await convertEnquiry({
        enquiryId: enquiry.id,
        existingClientId: useExistingClient ? selectedExistingClientId : null,
        clientData: {
          full_name: enquiry.name,
          phone: enquiry.phone,
          whatsapp: enquiry.phone,
          email: enquiry.email,
          client_type: clientType,
          property_type: propertyType,
          property_location: enquiry.property_location,
          full_address: fullAddress || enquiry.property_location,
          project_budget: enquiry.estimated_budget,
          lead_source: enquiry.lead_source,
          notes: enquiry.notes,
        },
        createProject,
        projectData: createProject
          ? {
              project_name: projectName.trim(),
              category: projectCategory || enquiry.project_type,
              property_location: enquiry.property_location || 'Kharagpur',
              site_address: fullAddress || enquiry.property_location,
              description: enquiry.notes,
              total_value: Number(projectValue) || 0,
              estimated_start_date: startDate || undefined,
              expected_completion_date: completionDate || undefined,
              status: projectStatus,
              payment_terms: paymentTerms,
            }
          : undefined,
      });

      success(
        'Enquiry Converted Successfully',
        `${enquiry.name} is now linked to Client ${result.client.client_code}${
          result.project ? ` and Project ${result.project.project_code}` : ''
        }.`
      );
      onClose();
      onConverted?.(result.client.id, result.project?.id);
    } catch (err: any) {
      showError('Conversion Failed', err?.message || 'Could not convert enquiry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Convert Enquiry — ${enquiry.enquiry_code}`}
      subtitle="Promote this prospective lead into a permanent Client record and optionally initialize their Project."
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
            form="convert-enquiry-form"
            disabled={isSubmitting}
            className="akd-btn-primary h-9 text-xs"
          >
            {isSubmitting
              ? 'Converting...'
              : createProject
                ? 'Convert to Client & Create Project'
                : 'Convert to Client Only'}
          </button>
        </>
      }
    >
      <form id="convert-enquiry-form" onSubmit={handleConvert} className="space-y-5">
        {/* Prospect Summary Banner */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">{enquiry.name}</p>
            <p className="text-xs text-slate-500">
              {enquiry.phone} {enquiry.email ? `• ${enquiry.email}` : ''} •{' '}
              {enquiry.property_location || 'Kharagpur'}
            </p>
          </div>
          <div className="text-right">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 block font-medium">
              Est. Budget
            </span>
            <span className="text-sm font-semibold text-slate-900 tabular-nums">
              {enquiry.estimated_budget ? formatINR(enquiry.estimated_budget) : '—'}
            </span>
          </div>
        </div>

        {/* Duplicate Prevention Section */}
        {matchingClients.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200/80 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
              <UserCheck className="w-4 h-4 text-amber-600" />
              Existing Client Profile Found (Duplicate Prevention)
            </div>
            <p className="text-xs text-amber-700">
              We found an existing client matching this phone or email. Would you like to link this
              enquiry to the existing client record instead of creating a duplicate?
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer bg-white px-3 py-2 rounded-lg border border-amber-200 shadow-xs">
                <input
                  type="radio"
                  checked={useExistingClient}
                  onChange={() => setUseExistingClient(true)}
                  className="accent-brand-primary"
                />
                Link to Existing: {matchingClients[0].full_name} ({matchingClients[0].client_code})
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer bg-white px-3 py-2 rounded-lg border border-amber-200 shadow-xs">
                <input
                  type="radio"
                  checked={!useExistingClient}
                  onChange={() => setUseExistingClient(false)}
                  className="accent-brand-primary"
                />
                Create Separate Client Profile
              </label>
            </div>
          </div>
        )}

        {/* New Client Specifications (if creating new client) */}
        {!useExistingClient && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 pb-1 border-b border-slate-200">
              1. Client Record Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="akd-label">Client Type</label>
                <select
                  value={clientType}
                  onChange={(e) =>
                    setClientType(e.target.value as 'Residential' | 'Commercial')
                  }
                  className="akd-select"
                >
                  <option value="Residential">Residential</option>
                  <option value="Commercial">Commercial</option>
                </select>
              </div>
              <div>
                <label className="akd-label">Property Type</label>
                <input
                  type="text"
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                  placeholder="e.g., 3BHK Apartment, Office"
                  className="akd-input"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="akd-label">Full Property / Site Address</label>
                <input
                  type="text"
                  value={fullAddress}
                  onChange={(e) => setFullAddress(e.target.value)}
                  placeholder="Complete address"
                  className="akd-input"
                />
              </div>
            </div>
          </div>
        )}

        {/* Optional Project Initialization */}
        <div className="pt-2">
          <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-slate-50 cursor-pointer transition-colors">
            <div className="flex items-center gap-2.5">
              <FolderPlus className="w-4 h-4 text-brand-primary" />
              <div>
                <span className="text-xs font-semibold text-slate-900 block">
                  Also Initialize an Associated Project Now
                </span>
                <span className="text-[11px] text-slate-500">
                  Automatically links Enquiry → Client → Project
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={createProject}
              onChange={(e) => setCreateProject(e.target.checked)}
              className="w-4 h-4 accent-brand-primary rounded"
            />
          </label>
        </div>

        {createProject && (
          <div className="space-y-4 pt-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 pb-1 border-b border-slate-200">
              2. New Project Configuration
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="akd-label">
                  Project Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="akd-input"
                  required
                />
              </div>

              <div>
                <label className="akd-label">Project Category</label>
                <select
                  value={projectCategory}
                  onChange={(e) => setProjectCategory(e.target.value)}
                  className="akd-select"
                >
                  {settings.project_categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="akd-label">Total Project Value (INR)</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={projectValue}
                  onChange={(e) => setProjectValue(e.target.value)}
                  placeholder="e.g., 1250000"
                  className="akd-input tabular-nums"
                />
              </div>

              <div>
                <label className="akd-label">Initial Project Status</label>
                <select
                  value={projectStatus}
                  onChange={(e) => setProjectStatus(e.target.value as ProjectStatus)}
                  className="akd-select"
                >
                  {PROJECT_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="akd-label">Estimated Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="akd-input"
                />
              </div>

              <div>
                <label className="akd-label">Expected Completion Date</label>
                <input
                  type="date"
                  value={completionDate}
                  onChange={(e) => setCompletionDate(e.target.value)}
                  className="akd-input"
                />
              </div>

              <div>
                <label className="akd-label">Payment Terms</label>
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="akd-input"
                />
              </div>
            </div>
          </div>
        )}

        <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>
            Enquiry <strong>{enquiry.enquiry_code}</strong> will be marked as{' '}
            <strong>Converted</strong> and permanently linked to the resulting records.
          </span>
        </div>
      </form>
    </Modal>
  );
};
