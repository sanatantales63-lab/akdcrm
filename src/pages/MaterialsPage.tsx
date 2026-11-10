import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  FileSpreadsheet,
  Edit2,
  Trash2,
  CheckCircle2,
  Boxes,
} from 'lucide-react';
import { useCRM } from '@/context/CRMContext';
import { formatDate, formatINR } from '@/lib/formatters';
import {
  MATERIAL_CATEGORIES,
  Material,
  MaterialTransaction,
  PurchaseBill,
} from '@/types/crm';
import { MaterialFormModal } from '@/components/modals/MaterialFormModal';
import { MaterialTransactionModal } from '@/components/modals/MaterialTransactionModal';
import { PurchaseBillModal } from '@/components/modals/PurchaseBillModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/context/ToastContext';

export const MaterialsPage: React.FC = () => {
  const {
    materials,
    materialTransactions,
    purchaseBills,
    projects,
    settings,
    archiveMaterial,
    deleteMaterialTransaction,
    archivePurchaseBill,
  } = useCRM();
  const { success, error: showError } = useToast();

  const [activeTab, setActiveTab] = useState<
    'catalogue' | 'bills' | 'transactions'
  >('catalogue');

  // Catalogue Filters
  const [searchCatalogue, setSearchCatalogue] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [stockAlertFilter, setStockAlertFilter] = useState<
    'ALL' | 'LOW_STOCK' | 'IN_STOCK'
  >('ALL');

  // Bills Filters
  const [searchBills, setSearchBills] = useState('');
  const [billProjectFilter, setBillProjectFilter] = useState('ALL');
  const [billStatusFilter, setBillStatusFilter] = useState('ALL');

  // Transactions Filters
  const [searchTx, setSearchTx] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState<'ALL' | 'usage' | 'purchase'>(
    'ALL'
  );
  const [txProjectFilter, setTxProjectFilter] = useState('ALL');

  // Modals
  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);

  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txDefaultType, setTxDefaultType] = useState<'usage' | 'purchase'>(
    'usage'
  );
  const [txDefaultMaterialId, setTxDefaultMaterialId] = useState<
    string | undefined
  >(undefined);

  const [billModalOpen, setBillModalOpen] = useState(false);

  const [archivingMaterial, setArchivingMaterial] = useState<Material | null>(
    null
  );
  const [deletingTx, setDeletingTx] = useState<MaterialTransaction | null>(
    null
  );
  const [archivingBill, setArchivingBill] = useState<PurchaseBill | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const projectMap = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects]
  );
  const materialMap = useMemo(
    () => new Map(materials.map((m) => [m.id, m])),
    [materials]
  );

  // Metrics
  const stats = useMemo(() => {
    const totalInventoryValue = materials.reduce(
      (sum, m) =>
        sum +
        Math.max(0, Number(m.available_quantity) || 0) *
          Math.max(0, Number(m.purchase_rate) || 0),
      0
    );
    const lowStockCount = materials.filter(
      (m) => m.available_quantity <= m.low_stock_level
    ).length;
    const totalBillsAmount = purchaseBills.reduce(
      (sum, b) => sum + (Number(b.total_amount) || 0),
      0
    );
    const usageTxs = materialTransactions.filter(
      (t) => t.transaction_type === 'usage'
    );
    const totalUsageValue = usageTxs.reduce(
      (sum, t) => sum + (Number(t.total_amount) || 0),
      0
    );
    return {
      totalInventoryValue,
      lowStockCount,
      totalBillsAmount,
      usageCount: usageTxs.length,
      totalUsageValue,
    };
  }, [materials, purchaseBills, materialTransactions]);

  // Filtered Catalogue
  const filteredMaterials = useMemo(() => {
    const q = searchCatalogue.trim().toLowerCase();
    return materials.filter((m) => {
      if (categoryFilter !== 'ALL' && m.category !== categoryFilter)
        return false;
      const isLow = m.available_quantity <= m.low_stock_level;
      if (stockAlertFilter === 'LOW_STOCK' && !isLow) return false;
      if (stockAlertFilter === 'IN_STOCK' && isLow) return false;

      if (!q) return true;
      return (
        m.item_name.toLowerCase().includes(q) ||
        m.material_code.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        (m.supplier || '').toLowerCase().includes(q) ||
        (m.notes || '').toLowerCase().includes(q)
      );
    });
  }, [materials, searchCatalogue, categoryFilter, stockAlertFilter]);

  // Filtered Bills
  const filteredBills = useMemo(() => {
    const q = searchBills.trim().toLowerCase();
    return purchaseBills.filter((b) => {
      if (billProjectFilter !== 'ALL' && b.project_id !== billProjectFilter)
        return false;
      if (billStatusFilter !== 'ALL' && b.payment_status !== billStatusFilter)
        return false;
      if (!q) return true;
      const project = b.project_id ? projectMap.get(b.project_id) : undefined;
      const itemsMatch = (b.items || []).some((it) =>
        it.item_name.toLowerCase().includes(q)
      );
      return (
        b.bill_number.toLowerCase().includes(q) ||
        (b.invoice_reference || '').toLowerCase().includes(q) ||
        b.supplier_name.toLowerCase().includes(q) ||
        project?.project_name.toLowerCase().includes(q) ||
        itemsMatch
      );
    });
  }, [
    purchaseBills,
    searchBills,
    billProjectFilter,
    billStatusFilter,
    projectMap,
  ]);

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    const q = searchTx.trim().toLowerCase();
    return materialTransactions.filter((t) => {
      if (txTypeFilter !== 'ALL' && t.transaction_type !== txTypeFilter)
        return false;
      if (txProjectFilter !== 'ALL' && t.project_id !== txProjectFilter)
        return false;
      if (!q) return true;
      const mat = materialMap.get(t.material_id);
      const proj = t.project_id ? projectMap.get(t.project_id) : undefined;
      return (
        mat?.item_name.toLowerCase().includes(q) ||
        proj?.project_name.toLowerCase().includes(q) ||
        (t.supplier || '').toLowerCase().includes(q) ||
        (t.reference_number || '').toLowerCase().includes(q) ||
        (t.notes || '').toLowerCase().includes(q)
      );
    });
  }, [
    materialTransactions,
    searchTx,
    txTypeFilter,
    txProjectFilter,
    materialMap,
    projectMap,
  ]);

  const handleOpenTxModal = (
    type: 'usage' | 'purchase',
    materialId?: string
  ) => {
    setTxDefaultType(type);
    setTxDefaultMaterialId(materialId);
    setTxModalOpen(true);
  };

  const handleConfirmArchiveMaterial = async () => {
    if (!archivingMaterial) return;
    setIsDeleting(true);
    try {
      await archiveMaterial(archivingMaterial.id);
      success('Material Removed', 'Material removed from catalogue');
      setArchivingMaterial(null);
    } catch (err: any) {
      showError('Remove Failed', err.message || 'Failed to remove material');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmDeleteTx = async () => {
    if (!deletingTx) return;
    setIsDeleting(true);
    try {
      await deleteMaterialTransaction(deletingTx.id);
      success('Transaction Reversed', 'Transaction deleted & stock reversed');
      setDeletingTx(null);
    } catch (err: any) {
      showError('Delete Failed', err.message || 'Failed to delete transaction');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmArchiveBill = async () => {
    if (!archivingBill) return;
    setIsDeleting(true);
    try {
      await archivePurchaseBill(archivingBill.id);
      success('Bill Archived', 'Purchase bill archived & stock reversed');
      setArchivingBill(null);
    } catch (err: any) {
      showError('Archive Failed', err.message || 'Failed to archive purchase bill');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Materials, Stock &amp; Purchase Bills
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Reusable interior materials catalogue, project material usage &amp;
            supplier purchase bills
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => handleOpenTxModal('usage')}
            className="akd-btn-secondary"
          >
            <ArrowUpRight className="w-4 h-4 text-indigo-600" />
            Record Material Usage
          </button>
          <button
            onClick={() => setBillModalOpen(true)}
            className="akd-btn-secondary"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Record Purchase Bill
          </button>
          <button
            onClick={() => {
              setEditingMaterial(null);
              setMaterialModalOpen(true);
            }}
            className="akd-btn-primary"
          >
            <Plus className="w-4 h-4" />
            Add Material Item
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="akd-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Available Stock Value
            </p>
            <Boxes className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {formatINR(stats.totalInventoryValue)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Across {materials.length} catalogue item(s)
          </p>
        </div>

        <div className="akd-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Low-Stock Alerts
            </p>
            <AlertTriangle
              className={`w-4 h-4 ${
                stats.lowStockCount > 0 ? 'text-amber-500' : 'text-emerald-500'
              }`}
            />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {stats.lowStockCount}
            <span className="text-sm font-normal text-slate-500 ml-1.5">
              item(s) low
            </span>
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {stats.lowStockCount > 0
              ? 'At or below minimum stock level'
              : 'All materials adequately stocked'}
          </p>
        </div>

        <div className="akd-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Purchase Bills Total
            </p>
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {formatINR(stats.totalBillsAmount)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {purchaseBills.length} supplier bill(s) recorded
          </p>
        </div>

        <div className="akd-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Material Issued to Projects
            </p>
            <ArrowUpRight className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {formatINR(stats.totalUsageValue)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {stats.usageCount} site usage entries logged
          </p>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('catalogue')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'catalogue'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Package className="w-4 h-4" />
          Materials Catalogue &amp; Stock ({materials.length})
        </button>

        <button
          onClick={() => setActiveTab('bills')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'bills'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Supplier Purchase Bills ({purchaseBills.length})
        </button>

        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'transactions'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <ArrowUpRight className="w-4 h-4" />
          Stock Purchases &amp; Project Usage Log ({materialTransactions.length})
        </button>
      </div>

      {/* TAB 1: MATERIALS CATALOGUE */}
      {activeTab === 'catalogue' && (
        <>
          <div className="akd-card p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search item name, code, supplier..."
                  value={searchCatalogue}
                  onChange={(e) => setSearchCatalogue(e.target.value)}
                  className="akd-input pl-9"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="akd-select"
              >
                <option value="ALL">All Material Categories</option>
                {MATERIAL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={stockAlertFilter}
                onChange={(e) =>
                  setStockAlertFilter(
                    e.target.value as 'ALL' | 'LOW_STOCK' | 'IN_STOCK'
                  )
                }
                className="akd-select"
              >
                <option value="ALL">All Stock Levels</option>
                <option value="LOW_STOCK">Low / Out of Stock Only</option>
                <option value="IN_STOCK">Adequate Stock Only</option>
              </select>
            </div>
          </div>

          {filteredMaterials.length === 0 ? (
            <div className="akd-card p-12 text-center">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-800">
                No catalogue materials found
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                Add reusable interior materials (plywood, laminates, hardware,
                adhesives, lighting) to track stock and select them in purchase
                bills and quotations.
              </p>
              <button
                onClick={() => {
                  setEditingMaterial(null);
                  setMaterialModalOpen(true);
                }}
                className="akd-btn-primary"
              >
                <Plus className="w-4 h-4" />
                Add First Material
              </button>
            </div>
          ) : (
            <div className="akd-card overflow-hidden">
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="akd-th">Material Item</th>
                      <th className="akd-th">Category</th>
                      <th className="akd-th">Supplier</th>
                      <th className="akd-th text-right">Purchase Rate</th>
                      <th className="akd-th text-right">Available Stock</th>
                      <th className="akd-th text-right">Low-Stock Level</th>
                      <th className="akd-th">Status</th>
                      <th className="akd-th text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredMaterials.map((mat) => {
                      const isOut = mat.available_quantity <= 0;
                      const isLow =
                        !isOut && mat.available_quantity <= mat.low_stock_level;
                      return (
                        <tr
                          key={mat.id}
                          className="hover:bg-slate-50/80 transition-colors"
                        >
                          <td className="akd-td">
                            <div className="font-semibold text-slate-900">
                              {mat.item_name}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {mat.material_code}
                              {mat.notes ? ` • ${mat.notes}` : ''}
                            </div>
                          </td>
                          <td className="akd-td text-xs text-slate-600">
                            {mat.category}
                          </td>
                          <td className="akd-td text-xs text-slate-600">
                            {mat.supplier || '—'}
                          </td>
                          <td className="akd-td text-right font-mono font-medium text-slate-900">
                            {formatINR(mat.purchase_rate)}
                            <span className="text-[11px] text-slate-400">
                              /{mat.unit}
                            </span>
                          </td>
                          <td className="akd-td text-right font-mono font-bold text-slate-900">
                            {mat.available_quantity} {mat.unit}
                          </td>
                          <td className="akd-td text-right font-mono text-xs text-slate-500">
                            {mat.low_stock_level} {mat.unit}
                          </td>
                          <td className="akd-td">
                            {isOut ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                <AlertTriangle className="w-3 h-3" />
                                Out of Stock
                              </span>
                            ) : isLow ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                <AlertTriangle className="w-3 h-3" />
                                Low Stock
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                In Stock
                              </span>
                            )}
                          </td>
                          <td className="akd-td text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() =>
                                  handleOpenTxModal('usage', mat.id)
                                }
                                className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                                title="Record Project Usage"
                              >
                                Use on Site
                              </button>
                              <button
                                onClick={() =>
                                  handleOpenTxModal('purchase', mat.id)
                                }
                                className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                title="Add Stock Purchase"
                              >
                                + Stock
                              </button>
                              <button
                                onClick={() => {
                                  setEditingMaterial(mat);
                                  setMaterialModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                                title="Edit Material"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setArchivingMaterial(mat)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                title="Remove Material"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Catalogue Cards */}
              <div className="md:hidden divide-y divide-slate-100">
                {filteredMaterials.map((mat) => {
                  const isOut = mat.available_quantity <= 0;
                  const isLow =
                    !isOut && mat.available_quantity <= mat.low_stock_level;
                  return (
                    <div key={mat.id} className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">
                            {mat.item_name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {mat.category} • {mat.supplier || 'No supplier'}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                            isOut
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : isLow
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {mat.available_quantity} {mat.unit}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>
                          Rate: <strong>{formatINR(mat.purchase_rate)}</strong>/
                          {mat.unit}
                        </span>
                        <span>
                          Low-Stock Alert: {mat.low_stock_level} {mat.unit}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenTxModal('usage', mat.id)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold"
                          >
                            Use on Site
                          </button>
                          <button
                            onClick={() =>
                              handleOpenTxModal('purchase', mat.id)
                            }
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold"
                          >
                            + Stock
                          </button>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingMaterial(mat);
                              setMaterialModalOpen(true);
                            }}
                            className="p-1.5 text-slate-500"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setArchivingMaterial(mat)}
                            className="p-1.5 text-rose-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB 2: SUPPLIER PURCHASE BILLS */}
      {activeTab === 'bills' && (
        <>
          <div className="akd-card p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search bill no., invoice ref, supplier, or item..."
                  value={searchBills}
                  onChange={(e) => setSearchBills(e.target.value)}
                  className="akd-input pl-9"
                />
              </div>

              <select
                value={billProjectFilter}
                onChange={(e) => setBillProjectFilter(e.target.value)}
                className="akd-select"
              >
                <option value="ALL">All Projects / General Stock</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.project_name} ({p.project_code})
                  </option>
                ))}
              </select>

              <select
                value={billStatusFilter}
                onChange={(e) => setBillStatusFilter(e.target.value)}
                className="akd-select"
              >
                <option value="ALL">All Payment Statuses</option>
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
                <option value="Partial">Partial</option>
              </select>
            </div>
          </div>

          {filteredBills.length === 0 ? (
            <div className="akd-card p-12 text-center">
              <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-800">
                No purchase bills recorded yet
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                Record supplier purchase bills linked to projects and stock
                items to automatically update available material inventory.
              </p>
              <button
                onClick={() => setBillModalOpen(true)}
                className="akd-btn-primary"
              >
                <Plus className="w-4 h-4" />
                Record First Purchase Bill
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBills.map((bill) => {
                const project = bill.project_id
                  ? projectMap.get(bill.project_id)
                  : undefined;
                return (
                  <div key={bill.id} className="akd-card p-5 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                            {bill.bill_number}
                          </span>
                          {bill.invoice_reference && (
                            <span className="text-xs text-slate-500">
                              Ref: <strong>{bill.invoice_reference}</strong>
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                              bill.payment_status === 'Paid'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : bill.payment_status === 'Partial'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {bill.payment_status} ({bill.payment_method})
                          </span>
                          {bill.linked_expense_id && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Synced to Expenses
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 mt-1.5">
                          {bill.supplier_name}
                        </h3>
                        <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                          <span>
                            Date:{' '}
                            {formatDate(bill.bill_date, settings.date_format)}
                          </span>
                          <span>•</span>
                          {project ? (
                            <Link
                              to={`/projects/${project.id}`}
                              className="font-medium text-indigo-600 hover:underline"
                            >
                              Project: {project.project_name}
                            </Link>
                          ) : (
                            <span>General Studio Stock</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Bill Total</p>
                          <p className="text-base font-extrabold text-slate-900">
                            {formatINR(bill.total_amount)}
                          </p>
                        </div>
                        <button
                          onClick={() => setArchivingBill(bill)}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Archive Bill & Reverse Stock"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Bill Items Table */}
                    <div className="rounded-xl border border-slate-200/80 overflow-hidden bg-slate-50/50">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200/80 text-slate-500 bg-slate-100/60">
                            <th className="py-2 px-3 font-semibold">Item</th>
                            <th className="py-2 px-3 font-semibold text-right">
                              Qty
                            </th>
                            <th className="py-2 px-3 font-semibold text-right">
                              Rate
                            </th>
                            <th className="py-2 px-3 font-semibold text-right">
                              Amount
                            </th>
                            <th className="py-2 px-3 font-semibold text-right">
                              Stock Sync
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/60">
                          {(bill.items || []).map((it) => (
                            <tr key={it.id}>
                              <td className="py-2 px-3 font-medium text-slate-800">
                                {it.item_name}
                              </td>
                              <td className="py-2 px-3 text-right font-mono">
                                {it.quantity} {it.unit}
                              </td>
                              <td className="py-2 px-3 text-right font-mono">
                                {formatINR(it.rate)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">
                                {formatINR(it.amount)}
                              </td>
                              <td className="py-2 px-3 text-right">
                                {it.update_stock && it.material_id ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-semibold">
                                    +{it.quantity} {it.unit} Added
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400">
                                    Custom Item
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB 3: STOCK PURCHASES & PROJECT USAGE LOG */}
      {activeTab === 'transactions' && (
        <>
          <div className="akd-card p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search material, project, supplier, or notes..."
                  value={searchTx}
                  onChange={(e) => setSearchTx(e.target.value)}
                  className="akd-input pl-9"
                />
              </div>

              <select
                value={txTypeFilter}
                onChange={(e) =>
                  setTxTypeFilter(
                    e.target.value as 'ALL' | 'usage' | 'purchase'
                  )
                }
                className="akd-select"
              >
                <option value="ALL">All Stock Movements</option>
                <option value="usage">Project Material Usage (Out)</option>
                <option value="purchase">Stock Purchases (In)</option>
              </select>

              <select
                value={txProjectFilter}
                onChange={(e) => setTxProjectFilter(e.target.value)}
                className="akd-select"
              >
                <option value="ALL">All Projects / Sites</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.project_name} ({p.project_code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="akd-card p-12 text-center">
              <ArrowUpRight className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-800">
                No stock purchases or project usage entries found
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                Record material usage against projects or log stock purchases to
                maintain an accurate ledger of all material movements.
              </p>
              <button
                onClick={() => handleOpenTxModal('usage')}
                className="akd-btn-primary"
              >
                <ArrowUpRight className="w-4 h-4" />
                Record Material Usage
              </button>
            </div>
          ) : (
            <div className="akd-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="akd-th">Date</th>
                      <th className="akd-th">Movement</th>
                      <th className="akd-th">Material Item</th>
                      <th className="akd-th">Project / Site</th>
                      <th className="akd-th text-right">Quantity</th>
                      <th className="akd-th text-right">Unit Rate</th>
                      <th className="akd-th text-right">Total Value</th>
                      <th className="akd-th">Reference / Notes</th>
                      <th className="akd-th text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTransactions.map((tx) => {
                      const mat = materialMap.get(tx.material_id);
                      const proj = tx.project_id
                        ? projectMap.get(tx.project_id)
                        : undefined;
                      const isUsage = tx.transaction_type === 'usage';
                      return (
                        <tr
                          key={tx.id}
                          className="hover:bg-slate-50/80 transition-colors"
                        >
                          <td className="akd-td whitespace-nowrap text-xs font-medium text-slate-900">
                            {formatDate(
                              tx.transaction_date,
                              settings.date_format
                            )}
                          </td>
                          <td className="akd-td whitespace-nowrap">
                            {isUsage ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                <ArrowUpRight className="w-3 h-3" />
                                Project Usage
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <ArrowDownLeft className="w-3 h-3" />
                                Stock Purchase
                              </span>
                            )}
                          </td>
                          <td className="akd-td font-semibold text-slate-900">
                            {mat?.item_name || 'Catalogue Item'}
                          </td>
                          <td className="akd-td">
                            {proj ? (
                              <Link
                                to={`/projects/${proj.id}`}
                                className="font-medium text-indigo-600 hover:underline text-xs"
                              >
                                {proj.project_name}
                              </Link>
                            ) : (
                              <span className="text-xs text-slate-400">
                                Studio Stock
                              </span>
                            )}
                          </td>
                          <td
                            className={`akd-td text-right font-mono font-bold ${
                              isUsage ? 'text-amber-700' : 'text-emerald-700'
                            }`}
                          >
                            {isUsage ? '-' : '+'}
                            {tx.quantity} {mat?.unit || ''}
                          </td>
                          <td className="akd-td text-right font-mono text-xs text-slate-600">
                            {formatINR(tx.unit_rate)}
                          </td>
                          <td className="akd-td text-right font-mono font-semibold text-slate-900">
                            {formatINR(tx.total_amount)}
                          </td>
                          <td className="akd-td max-w-xs truncate text-xs text-slate-500">
                            {[tx.supplier, tx.reference_number, tx.notes]
                              .filter(Boolean)
                              .join(' • ') || '—'}
                          </td>
                          <td className="akd-td text-right">
                            <button
                              onClick={() => setDeletingTx(tx)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              title="Delete & Reverse Stock"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <MaterialFormModal
        isOpen={materialModalOpen}
        onClose={() => {
          setMaterialModalOpen(false);
          setEditingMaterial(null);
        }}
        editMaterial={editingMaterial}
      />

      <MaterialTransactionModal
        isOpen={txModalOpen}
        onClose={() => setTxModalOpen(false)}
        defaultType={txDefaultType}
        defaultMaterialId={txDefaultMaterialId}
      />

      <PurchaseBillModal
        isOpen={billModalOpen}
        onClose={() => setBillModalOpen(false)}
      />

      <ConfirmDialog
        isOpen={Boolean(archivingMaterial)}
        onClose={() => setArchivingMaterial(null)}
        onConfirm={handleConfirmArchiveMaterial}
        title="Remove Material from Catalogue?"
        description={`Are you sure you want to archive "${archivingMaterial?.item_name}" from the active materials catalogue?`}
        confirmLabel="Remove Material"
        isLoading={isDeleting}
      />

      <ConfirmDialog
        isOpen={Boolean(deletingTx)}
        onClose={() => setDeletingTx(null)}
        onConfirm={handleConfirmDeleteTx}
        title="Reverse & Delete Stock Transaction?"
        description="Deleting this transaction will automatically reverse its quantity change on the material's available stock."
        confirmLabel="Delete & Reverse Stock"
        isLoading={isDeleting}
      />

      <ConfirmDialog
        isOpen={Boolean(archivingBill)}
        onClose={() => setArchivingBill(null)}
        onConfirm={handleConfirmArchiveBill}
        title="Archive Purchase Bill?"
        description={`Archiving bill ${archivingBill?.bill_number} will reverse any stock additions from this bill and archive its linked expense entry.`}
        confirmLabel="Archive Bill"
        isLoading={isDeleting}
      />
    </div>
  );
};
