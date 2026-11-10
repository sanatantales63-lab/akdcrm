import React, { useState, useEffect, useMemo } from 'react';
import { useCRM } from '@/context/CRMContext';
import { useToast } from '@/context/ToastContext';
import {
  COMMON_MATERIAL_UNITS,
  MATERIAL_CATEGORIES,
  PAYMENT_METHODS,
  PURCHASE_BILL_PAYMENT_STATUSES,
  PaymentMethod,
  PurchaseBillPaymentStatus,
} from '@/types/crm';
import { formatINR, todayISO } from '@/lib/formatters';
import {
  X,
  Plus,
  Trash2,
  FileSpreadsheet,
  PackageCheck,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultProjectId?: string;
}

interface BillDraftRow {
  key: string;
  mode: 'catalogue' | 'custom';
  material_id: string;
  item_name: string;
  description: string;
  category: string;
  unit: string;
  quantity: number;
  rate: number;
  update_stock: boolean;
  save_to_catalogue: boolean;
}

export const PurchaseBillModal: React.FC<Props> = ({
  isOpen,
  onClose,
  defaultProjectId,
}) => {
  const {
    materials,
    projects,
    expenses,
    purchaseBills,
    createPurchaseBill,
  } = useCRM();
  const { success, error: showError } = useToast();

  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [invoiceReference, setInvoiceReference] = useState('');
  const [projectId, setProjectId] = useState(defaultProjectId || '');
  const [billDate, setBillDate] = useState(todayISO());
  const [paymentStatus, setPaymentStatus] =
    useState<PurchaseBillPaymentStatus>('Paid');
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>('Bank Transfer');
  const [taxAmount, setTaxAmount] = useState('0');
  const [notes, setNotes] = useState('');
  const [recordAsExpense, setRecordAsExpense] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [rows, setRows] = useState<BillDraftRow[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setSupplierName('');
    setSupplierPhone('');
    setInvoiceReference('');
    setProjectId(defaultProjectId || '');
    setBillDate(todayISO());
    setPaymentStatus('Paid');
    setPaymentMethod('Bank Transfer');
    setTaxAmount('0');
    setNotes('');
    setRecordAsExpense(true);

    const firstMat = materials[0];
    setRows([
      {
        key: `row-${Date.now()}`,
        mode: firstMat ? 'catalogue' : 'custom',
        material_id: firstMat ? firstMat.id : '',
        item_name: firstMat ? firstMat.item_name : '',
        description: '',
        category: firstMat ? firstMat.category : MATERIAL_CATEGORIES[0],
        unit: firstMat ? firstMat.unit : 'Piece',
        quantity: 1,
        rate: firstMat ? firstMat.purchase_rate : 0,
        update_stock: true,
        save_to_catalogue: false,
      },
    ]);
  }, [isOpen, defaultProjectId, materials]);

  // Known supplier suggestions from catalogue, bills, and expenses
  const supplierSuggestions = useMemo(() => {
    const names = new Set<string>();
    materials.forEach((m) => {
      if (m.supplier?.trim()) names.add(m.supplier.trim());
    });
    purchaseBills.forEach((b) => {
      if (b.supplier_name?.trim()) names.add(b.supplier_name.trim());
    });
    expenses.forEach((e) => {
      if (e.vendor_name?.trim()) names.add(e.vendor_name.trim());
    });
    return Array.from(names).sort();
  }, [materials, purchaseBills, expenses]);

  const subtotal = useMemo(() => {
    return rows.reduce((sum, r) => {
      const q = Math.max(0, Number(r.quantity) || 0);
      const rate = Math.max(0, Number(r.rate) || 0);
      return sum + q * rate;
    }, 0);
  }, [rows]);

  const cleanTax = Math.max(0, Number(taxAmount) || 0);
  const grandTotal = subtotal + cleanTax;

  if (!isOpen) return null;

  const updateRow = (index: number, patch: Partial<BillDraftRow>) => {
    setRows((prev) =>
      prev.map((r, idx) => (idx === index ? { ...r, ...patch } : r))
    );
  };

  const handleSelectCatalogueMaterial = (index: number, matId: string) => {
    const mat = materials.find((m) => m.id === matId);
    if (!mat) {
      updateRow(index, {
        material_id: '',
        item_name: '',
      });
      return;
    }
    updateRow(index, {
      mode: 'catalogue',
      material_id: mat.id,
      item_name: mat.item_name,
      category: mat.category,
      unit: mat.unit,
      rate: mat.purchase_rate,
      update_stock: true,
      save_to_catalogue: false,
    });
    if (!supplierName && mat.supplier) {
      setSupplierName(mat.supplier);
    }
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        key: `row-${Date.now()}-${prev.length}`,
        mode: materials.length > 0 ? 'catalogue' : 'custom',
        material_id: '',
        item_name: '',
        description: '',
        category: MATERIAL_CATEGORIES[0],
        unit: 'Piece',
        quantity: 1,
        rate: 0,
        update_stock: true,
        save_to_catalogue: false,
      },
    ]);
  };

  const removeRow = (index: number) => {
    if (rows.length <= 1) {
      showError('Validation Error', 'Purchase bill must contain at least one item');
      return;
    }
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim()) {
      showError('Validation Error', 'Please enter the supplier / vendor name');
      return;
    }

    const validRows = rows.filter((r) => r.item_name.trim().length > 0);
    if (validRows.length === 0) {
      showError('Validation Error', 'Please add at least one bill item');
      return;
    }

    setSubmitting(true);
    try {
      await createPurchaseBill({
        supplier_name: supplierName.trim(),
        supplier_phone: supplierPhone.trim(),
        invoice_reference: invoiceReference.trim(),
        project_id: projectId || null,
        bill_date: billDate,
        payment_status: paymentStatus,
        payment_method: paymentMethod,
        tax_amount: cleanTax,
        notes: notes.trim(),
        record_as_expense: recordAsExpense,
        items: validRows.map((r, idx) => ({
          material_id: r.mode === 'catalogue' && r.material_id ? r.material_id : null,
          item_name: r.item_name.trim(),
          description: r.description.trim(),
          category: r.category,
          unit: r.unit,
          quantity: Math.max(0.01, Number(r.quantity) || 1),
          rate: Math.max(0, Number(r.rate) || 0),
          update_stock:
            r.mode === 'catalogue'
              ? r.update_stock
              : r.save_to_catalogue && r.update_stock,
          save_to_catalogue: r.mode === 'custom' && r.save_to_catalogue,
          sort_order: idx,
        })),
      });
      success('Purchase Bill Saved', 'Purchase bill recorded & stock updated');
      onClose();
    } catch (err: any) {
      showError('Save Failed', err.message || 'Failed to save purchase bill');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-semibold">
                Record Supplier Purchase Bill
              </h2>
              <p className="text-[11px] text-slate-400">
                Link supplier, project & stock items — automatically updates available stock
              </p>
            </div>
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
          className="p-6 space-y-5 max-h-[85vh] overflow-y-auto"
        >
          {/* Header Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="akd-label">Supplier / Vendor Name *</label>
              <input
                type="text"
                list="akd-supplier-suggestions"
                className="akd-input"
                placeholder="e.g., Bengal Timber & Veneer House"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                required
              />
              <datalist id="akd-supplier-suggestions">
                {supplierSuggestions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="akd-label">Invoice / Challan No.</label>
              <input
                type="text"
                className="akd-input"
                placeholder="e.g., INV-2026-412"
                value={invoiceReference}
                onChange={(e) => setInvoiceReference(e.target.value)}
              />
            </div>
            <div>
              <label className="akd-label">Bill Date *</label>
              <input
                type="date"
                className="akd-input"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="akd-label">Project / Site (Optional)</label>
              <select
                className="akd-input"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">General Studio Stock (No Project)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.project_name} ({p.project_code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="akd-label">Payment Status</label>
              <select
                className="akd-input"
                value={paymentStatus}
                onChange={(e) =>
                  setPaymentStatus(e.target.value as PurchaseBillPaymentStatus)
                }
              >
                {PURCHASE_BILL_PAYMENT_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="akd-label">Payment Method</label>
              <select
                className="akd-input"
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as PaymentMethod)
                }
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm} value={pm}>
                    {pm}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Purchase Bill Items
                </h3>
                <p className="text-xs text-slate-500">
                  Select an existing material from the catalogue or enter a custom item
                </p>
              </div>
              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Bill Item
              </button>
            </div>

            <div className="space-y-3">
              {rows.map((row, index) => {
                const lineAmount =
                  Math.max(0, Number(row.quantity) || 0) *
                  Math.max(0, Number(row.rate) || 0);
                return (
                  <div
                    key={row.key}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">
                          #{index + 1}
                        </span>
                        <div className="inline-flex rounded-lg bg-white p-0.5 border border-slate-200">
                          <button
                            type="button"
                            onClick={() =>
                              updateRow(index, {
                                mode: 'catalogue',
                                save_to_catalogue: false,
                                update_stock: true,
                              })
                            }
                            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                              row.mode === 'catalogue'
                                ? 'bg-slate-900 text-white'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            From Stock Catalogue
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateRow(index, {
                                mode: 'custom',
                                material_id: '',
                                update_stock: false,
                              })
                            }
                            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                              row.mode === 'custom'
                                ? 'bg-slate-900 text-white'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Custom / New Item
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-900">
                          {formatINR(lineAmount)}
                        </span>
                        {rows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRow(index)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            title="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {row.mode === 'catalogue' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        <div className="sm:col-span-6">
                          <label className="akd-label">
                            Select Catalogue Material *
                          </label>
                          <select
                            className="akd-input bg-white"
                            value={row.material_id}
                            onChange={(e) =>
                              handleSelectCatalogueMaterial(index, e.target.value)
                            }
                          >
                            <option value="">Choose from Materials Catalogue...</option>
                            {materials.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.item_name} (In Stock: {m.available_quantity} {m.unit})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="akd-label">Unit</label>
                          <input
                            type="text"
                            className="akd-input bg-white"
                            value={row.unit}
                            onChange={(e) =>
                              updateRow(index, { unit: e.target.value })
                            }
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="akd-label">Qty *</label>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            className="akd-input bg-white"
                            value={row.quantity}
                            onChange={(e) =>
                              updateRow(index, {
                                quantity: Number(e.target.value),
                              })
                            }
                            required
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="akd-label">Rate (₹) *</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="akd-input bg-white"
                            value={row.rate}
                            onChange={(e) =>
                              updateRow(index, { rate: Number(e.target.value) })
                            }
                            required
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        <div className="sm:col-span-6">
                          <label className="akd-label">
                            Custom / New Item Name *
                          </label>
                          <input
                            type="text"
                            className="akd-input bg-white"
                            placeholder="Enter item name..."
                            value={row.item_name}
                            onChange={(e) =>
                              updateRow(index, { item_name: e.target.value })
                            }
                            required
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="akd-label">Unit</label>
                          <select
                            className="akd-input bg-white"
                            value={row.unit}
                            onChange={(e) =>
                              updateRow(index, { unit: e.target.value })
                            }
                          >
                            {COMMON_MATERIAL_UNITS.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="akd-label">Qty *</label>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            className="akd-input bg-white"
                            value={row.quantity}
                            onChange={(e) =>
                              updateRow(index, {
                                quantity: Number(e.target.value),
                              })
                            }
                            required
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="akd-label">Rate (₹) *</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="akd-input bg-white"
                            value={row.rate}
                            onChange={(e) =>
                              updateRow(index, { rate: Number(e.target.value) })
                            }
                            required
                          />
                        </div>
                      </div>
                    )}

                    {/* Stock Update Options */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      {row.mode === 'catalogue' ? (
                        <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={row.update_stock}
                            onChange={(e) =>
                              updateRow(index, { update_stock: e.target.checked })
                            }
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>
                            Add purchased quantity (<strong>+{row.quantity || 0} {row.unit}</strong>) to available stock
                          </span>
                        </label>
                      ) : (
                        <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={row.save_to_catalogue}
                            onChange={(e) =>
                              updateRow(index, {
                                save_to_catalogue: e.target.checked,
                                update_stock: e.target.checked,
                              })
                            }
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <PackageCheck className="w-3.5 h-3.5 text-indigo-600" />
                          <span>
                            Also save this new item to Materials Catalogue & add{' '}
                            <strong>+{row.quantity || 0} {row.unit}</strong> to stock
                          </span>
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals & Expense Sync */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
            <div className="space-y-3">
              <div>
                <label className="akd-label">Bill Notes / Remarks</label>
                <textarea
                  rows={2}
                  className="akd-input"
                  placeholder="Vehicle number, delivery notes, or payment remarks..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-indigo-50/70 border border-indigo-200/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={recordAsExpense}
                  onChange={(e) => setRecordAsExpense(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="text-xs">
                  <p className="font-semibold text-slate-900">
                    Also record in Business Expenses (Materials)
                  </p>
                  <p className="text-slate-600">
                    Automatically creates a linked expense entry so project & studio expense reports stay in sync.
                  </p>
                </div>
              </label>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 flex flex-col justify-between">
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Items Subtotal</span>
                  <span className="font-semibold text-slate-900">
                    {formatINR(subtotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 text-slate-600">
                  <span>GST / Tax / Freight (₹)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-28 px-2.5 py-1 text-right text-xs rounded-lg border border-slate-300 bg-white font-medium text-slate-900"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2.5 border-t border-slate-200">
                <span className="text-sm font-bold text-slate-900">
                  Total Bill Amount
                </span>
                <span className="text-base font-extrabold text-indigo-700">
                  {formatINR(grandTotal)}
                </span>
              </div>
            </div>
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
              disabled={submitting}
              className="akd-btn-primary"
            >
              {submitting ? 'Saving Bill...' : 'Save Purchase Bill & Update Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
