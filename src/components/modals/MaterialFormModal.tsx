import React, { useState, useEffect } from 'react';
import { useCRM } from '@/context/CRMContext';
import { useToast } from '@/context/ToastContext';
import {
  COMMON_MATERIAL_UNITS,
  MATERIAL_CATEGORIES,
  Material,
} from '@/types/crm';
import { X, Package } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  editMaterial?: Material | null;
}

export const MaterialFormModal: React.FC<Props> = ({
  isOpen,
  onClose,
  editMaterial,
}) => {
  const { createMaterial, updateMaterial } = useCRM();
  const { success, error: showError } = useToast();

  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState<string>(MATERIAL_CATEGORIES[0]);
  const [unit, setUnit] = useState<string>('Piece');
  const [availableQuantity, setAvailableQuantity] = useState('0');
  const [purchaseRate, setPurchaseRate] = useState('');
  const [supplier, setSupplier] = useState('');
  const [lowStockLevel, setLowStockLevel] = useState('5');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (editMaterial) {
      setItemName(editMaterial.item_name);
      setCategory(editMaterial.category || MATERIAL_CATEGORIES[0]);
      setUnit(editMaterial.unit || 'Piece');
      setAvailableQuantity(String(editMaterial.available_quantity ?? 0));
      setPurchaseRate(String(editMaterial.purchase_rate ?? 0));
      setSupplier(editMaterial.supplier || '');
      setLowStockLevel(String(editMaterial.low_stock_level ?? 5));
      setNotes(editMaterial.notes || '');
    } else {
      setItemName('');
      setCategory(MATERIAL_CATEGORIES[0]);
      setUnit('Piece');
      setAvailableQuantity('0');
      setPurchaseRate('');
      setSupplier('');
      setLowStockLevel('5');
      setNotes('');
    }
  }, [editMaterial, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) {
      showError('Validation Error', 'Please enter the material item name');
      return;
    }

    const qty = Number(availableQuantity);
    const rate = Number(purchaseRate || 0);
    const lowStock = Number(lowStockLevel || 0);

    if (Number.isNaN(qty) || qty < 0) {
      showError('Validation Error', 'Available quantity must be 0 or greater');
      return;
    }
    if (Number.isNaN(rate) || rate < 0) {
      showError('Validation Error', 'Purchase rate must be 0 or greater');
      return;
    }

    setSubmitting(true);
    try {
      if (editMaterial) {
        await updateMaterial(editMaterial.id, {
          item_name: itemName.trim(),
          category,
          unit: unit.trim() || 'Piece',
          available_quantity: qty,
          purchase_rate: rate,
          supplier: supplier.trim(),
          low_stock_level: Math.max(0, lowStock),
          notes: notes.trim(),
        });
        success('Material Updated', 'Catalogue material updated');
      } else {
        await createMaterial({
          item_name: itemName.trim(),
          category,
          unit: unit.trim() || 'Piece',
          available_quantity: qty,
          purchase_rate: rate,
          supplier: supplier.trim(),
          low_stock_level: Math.max(0, lowStock),
          notes: notes.trim(),
        });
        success('Material Added', 'Material added to catalogue');
      }
      onClose();
    } catch (err: any) {
      showError('Save Failed', err.message || 'Failed to save material');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <Package className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-semibold">
              {editMaterial ? 'Edit Material Item' : 'Add Material to Catalogue'}
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
            <label className="akd-label">Material / Item Name *</label>
            <input
              type="text"
              className="akd-input"
              placeholder="e.g., CenturyPly Club Prime 19mm BWP Plywood (8x4)"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="akd-label">Category</label>
              <select
                className="akd-input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {MATERIAL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="akd-label">Unit *</label>
              <select
                className="akd-input"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              >
                {COMMON_MATERIAL_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
                {!COMMON_MATERIAL_UNITS.includes(unit as any) && unit && (
                  <option value={unit}>{unit}</option>
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="akd-label">Available Quantity *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="akd-input"
                value={availableQuantity}
                onChange={(e) => setAvailableQuantity(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="akd-label">Purchase Rate (₹) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="akd-input"
                placeholder="e.g., 3450"
                value={purchaseRate}
                onChange={(e) => setPurchaseRate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="akd-label">Low-Stock Alert Level</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="akd-input"
                value={lowStockLevel}
                onChange={(e) => setLowStockLevel(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="akd-label">Preferred Supplier / Vendor</label>
            <input
              type="text"
              className="akd-input"
              placeholder="e.g., Bengal Timber & Veneer House"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            />
          </div>

          <div>
            <label className="akd-label">Specification / Notes</label>
            <textarea
              rows={2}
              className="akd-input"
              placeholder="Brand, thickness, shade code, or storage notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
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
              {submitting
                ? 'Saving...'
                : editMaterial
                ? 'Update Material'
                : 'Add to Catalogue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
