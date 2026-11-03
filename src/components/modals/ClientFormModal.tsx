import React, { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { Client, CLIENT_STATUSES, ClientStatus, ClientType } from '@/types/crm';
import { useCRM } from '@/context/CRMContext';
import { useToast } from '@/context/ToastContext';
import { todayISO } from '@/lib/formatters';

const clientSchema = z.object({
  full_name: z.string().trim().min(2, 'Client full name is required'),
  phone: z
    .string()
    .trim()
    .min(8, 'Enter a valid phone number')
    .max(20, 'Phone number is too long'),
  whatsapp: z.string().trim().optional(),
  email: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: 'Enter a valid email address',
    }),
  client_type: z.enum(['Residential', 'Commercial']),
  property_type: z.string().trim().optional(),
  property_location: z.string().trim().optional(),
  full_address: z.string().trim().optional(),
  project_budget: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : Number(val)),
    z.number().min(0, 'Budget cannot be negative').nullable().optional()
  ),
  lead_source: z.string().trim().optional(),
  status: z.enum([
    'New',
    'Contacted',
    'Qualified',
    'Active Client',
    'Completed',
    'Lost',
  ]),
  date_added: z.string().min(1, 'Date added is required'),
  notes: z.string().trim().optional(),
});

type ClientFormValues = z.infer<typeof clientSchema>;

interface ClientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editClient?: Client;
  onSuccess?: (client: Client) => void;
}

export const ClientFormModal: React.FC<ClientFormModalProps> = ({
  isOpen,
  onClose,
  editClient,
  onSuccess,
}) => {
  const { settings, createClient, updateClient, findDuplicateClients } = useCRM();
  const { success, error: showError } = useToast();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      full_name: '',
      phone: '',
      whatsapp: '',
      email: '',
      client_type: 'Residential',
      property_type: '',
      property_location: 'Kharagpur',
      full_address: '',
      project_budget: null,
      lead_source: settings.lead_sources[0] || 'Website (akdinterior.in)',
      status: 'New',
      date_added: todayISO(),
      notes: '',
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    if (editClient) {
      reset({
        full_name: editClient.full_name,
        phone: editClient.phone,
        whatsapp: editClient.whatsapp || '',
        email: editClient.email || '',
        client_type: editClient.client_type,
        property_type: editClient.property_type || '',
        property_location: editClient.property_location || '',
        full_address: editClient.full_address || '',
        project_budget: editClient.project_budget ?? null,
        lead_source: editClient.lead_source || '',
        status: editClient.status,
        date_added: editClient.date_added || todayISO(),
        notes: editClient.notes || '',
      });
    } else {
      reset({
        full_name: '',
        phone: '',
        whatsapp: '',
        email: '',
        client_type: 'Residential',
        property_type: '',
        property_location: 'Kharagpur',
        full_address: '',
        project_budget: null,
        lead_source: settings.lead_sources[0] || 'Website (akdinterior.in)',
        status: 'New',
        date_added: todayISO(),
        notes: '',
      });
    }
  }, [isOpen, editClient, reset, settings.lead_sources]);

  const watchedPhone = watch('phone');
  const watchedEmail = watch('email');

  const duplicateClients = useMemo(
    () => findDuplicateClients(watchedPhone, watchedEmail, editClient?.id),
    [findDuplicateClients, watchedPhone, watchedEmail, editClient?.id]
  );

  const onSubmit = async (values: ClientFormValues) => {
    try {
      if (editClient) {
        const updated = await updateClient(editClient.id, {
          full_name: values.full_name,
          phone: values.phone,
          whatsapp: values.whatsapp || values.phone,
          email: values.email || undefined,
          client_type: values.client_type as ClientType,
          property_type: values.property_type || undefined,
          property_location: values.property_location || undefined,
          full_address: values.full_address || undefined,
          project_budget: values.project_budget ?? null,
          lead_source: values.lead_source || undefined,
          status: values.status as ClientStatus,
          date_added: values.date_added,
          notes: values.notes || undefined,
        });
        success('Client Updated', `${updated.full_name} has been updated.`);
        onSuccess?.(updated);
      } else {
        const created = await createClient({
          full_name: values.full_name,
          phone: values.phone,
          whatsapp: values.whatsapp || values.phone,
          email: values.email || undefined,
          client_type: values.client_type as ClientType,
          property_type: values.property_type || undefined,
          property_location: values.property_location || undefined,
          full_address: values.full_address || undefined,
          project_budget: values.project_budget ?? null,
          lead_source: values.lead_source || undefined,
          status: values.status as ClientStatus,
          date_added: values.date_added,
          notes: values.notes || undefined,
        });
        success('Client Added', `${created.full_name} (${created.client_code}) added to directory.`);
        onSuccess?.(created);
      }
      onClose();
    } catch (err: any) {
      showError('Failed to save client', err?.message || 'An unexpected error occurred.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editClient ? `Edit Client — ${editClient.client_code}` : 'Add New Client'}
      subtitle="Maintain accurate contact, property, and budget specifications for studio records."
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
            form="client-form"
            disabled={isSubmitting}
            className="akd-btn-primary h-9 text-xs"
          >
            {isSubmitting
              ? 'Saving...'
              : editClient
                ? 'Save Changes'
                : 'Create Client Profile'}
          </button>
        </>
      }
    >
      <form id="client-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {duplicateClients.length > 0 && (
          <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/80 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-900 flex-1">
              <p className="font-semibold text-amber-800">
                Potential Duplicate Record Detected
              </p>
              <p className="text-amber-700 mt-0.5">
                A client with a matching phone number or email already exists in the directory.
                Records will not be merged automatically:
              </p>
              <div className="mt-2 space-y-1.5">
                {duplicateClients.map((dup) => (
                  <div
                    key={dup.id}
                    className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-amber-200/60 shadow-xs"
                  >
                    <span>
                      <strong className="text-slate-900">{dup.full_name}</strong> ({dup.client_code}) • {dup.phone}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        navigate(`/clients/${dup.id}`);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-primary hover:underline"
                    >
                      View Existing <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Section 1: Identity & Contact */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 pb-1.5 border-b border-slate-200">
            1. Primary Contact Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="client-full-name" className="akd-label">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="client-full-name"
                type="text"
                placeholder="e.g., Rajesh Sharma"
                className="akd-input"
                {...register('full_name')}
              />
              {errors.full_name && (
                <p className="text-xs text-rose-500 mt-1">{errors.full_name.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="client-phone" className="akd-label">
                Phone Number <span className="text-rose-500">*</span>
              </label>
              <input
                id="client-phone"
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
              <label htmlFor="client-whatsapp" className="akd-label">
                WhatsApp Number <span className="text-slate-400 font-normal">(if different)</span>
              </label>
              <input
                id="client-whatsapp"
                type="tel"
                placeholder="Leave blank if same as phone"
                className="akd-input"
                {...register('whatsapp')}
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="client-email" className="akd-label">
                Email Address <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                id="client-email"
                type="email"
                placeholder="client@example.com"
                className="akd-input"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs text-rose-500 mt-1">{errors.email.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Property & Commercial Profile */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 pb-1.5 border-b border-slate-200">
            2. Property & Project Profile
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="client-type" className="akd-label">
                Client Type <span className="text-rose-500">*</span>
              </label>
              <select id="client-type" className="akd-select" {...register('client_type')}>
                <option value="Residential">Residential</option>
                <option value="Commercial">Commercial</option>
              </select>
            </div>

            <div>
              <label htmlFor="client-property-type" className="akd-label">
                Property Type <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                id="client-property-type"
                type="text"
                placeholder="e.g., 3BHK Apartment, Villa, Retail Showroom"
                className="akd-input"
                {...register('property_type')}
              />
            </div>

            <div>
              <label htmlFor="client-location" className="akd-label">
                Property Location / Area
              </label>
              <input
                id="client-location"
                type="text"
                placeholder="e.g., Inda, Kharagpur"
                className="akd-input"
                {...register('property_location')}
              />
            </div>

            <div>
              <label htmlFor="client-budget" className="akd-label">
                Estimated Project Budget (INR)
              </label>
              <input
                id="client-budget"
                type="number"
                step="1000"
                min="0"
                placeholder="e.g., 1250000"
                className="akd-input tabular-nums"
                {...register('project_budget')}
              />
              {errors.project_budget && (
                <p className="text-xs text-rose-500 mt-1">{errors.project_budget.message}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="client-address" className="akd-label">
                Full Address <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                id="client-address"
                type="text"
                placeholder="Complete postal / site address"
                className="akd-input"
                {...register('full_address')}
              />
            </div>
          </div>
        </div>

        {/* Section 3: Status & Acquisition */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 pb-1.5 border-b border-slate-200">
            3. Status, Lead Source & Notes
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="client-status" className="akd-label">
                Client Status
              </label>
              <select id="client-status" className="akd-select" {...register('status')}>
                {CLIENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="client-lead-source" className="akd-label">
                Lead Source
              </label>
              <select id="client-lead-source" className="akd-select" {...register('lead_source')}>
                <option value="">Select source...</option>
                {settings.lead_sources.map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="client-date-added" className="akd-label">
                Date Added
              </label>
              <input
                id="client-date-added"
                type="date"
                className="akd-input"
                {...register('date_added')}
              />
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="client-notes" className="akd-label">
                Client Notes & Design Preferences
              </label>
              <textarea
                id="client-notes"
                rows={3}
                placeholder="Key design requirements, material preferences, family requirements..."
                className="akd-textarea"
                {...register('notes')}
              />
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
};
