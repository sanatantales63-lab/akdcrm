import React, { useState, useEffect, useMemo } from 'react';
import { useCRM } from '@/context/CRMContext';
import { useToast } from '@/context/ToastContext';
import { MaterialTransactionType } from '@/types/crm';
import { formatINR, todayISO } from '@/lib/formatters';
import {
  X,
  ArrowUpRight,
  ArrowDownLeft,
  AlertTriangle,
  Package,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: 'usage' | 'purchase';
  defaultMaterialId?: string;
  defaultProjectId?: string;
}

export const MaterialTransactionModal: React.FC<Props> = ({
  isOpen,
  onClose,
  defaultType = 'usage',
  defaultMaterialId,
  defaultProjectId,
}) => {
  const { materials, projects, recordMaterialTransaction } = useCRM();
  const { success, error: showError } = useToast();

  const [transactionType, setTransactionType] =
    useState<MaterialTransactionType>(defaultType);
  const [materialId, setMaterialId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitRate, setUnitRate] = useState('0');
  const [supplier, setSupplier] = useState('');
  const [transactionDate, setTransactionDate] = useState(todayISO());
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTransactionType(defaultType);
    const initialMatId =
      defaultMaterialId || (materials.length > 0 ? materials[0].id : '');
    setMaterialId(initialMatId);
    const mat = materials.find((m) => m.id === initialMatId);
    setUnitRate(mat ? String(mat.purchase_rate || 0) : '0');
    setSupplier(mat?.supplier || '');
    setProjectId(
      defaultProjectId ||
        (defaultType === 'usage' && projects.length > 0 ? projects[0].id : '')
    );
    setQuantity('1');
    setTransactionDate(todayISO());
    setReferenceNumber('');
    setNotes('');
  }, [isOpen, defaultType, defaultMaterialId, defaultProjectId, materials, projects]);

  const selectedMaterial = useMemo(
    () => materials.find((m) => m.id === materialId),
    [materials, materialId]
  );

  const handleMaterialChange = (nextMatId: string) => {
    setMaterialId(nextMatId);
    const mat = materials.find((m) => m.id === nextMatId);
    if (mat) {
      setUnitRate(String(mat.purchase_rate || 0));
      if (!supplier) setSupplier(mat.supplier || '');
    }
  };

  const numQty = Math.max(0, Number(quantity) || 0);
  const numRate = Math.max(0, Number(unitRate) || 0);
  const totalAmount = numQty * numRate;

  const isInsufficientStock =
    transactionType === 'usage' &&
    Boolean(selectedMaterial) &&
    numQty > (selectedMaterial?.available_quantity || 0);

  const projectedStock = useMemo(() => {
    if (!selectedMaterial) return 0;
    if (transactionType === 'usage') {
      return Math.max(
        0,
        Number((selectedMaterial.available_quantity - numQty).toFixed(2))
      );
    }
    return Number((selectedMaterial.available_quantity + numQty).toFixed(2));
  }, [selectedMaterial, transactionType, numQty]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialId || !selectedMaterial) {
      showError('Validation Error', 'Please select a material from the catalogue');
      return;
    }
    if (transactionType === 'usage' && !projectId) {
      showError('Validation Error', 'Please select a project/site for material usage');
      return;
    }
    if (numQty <= 0) {
      showError('Validation Error', 'Quantity must be greater than zero');
      return;
    }
    if (isInsufficientStock) {
      showError(
        'Insufficient Stock',
        `Insufficient stock for "${selectedMaterial.item_name}". Available: ${selectedMaterial.available_quantity} ${selectedMaterial.unit}`
      );
      return;
    }

    setSubmitting(true);
    try {
      await recordMaterialTransaction({
        material_id: materialId,
        project_id: projectId || null,
        transaction_type: transactionType,
        quantity: numQty,
        unit_rate: numRate,
        supplier: supplier.trim(),
        transaction_date: transactionDate,
        reference_number: referenceNumber.trim(),
        notes: notes.trim(),
      });
      success(
        'Stock Updated',
        transactionType === 'usage'
          ? 'Project material usage recorded & stock updated'
          : 'Stock purchase recorded & available stock updated'
      );
      onClose();
    } catch (err: any) {
      showError('Save Failed', err.message || 'Failed to record stock transaction');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            {transactionType === 'usage' ? (
              <ArrowUpRight className="w-5 h-5 text-amber-400" />
            ) : (
              <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
            )}
            <h2 className="text-base font-semibold">
              {transactionType === 'usage'
                ? 'Record Project Material Usage'
                : 'Record Stock Purchase / Restock'}
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
            <label className="akd-label">Transaction Type *</label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setTransactionType('usage')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  transactionType === 'usage'
                    ? 'bg-indigo-50 border-indigo-600 text-indigo-800 ring-2 ring-indigo-500/20'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                Project Material Usage (Out)
              </button>
              <button
                type="button"
                onClick={() => setTransactionType('purchase')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  transactionType === 'purchase'
                    ? 'bg-emerald-50 border-emerald-600 text-emerald-800 ring-2 ring-emerald-500/20'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                Stock Purchase / Restock (In)
              </button>
            </div>
          </div>

          <div>
            <label className="akd-label">Material Item *</label>
            <select
              className="akd-input"
              value={materialId}
              onChange={(e) => handleMaterialChange(e.target.value)}
              required
            >
              <option value="">Select Material from Catalogue...</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.item_name} — Available: {m.available_quantity} {m.unit} (
                  {formatINR(m.purchase_rate)}/{m.unit})
                </option>
              ))}
            </select>
          </div>

          {selectedMaterial && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-600">
                <Package className="w-4 h-4 text-slate-400" />
                <span>
                  Current Stock:{' '}
                  <strong className="text-slate-900">
                    {selectedMaterial.available_quantity}{' '}
                    {selectedMaterial.unit}
                  </strong>
                </span>
              </div>
              <div className="text-slate-600">
                Stock After Entry:{' '}
                <strong
                  className={
                    isInsufficientStock
                      ? 'text-rose-600'
                      : projectedStock <= selectedMaterial.low_stock_level
                      ? 'text-amber-600'
                      : 'text-emerald-700'
                  }
                >
                  {projectedStock} {selectedMaterial.unit}
                </strong>
              </div>
            </div>
          )}

          <div>
            <label className="akd-label">
              {transactionType === 'usage'
                ? 'Project / Site (Required) *'
                : 'Linked Project (Optional)'}
            </label>
            <select
              className="akd-input"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              required={transactionType === 'usage'}
            >
              <option value="">
                {transactionType === 'usage'
                  ? 'Select Project / Site...'
                  : 'General Warehouse / Studio Stock'}
              </option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_name} ({p.project_code} • {p.property_location})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="akd-label">
                Quantity ({selectedMaterial?.unit || 'Units'}) *
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                className="akd-input"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="akd-label">Unit Rate (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="akd-input"
                value={unitRate}
                onChange={(e) => setUnitRate(e.target.value)}
              />
            </div>
            <div>
              <label className="akd-label">Date *</label>
              <input
                type="date"
                className="akd-input"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                required
              />
            </div>
          </div>

          {isInsufficientStock && selectedMaterial && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Insufficient Stock Available</p>
                <p className="mt-0.5">
                  Only{' '}
                  <strong>
                    {selectedMaterial.available_quantity}{' '}
                    {selectedMaterial.unit}
                  </strong>{' '}
                  available in stock. Please record a stock purchase first or
                  reduce usage quantity.
                </p>
              </div>
            </div>
          )}

          {transactionType === 'purchase' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="akd-label">Supplier / Vendor</label>
                <input
                  type="text"
                  className="akd-input"
                  placeholder="Supplier name"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                />
              </div>
              <div>
                <label className="akd-label">Challan / Bill Ref</label>
                <input
                  type="text"
                  className="akd-input"
                  placeholder="Optional challan or invoice no."
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                />
              </div>
            </div>
          )}

          <div>
            <label className="akd-label">Notes / Purpose</label>
            <textarea
              rows={2}
              className="akd-input"
              placeholder={
                transactionType === 'usage'
                  ? 'e.g., Issued for master bedroom wardrobe shutters...'
                  : 'e.g., Restocked marine plywood batch...'
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <div className="text-xs text-slate-500">
              Total Material Value:{' '}
              <strong className="text-slate-900 font-bold">
                {formatINR(totalAmount)}
              </strong>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="akd-btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || isInsufficientStock}
                className="akd-btn-primary"
              >
                {submitting
                  ? 'Saving...'
                  : transactionType === 'usage'
                  ? 'Record Material Usage'
                  : 'Record Stock Purchase'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
