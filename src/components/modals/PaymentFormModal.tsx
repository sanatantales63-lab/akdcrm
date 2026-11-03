import React, { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { FolderPlus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import {
  Payment,
  PAYMENT_METHODS,
  PAYMENT_TYPES,
  PaymentMethod,
  PaymentType,
} from '@/types/crm';
import { useCRM } from '@/context/CRMContext';
import { useToast } from '@/context/ToastContext';
import { formatINR, safeSubtract, todayISO } from '@/lib/formatters';

const paymentSchema = z.object({
  project_id: z.string().trim().min(1, 'Please select the associated project'),
  amount: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? 0 : Number(val)),
    z.number().positive('Payment amount must be greater than ₹0')
  ),
  payment_date: z.string().min(1, 'Payment date is required'),
  payment_method: z.enum(['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Other']),
  payment_type: z.enum([
    'Advance',
    'Instalment',
    'Milestone Payment',
    'Final Payment',
    'Other',
  ]),
  transaction_reference: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

type PaymentFormValues = z.infer<typeof paymentSchema>;

interface PaymentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editPayment?: Payment;
  preselectedProjectId?: string;
  preselectedClientId?: string;
}

export const PaymentFormModal: React.FC<PaymentFormModalProps> = ({
  isOpen,
  onClose,
  editPayment,
  preselectedProjectId,
  preselectedClientId,
}) => {
  const {
    projects,
    projectFinancialMap,
    createPayment,
    updatePayment,
    openQuickModal,
  } = useCRM();
  const { success, error: showError } = useToast();

  const eligibleProjects = useMemo(() => {
    if (preselectedClientId) {
      return projects.filter((p) => p.client_id === preselectedClientId);
    }
    return projects;
  }, [projects, preselectedClientId]);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      project_id: preselectedProjectId || '',
      amount: 0,
      payment_date: todayISO(),
      payment_method: 'Bank Transfer',
      payment_type: 'Advance',
      transaction_reference: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    if (editPayment) {
      reset({
        project_id: editPayment.project_id,
        amount: editPayment.amount,
        payment_date: editPayment.payment_date,
        payment_method: editPayment.payment_method,
        payment_type: editPayment.payment_type,
        transaction_reference: editPayment.transaction_reference || '',
        notes: editPayment.notes || '',
      });
    } else {
      const defaultProject =
        preselectedProjectId || eligibleProjects[0]?.id || '';
      reset({
        project_id: defaultProject,
        amount: 0,
        payment_date: todayISO(),
        payment_method: 'Bank Transfer',
        payment_type: 'Advance',
        transaction_reference: '',
        notes: '',
      });
    }
  }, [isOpen, editPayment, preselectedProjectId, eligibleProjects, reset]);

  const selectedProjectId = watch('project_id');
  const enteredAmount = Number(watch('amount')) || 0;
  const selectedSummary = projectFinancialMap.get(selectedProjectId);

  const previewCalculations = useMemo(() => {
    if (!selectedSummary) return null;
    const baseReceived = editPayment
      ? safeSubtract(selectedSummary.paymentsReceived, editPayment.amount)
      : selectedSummary.paymentsReceived;
    const newTotalReceived = baseReceived + enteredAmount;
    const newRemainingBalance = Math.max(
      0,
      safeSubtract(selectedSummary.totalValue, newTotalReceived)
    );
    return {
      totalValue: selectedSummary.totalValue,
      baseReceived,
      newTotalReceived,
      newRemainingBalance,
      clientName: selectedSummary.client?.full_name || '—',
    };
  }, [selectedSummary, enteredAmount, editPayment]);

  const onSubmit = async (values: PaymentFormValues) => {
    try {
      const summary = projectFinancialMap.get(values.project_id);
      if (!summary) {
        showError('Invalid Project', 'Please select a valid project.');
        return;
      }

      if (editPayment) {
        const updated = await updatePayment(editPayment.id, {
          project_id: values.project_id,
          client_id: summary.project.client_id,
          amount: values.amount,
          payment_date: values.payment_date,
          payment_method: values.payment_method as PaymentMethod,
          payment_type: values.payment_type as PaymentType,
          transaction_reference: values.transaction_reference || undefined,
          notes: values.notes || undefined,
        });
        success(
          'Payment Updated',
          `Receipt ${updated.receipt_number} updated (${formatINR(updated.amount)}).`
        );
      } else {
        const created = await createPayment({
          project_id: values.project_id,
          client_id: summary.project.client_id,
          amount: values.amount,
          payment_date: values.payment_date,
          payment_method: values.payment_method as PaymentMethod,
          payment_type: values.payment_type as PaymentType,
          transaction_reference: values.transaction_reference || undefined,
          notes: values.notes || undefined,
        });
        success(
          'Payment Recorded',
          `Receipt ${created.receipt_number} generated for ${formatINR(created.amount)}.`
        );
      }
      onClose();
    } catch (err: any) {
      showError('Failed to record payment', err?.message || 'An error occurred.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        editPayment
          ? `Edit Payment — ${editPayment.receipt_number}`
          : 'Record Confirmed Payment'
      }
      subtitle="Record advances, milestone instalments, and final settlements against an active project."
      size="md"
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
            form="payment-form"
            disabled={isSubmitting || eligibleProjects.length === 0}
            className="akd-btn-primary h-9 text-xs"
          >
            {isSubmitting
              ? 'Recording...'
              : editPayment
                ? 'Update Payment'
                : 'Record Payment'}
          </button>
        </>
      }
    >
      {eligibleProjects.length === 0 ? (
        <div className="py-8 text-center space-y-3">
          <p className="text-sm font-semibold text-slate-900">
            Payments must be recorded against a project.
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Create a project first so payments and outstanding balances can be tracked accurately.
          </p>
          <button
            type="button"
            onClick={() =>
              openQuickModal({ type: 'project', clientId: preselectedClientId })
            }
            className="akd-btn-primary h-9 text-xs mt-2"
          >
            <FolderPlus className="w-3.5 h-3.5" /> Create Project
          </button>
        </div>
      ) : (
        <form id="payment-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="pay-project" className="akd-label">
              Associated Project <span className="text-rose-500">*</span>
            </label>
            <select id="pay-project" className="akd-select" {...register('project_id')}>
              <option value="">Select project...</option>
              {eligibleProjects.map((p) => {
                const pf = projectFinancialMap.get(p.id);
                return (
                  <option key={p.id} value={p.id}>
                    {p.project_name} ({p.project_code}) — {pf?.client?.full_name || ''}
                  </option>
                );
              })}
            </select>
            {errors.project_id && (
              <p className="text-xs text-rose-500 mt-1">{errors.project_id.message}</p>
            )}
          </div>

          {previewCalculations && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-500">
                <span>Associated Client</span>
                <span className="font-semibold text-slate-900">
                  {previewCalculations.clientName}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-500">
                <span>Total Project Value</span>
                <span className="font-medium text-slate-900 tabular-nums">
                  {formatINR(previewCalculations.totalValue)}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-500">
                <span>Previously Received</span>
                <span className="font-semibold text-emerald-600 tabular-nums">
                  {formatINR(previewCalculations.baseReceived)}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <span className="font-semibold text-slate-900">
                  Remaining Balance After This Payment
                </span>
                <span className="font-bold text-brand-primary tabular-nums text-sm">
                  {formatINR(previewCalculations.newRemainingBalance)}
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="pay-amount" className="akd-label">
                Amount Received (INR) <span className="text-rose-500">*</span>
              </label>
              <input
                id="pay-amount"
                type="number"
                step="1"
                min="1"
                placeholder="e.g., 250000"
                className="akd-input tabular-nums font-semibold"
                {...register('amount')}
              />
              {errors.amount && (
                <p className="text-xs text-rose-500 mt-1">{errors.amount.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="pay-date" className="akd-label">
                Payment Date <span className="text-rose-500">*</span>
              </label>
              <input
                id="pay-date"
                type="date"
                className="akd-input"
                {...register('payment_date')}
              />
            </div>

            <div>
              <label htmlFor="pay-type" className="akd-label">
                Payment Type <span className="text-rose-500">*</span>
              </label>
              <select id="pay-type" className="akd-select" {...register('payment_type')}>
                {PAYMENT_TYPES.map((pt) => (
                  <option key={pt} value={pt}>
                    {pt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="pay-method" className="akd-label">
                Payment Method <span className="text-rose-500">*</span>
              </label>
              <select id="pay-method" className="akd-select" {...register('payment_method')}>
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm} value={pm}>
                    {pm}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="pay-ref" className="akd-label">
                Transaction Reference / UTR / Cheque No.
              </label>
              <input
                id="pay-ref"
                type="text"
                placeholder="e.g., NEFT/UTR/UPI Reference or Cheque Number"
                className="akd-input"
                {...register('transaction_reference')}
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="pay-notes" className="akd-label">
                Payment Notes
              </label>
              <textarea
                id="pay-notes"
                rows={2}
                placeholder="Milestone details or receipt remarks..."
                className="akd-textarea"
                {...register('notes')}
              />
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
};
