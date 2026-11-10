import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Expense, PAYMENT_METHODS, PaymentMethod } from '@/types/crm';
import { useCRM } from '@/context/CRMContext';
import { useToast } from '@/context/ToastContext';
import { formatINR, todayISO } from '@/lib/formatters';

const expenseSchema = z.object({
  title: z.string().trim().min(2, 'Expense title is required'),
  category: z.string().trim().min(1, 'Expense category is required'),
  project_id: z.string().optional(),
  amount: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? 0 : Number(val)),
    z.number().positive('Expense amount must be greater than ₹0')
  ),
  expense_date: z.string().min(1, 'Expense date is required'),
  vendor_name: z.string().trim().optional(),
  payment_method: z.enum(['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Other']),
  reference_number: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

interface ExpenseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editExpense?: Expense;
  preselectedProjectId?: string;
}

export const ExpenseFormModal: React.FC<ExpenseFormModalProps> = ({
  isOpen,
  onClose,
  editExpense,
  preselectedProjectId,
}) => {
  const { settings, projects, createExpense, updateExpense } = useCRM();
  const { success, error: showError } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      title: '',
      category: settings.expense_categories[0] || 'Materials',
      project_id: preselectedProjectId || '',
      amount: 0,
      expense_date: todayISO(),
      vendor_name: '',
      payment_method: 'Bank Transfer',
      reference_number: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    if (editExpense) {
      reset({
        title: editExpense.title,
        category: editExpense.category,
        project_id: editExpense.project_id || '',
        amount: editExpense.amount,
        expense_date: editExpense.expense_date,
        vendor_name: editExpense.vendor_name || '',
        payment_method: editExpense.payment_method,
        reference_number: editExpense.reference_number || '',
        notes: editExpense.notes || '',
      });
    } else {
      reset({
        title: '',
        category: settings.expense_categories[0] || 'Materials',
        project_id: preselectedProjectId || '',
        amount: 0,
        expense_date: todayISO(),
        vendor_name: '',
        payment_method: 'Bank Transfer',
        reference_number: '',
        notes: '',
      });
    }
  }, [isOpen, editExpense, preselectedProjectId, reset, settings.expense_categories]);

  const onSubmit = async (values: ExpenseFormValues) => {
    try {
      if (editExpense) {
        const updated = await updateExpense(editExpense.id, {
          title: values.title,
          category: values.category,
          project_id: values.project_id || null,
          amount: values.amount,
          expense_date: values.expense_date,
          vendor_name: values.vendor_name || undefined,
          payment_method: values.payment_method as PaymentMethod,
          reference_number: values.reference_number || undefined,
          notes: values.notes || undefined,
        });
        success(
          'Expense Updated',
          `"${updated.title}" updated (${formatINR(updated.amount)}).`
        );
      } else {
        const created = await createExpense({
          title: values.title,
          category: values.category,
          project_id: values.project_id || null,
          amount: values.amount,
          expense_date: values.expense_date,
          vendor_name: values.vendor_name || undefined,
          payment_method: values.payment_method as PaymentMethod,
          reference_number: values.reference_number || undefined,
          notes: values.notes || undefined,
        });
        success(
          'Expense Recorded',
          `"${created.title}" (${created.expense_code}) recorded for ${formatINR(created.amount)}.`
        );
      }
      onClose();
    } catch (err: any) {
      showError('Failed to save expense', err?.message || 'An error occurred.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editExpense ? `Edit Expense — ${editExpense.expense_code}` : 'Record Business Expense'}
      subtitle="Track material purchases, contractor payouts, labour, and studio expenditure."
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
            form="expense-form"
            disabled={isSubmitting}
            className="akd-btn-primary h-9 text-xs"
          >
            {isSubmitting
              ? 'Saving...'
              : editExpense
                ? 'Save Changes'
                : 'Record Expense'}
          </button>
        </>
      }
    >
      <form id="expense-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="exp-title" className="akd-label">
            Expense Title / Description <span className="text-rose-500">*</span>
          </label>
          <input
            id="exp-title"
            type="text"
            placeholder="e.g., CenturyPly Marine Plywood & Veneer Lot"
            className="akd-input"
            {...register('title')}
          />
          {errors.title && (
            <p className="text-xs text-rose-500 mt-1">{errors.title.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="exp-category" className="akd-label">
              Expense Category <span className="text-rose-500">*</span>
            </label>
            <select id="exp-category" className="akd-select" {...register('category')}>
              {settings.expense_categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="exp-project" className="akd-label">
              Associated Project <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <select id="exp-project" className="akd-select" {...register('project_id')}>
              <option value="">General Studio Overhead (Non-Project)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_name} ({p.project_code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="exp-amount" className="akd-label">
              Amount (INR) <span className="text-rose-500">*</span>
            </label>
            <input
              id="exp-amount"
              type="number"
              step="1"
              min="1"
              placeholder="e.g., 45000"
              className="akd-input tabular-nums font-semibold"
              {...register('amount')}
            />
            {errors.amount && (
              <p className="text-xs text-rose-500 mt-1">{errors.amount.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="exp-date" className="akd-label">
              Expense Date <span className="text-rose-500">*</span>
            </label>
            <input
              id="exp-date"
              type="date"
              className="akd-input"
              {...register('expense_date')}
            />
          </div>

          <div>
            <label htmlFor="exp-vendor" className="akd-label">
              Vendor or Payee
            </label>
            <input
              id="exp-vendor"
              type="text"
              placeholder="Supplier or contractor name"
              className="akd-input"
              {...register('vendor_name')}
            />
          </div>

          <div>
            <label htmlFor="exp-method" className="akd-label">
              Payment Method
            </label>
            <select id="exp-method" className="akd-select" {...register('payment_method')}>
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm} value={pm}>
                  {pm}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="exp-ref" className="akd-label">
              Bill / Invoice / Reference Number
            </label>
            <input
              id="exp-ref"
              type="text"
              placeholder="Vendor bill number or bank reference"
              className="akd-input"
              {...register('reference_number')}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="exp-notes" className="akd-label">
              Notes
            </label>
            <textarea
              id="exp-notes"
              rows={2}
              placeholder="Material specifications, site delivery remarks..."
              className="akd-textarea"
              {...register('notes')}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
};
