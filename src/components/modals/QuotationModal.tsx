import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  LayoutList,
  CheckSquare,
  Square,
  BookmarkCheck,
  RotateCcw,
  Landmark,
  PenTool,
  Upload,
  FileDown,
  AlertCircle,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useCRM } from '@/context/CRMContext';
import { useToast } from '@/context/ToastContext';
import {
  Quotation,
  QuotationStatus,
  QUOTATION_STATUSES,
  COMMON_BOQ_UNITS,
  QuotationPDFSections,
  DEFAULT_QUOTATION_PDF_SECTIONS,
} from '@/types/crm';
import { amountToIndianWords, formatINR, todayISO } from '@/lib/formatters';
import { computeQuotationTotals } from '@/services/database';
import { exportQuotationPDF } from '@/lib/exporters';

interface QuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  projectId?: string;
  editQuotation?: Quotation;
  onSavedAndExport?: (savedQuotation: Quotation) => void;
}

interface BOQDraftItem {
  id: string;
  item_name: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
}

interface PDFSectionOption {
  key: keyof QuotationPDFSections;
  label: string;
  description: string;
  badge?: string;
}

function addDaysISO(baseIso: string, days: number): string {
  const d = new Date(baseIso || todayISO());
  if (Number.isNaN(d.getTime())) return todayISO();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const createEmptyBOQRow = (): BOQDraftItem => ({
  id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  item_name: '',
  description: '',
  quantity: 1,
  unit: 'Sq. ft.',
  rate: 0,
});

export const QuotationModal: React.FC<QuotationModalProps> = ({
  isOpen,
  onClose,
  clientId,
  projectId,
  editQuotation,
  onSavedAndExport,
}) => {
  const {
    clients,
    projects,
    settings,
    createQuotation,
    updateQuotation,
    updateSettings,
  } = useCRM();
  const { success, error: showError } = useToast();

  const client = clients.find((c) => c.id === clientId);
  const clientProjects = projects.filter((p) => p.client_id === clientId && !p.is_archived);

  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    editQuotation?.project_id || projectId || (clientProjects[0]?.id ?? '')
  );
  const project = projects.find((p) => p.id === selectedProjectId);

  const defaultValidityDays = settings.default_quotation_validity_days || 30;

  const [quotationDate, setQuotationDate] = useState<string>(
    editQuotation?.quotation_date || todayISO()
  );
  const [validUntil, setValidUntil] = useState<string>(
    editQuotation?.valid_until || addDaysISO(todayISO(), defaultValidityDays)
  );
  const [status, setStatus] = useState<QuotationStatus>(
    editQuotation?.status || 'Draft'
  );
  const [scopeOfWork, setScopeOfWork] = useState<string>(
    editQuotation?.scope_of_work ??
      (project?.description ? project.description : '')
  );
  const [paymentTerms, setPaymentTerms] = useState<string>(
    editQuotation?.payment_terms ??
      (settings.default_payment_terms ||
        '1. 50% advance with order confirmation.\n2. 30% upon mid-execution / carpentry fabrication milestone.\n3. 20% upon completion and site handover.')
  );
  const [termsAndConditions, setTermsAndConditions] = useState<string>(
    editQuotation?.terms_and_conditions ??
      (settings.default_terms_and_conditions ||
        '1. All materials and finishes strictly as per approved BOQ specifications.\n2. Any extra civil, electrical, or structural changes requested on site will be billed as per actuals.\n3. Quotation validity is subject to material price stability.')
  );
  const [notes, setNotes] = useState<string>(editQuotation?.notes || '');
  const [discountPercentage, setDiscountPercentage] = useState<number>(
    editQuotation ? editQuotation.discount_percentage : 0
  );
  const [taxRate, setTaxRate] = useState<number>(
    editQuotation ? editQuotation.tax_rate : 0
  );

  // 13 PDF Section Selection checkboxes right inside Create / Edit Quotation
  const [pdfSections, setPdfSections] = useState<QuotationPDFSections>(() => ({
    ...DEFAULT_QUOTATION_PDF_SECTIONS,
    ...(settings.quotation_pdf_defaults || {}),
    ...(editQuotation?.pdf_sections || {}),
  }));

  // Inline Bank Details & Authorized Signature fields (synced with Studio Settings)
  const [bankAccountName, setBankAccountName] = useState<string>(
    settings.bank_account_name || ''
  );
  const [bankName, setBankName] = useState<string>(settings.bank_name || '');
  const [bankAccountNumber, setBankAccountNumber] = useState<string>(
    settings.bank_account_number || ''
  );
  const [bankIfscCode, setBankIfscCode] = useState<string>(
    settings.bank_ifsc_code || ''
  );
  const [bankBranch, setBankBranch] = useState<string>(
    settings.bank_branch || ''
  );
  const [bankUpiId, setBankUpiId] = useState<string>(settings.bank_upi_id || '');
  const [authorizedSignatory, setAuthorizedSignatory] = useState<string>(
    settings.authorized_signatory || ''
  );
  const [signatureUrl, setSignatureUrl] = useState<string>(
    settings.signature_url || ''
  );

  const [items, setItems] = useState<BOQDraftItem[]>(() => {
    if (editQuotation && editQuotation.items.length > 0) {
      return [...editQuotation.items]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((it) => ({
          id: it.id,
          item_name: it.item_name,
          description: it.description || '',
          quantity: it.quantity,
          unit: it.unit,
          rate: it.rate,
        }));
    }
    return [createEmptyBOQRow()];
  });

  useEffect(() => {
    if (!isOpen) return;
    const initialProjId =
      editQuotation?.project_id || projectId || (clientProjects[0]?.id ?? '');
    setSelectedProjectId(initialProjId);
    const matchedProj = projects.find((p) => p.id === initialProjId);

    setQuotationDate(editQuotation?.quotation_date || todayISO());
    setValidUntil(
      editQuotation?.valid_until ||
        addDaysISO(todayISO(), settings.default_quotation_validity_days || 30)
    );
    setStatus(editQuotation?.status || 'Draft');
    setScopeOfWork(
      editQuotation ? editQuotation.scope_of_work || '' : matchedProj?.description || ''
    );
    setPaymentTerms(
      editQuotation
        ? editQuotation.payment_terms || ''
        : settings.default_payment_terms ||
            '1. 50% advance with order confirmation.\n2. 30% upon mid-execution / carpentry fabrication milestone.\n3. 20% upon completion and site handover.'
    );
    setTermsAndConditions(
      editQuotation
        ? editQuotation.terms_and_conditions || ''
        : settings.default_terms_and_conditions ||
            '1. All materials and finishes strictly as per approved BOQ specifications.\n2. Any extra civil, electrical, or structural changes requested on site will be billed as per actuals.\n3. Quotation validity is subject to material price stability.'
    );
    setNotes(editQuotation?.notes || '');
    setDiscountPercentage(editQuotation ? editQuotation.discount_percentage : 0);
    setTaxRate(editQuotation ? editQuotation.tax_rate : 0);

    setPdfSections({
      ...DEFAULT_QUOTATION_PDF_SECTIONS,
      ...(settings.quotation_pdf_defaults || {}),
      ...(editQuotation?.pdf_sections || {}),
    });

    setBankAccountName(settings.bank_account_name || '');
    setBankName(settings.bank_name || '');
    setBankAccountNumber(settings.bank_account_number || '');
    setBankIfscCode(settings.bank_ifsc_code || '');
    setBankBranch(settings.bank_branch || '');
    setBankUpiId(settings.bank_upi_id || '');
    setAuthorizedSignatory(settings.authorized_signatory || '');
    setSignatureUrl(settings.signature_url || '');

    if (editQuotation && editQuotation.items.length > 0) {
      setItems(
        [...editQuotation.items]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((it) => ({
            id: it.id,
            item_name: it.item_name,
            description: it.description || '',
            quantity: it.quantity,
            unit: it.unit,
            rate: it.rate,
          }))
      );
    } else {
      setItems([createEmptyBOQRow()]);
    }
  }, [isOpen, editQuotation?.id]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDefault, setIsSavingDefault] = useState(false);

  // Live calculated summary
  const totals = computeQuotationTotals(items, discountPercentage, taxRate);

  const hasBankDetailsFilled = Boolean(
    bankAccountName.trim() ||
      bankName.trim() ||
      bankAccountNumber.trim() ||
      bankIfscCode.trim() ||
      bankBranch.trim() ||
      bankUpiId.trim()
  );

  const pdfSectionOptions: PDFSectionOption[] = [
    {
      key: 'showBusinessDetails',
      label: 'Business logo and details',
      description: 'AKD emblem, business name, address, phone, and email',
    },
    {
      key: 'showClientDetails',
      label: 'Client details',
      description: 'Client name, address, phone, and email box',
    },
    {
      key: 'showProjectDetails',
      label: 'Project/site details',
      description: 'Project title, category, code, and work-site address box',
    },
    {
      key: 'showBoqTable',
      label: 'BOQ table',
      description: `Itemized schedule of work (${items.length} line item${items.length === 1 ? '' : 's'})`,
    },
    {
      key: 'showRateQtyAmount',
      label: 'Rate, quantity, and amount columns',
      description: 'Show rate, quantity, and line amount columns inside BOQ table',
      badge: !pdfSections.showBoqTable ? 'Requires BOQ table' : undefined,
    },
    {
      key: 'showDiscount',
      label: 'Discount section',
      description: 'Discount percentage and deduction row in totals summary',
      badge: totals.discount_amount > 0 ? `-${formatINR(totals.discount_amount)}` : '0% (No discount)',
    },
    {
      key: 'showTax',
      label: 'Tax/GST section',
      description: 'Applicable GST/tax rate and tax amount row in totals summary',
      badge: totals.tax_amount > 0 ? `+${formatINR(totals.tax_amount)}` : '0% (No tax)',
    },
    {
      key: 'showScopeOfWork',
      label: 'Scope of work',
      description: 'Architectural scope and material specifications section',
      badge: scopeOfWork.trim() ? 'Included' : 'Empty',
    },
    {
      key: 'showPaymentTerms',
      label: 'Payment terms',
      description: 'Milestone billing schedule and payment stages',
      badge: paymentTerms.trim() ? 'Included' : 'Empty',
    },
    {
      key: 'showTermsAndConditions',
      label: 'Terms and conditions',
      description: 'Commercial and site execution terms & conditions',
      badge: termsAndConditions.trim() ? 'Included' : 'Empty',
    },
    {
      key: 'showNotes',
      label: 'Notes',
      description: 'Additional remarks, timelines, or warranty notes',
      badge: notes.trim() ? 'Included' : 'Empty',
    },
    {
      key: 'showBankDetails',
      label: 'Bank details',
      description: 'Bank name, account number, IFSC, branch, and UPI for NEFT/RTGS',
      badge: hasBankDetailsFilled ? bankName.trim() || 'Configured' : 'Fill below',
    },
    {
      key: 'showSignature',
      label: 'Authorized signature',
      description: 'For All Kind Decor signatory block and signature image',
      badge: authorizedSignatory.trim() || 'Signatory',
    },
  ];

  const togglePdfSection = (key: keyof QuotationPDFSections) => {
    setPdfSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSelectAllSections = () => {
    setPdfSections({ ...DEFAULT_QUOTATION_PDF_SECTIONS });
  };

  const handleResetToStudioDefaults = () => {
    setPdfSections({
      ...DEFAULT_QUOTATION_PDF_SECTIONS,
      ...(settings.quotation_pdf_defaults || {}),
    });
    success('Defaults Restored', 'Reset to studio default PDF section preferences.');
  };

  const handleSaveAsStudioDefault = async () => {
    setIsSavingDefault(true);
    try {
      await updateSettings({
        quotation_pdf_defaults: pdfSections,
        bank_account_name: bankAccountName.trim(),
        bank_name: bankName.trim(),
        bank_account_number: bankAccountNumber.trim(),
        bank_ifsc_code: bankIfscCode.trim().toUpperCase(),
        bank_branch: bankBranch.trim(),
        bank_upi_id: bankUpiId.trim(),
        authorized_signatory: authorizedSignatory.trim() || settings.authorized_signatory,
        signature_url: signatureUrl,
      });
      success(
        'Studio Defaults Saved',
        'Saved your PDF section selection and bank/signatory details as default.'
      );
    } catch (err: any) {
      showError('Save Failed', err?.message || 'Could not save default preferences.');
    } finally {
      setIsSavingDefault(false);
    }
  };

  const handleSignatureImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showError('Invalid File', 'Please select a PNG or JPG image for the signature.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showError('File Too Large', 'Signature image must be under 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSignatureUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddItem = () => {
    setItems((prev) => [...prev, createEmptyBOQRow()]);
  };

  const handleApplyBlankStructureTemplate = () => {
    const templateRows: BOQDraftItem[] = [
      {
        id: `tpl-1-${Date.now()}`,
        item_name: 'Living & Dining Area — Ceiling & Wall Panelling',
        description: '',
        quantity: 1,
        unit: 'Sq. ft.',
        rate: 0,
      },
      {
        id: `tpl-2-${Date.now()}`,
        item_name: 'Modular Kitchen — Base & Overhead Cabinets',
        description: '',
        quantity: 1,
        unit: 'Sq. ft.',
        rate: 0,
      },
      {
        id: `tpl-3-${Date.now()}`,
        item_name: 'Master Bedroom — Wardrobe & Loft Storage',
        description: '',
        quantity: 1,
        unit: 'Sq. ft.',
        rate: 0,
      },
    ];
    setItems((prev) => {
      const hasOnlyBlankRow =
        prev.length === 1 && !prev[0].item_name.trim() && Number(prev[0].rate) === 0;
      return hasOnlyBlankRow ? templateRows : [...prev, ...templateRows];
    });
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      showError('Validation', 'A quotation must contain at least one line item.');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= items.length) return;
    setItems((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
  };

  const handleItemChange = (index: number, field: keyof BOQDraftItem, value: any) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, [field]: value } : it))
    );
  };

  const persistQuotation = async (openExportAfterSave: boolean) => {
    const emptyItems = items.filter((it) => !it.item_name.trim());
    if (emptyItems.length > 0) {
      showError(
        'Validation Error',
        'Please provide a work/service description for all BOQ line items.'
      );
      return;
    }

    const invalidQty = items.some(
      (it) => Number(it.quantity) <= 0 || Number.isNaN(Number(it.quantity))
    );
    if (invalidQty) {
      showError(
        'Validation Error',
        'Every BOQ item must have a quantity greater than zero.'
      );
      return;
    }

    const invalidRate = items.some(
      (it) => Number(it.rate) < 0 || Number.isNaN(Number(it.rate))
    );
    if (invalidRate) {
      showError('Validation Error', 'Item rates cannot be negative.');
      return;
    }

    if (validUntil && quotationDate && validUntil < quotationDate) {
      showError(
        'Validation Error',
        'Valid Until date cannot be earlier than the Quotation Date.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      // Persist any bank or signatory updates to settings so the PDF uses them immediately
      const bankOrSigChanged =
        bankAccountName.trim() !== (settings.bank_account_name || '') ||
        bankName.trim() !== (settings.bank_name || '') ||
        bankAccountNumber.trim() !== (settings.bank_account_number || '') ||
        bankIfscCode.trim().toUpperCase() !== (settings.bank_ifsc_code || '') ||
        bankBranch.trim() !== (settings.bank_branch || '') ||
        bankUpiId.trim() !== (settings.bank_upi_id || '') ||
        authorizedSignatory.trim() !== (settings.authorized_signatory || '') ||
        signatureUrl !== (settings.signature_url || '');

      let latestSettings = settings;
      if (bankOrSigChanged) {
        latestSettings = await updateSettings({
          bank_account_name: bankAccountName.trim(),
          bank_name: bankName.trim(),
          bank_account_number: bankAccountNumber.trim(),
          bank_ifsc_code: bankIfscCode.trim().toUpperCase(),
          bank_branch: bankBranch.trim(),
          bank_upi_id: bankUpiId.trim(),
          authorized_signatory:
            authorizedSignatory.trim() || settings.authorized_signatory,
          signature_url: signatureUrl,
        });
      }

      const cleanItems = items.map((it, idx) => {
        const qty = Math.max(0.01, Number(it.quantity) || 1);
        const rate = Math.max(0, Number(it.rate) || 0);
        return {
          item_name: it.item_name.trim(),
          description: it.description.trim() || undefined,
          quantity: qty,
          unit: it.unit,
          rate,
          amount: Math.round(qty * rate * 100) / 100,
          sort_order: idx,
        };
      });

      const resolvedProjectId =
        selectedProjectId || projectId || editQuotation?.project_id || null;

      let savedRecord: Quotation;

      if (editQuotation) {
        savedRecord = await updateQuotation(
          editQuotation.id,
          {
            client_id: clientId,
            project_id: resolvedProjectId,
            quotation_date: quotationDate,
            valid_until: validUntil,
            status,
            scope_of_work: scopeOfWork.trim() || undefined,
            payment_terms: paymentTerms.trim() || undefined,
            terms_and_conditions: termsAndConditions.trim() || undefined,
            notes: notes.trim() || undefined,
            discount_percentage: Math.min(
              100,
              Math.max(0, Number(discountPercentage) || 0)
            ),
            tax_rate: Math.max(0, Number(taxRate) || 0),
            pdf_sections: pdfSections,
          },
          cleanItems
        );
        success(
          'Quotation Updated',
          `Updated quotation ${editQuotation.quotation_number}.`
        );
      } else {
        savedRecord = await createQuotation({
          client_id: clientId,
          project_id: resolvedProjectId,
          quotation_date: quotationDate,
          valid_until: validUntil,
          status,
          scope_of_work: scopeOfWork.trim() || undefined,
          payment_terms: paymentTerms.trim() || undefined,
          terms_and_conditions: termsAndConditions.trim() || undefined,
          notes: notes.trim() || undefined,
          discount_percentage: Math.min(
            100,
            Math.max(0, Number(discountPercentage) || 0)
          ),
          tax_rate: Math.max(0, Number(taxRate) || 0),
          pdf_sections: pdfSections,
          items: cleanItems,
        });
        success(
          'Quotation Created',
          `Generated quotation ${savedRecord.quotation_number} (${formatINR(savedRecord.total_amount)}).`
        );
      }

      onClose();

      if (openExportAfterSave) {
        if (onSavedAndExport) {
          onSavedAndExport(savedRecord);
        } else if (client) {
          await exportQuotationPDF({
            quotation: savedRecord,
            client,
            project,
            settings: latestSettings,
            sections: pdfSections,
          });
        }
      }
    } catch (err: any) {
      showError('Save Failed', err?.message || 'Could not save quotation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistQuotation(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        editQuotation
          ? `Edit Quotation ${editQuotation.quotation_number}`
          : 'Create Interior Quotation & BOQ'
      }
      subtitle={`For ${client?.full_name || 'Client'}${project ? ` • ${project.project_name}` : ''}`}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Quotation Header Metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
          <div>
            <label className="akd-label">Associated Project</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="akd-select text-xs"
            >
              <option value="">General / Unassigned</option>
              {clientProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="akd-label">Quotation Date</label>
            <input
              type="date"
              required
              value={quotationDate}
              onChange={(e) => setQuotationDate(e.target.value)}
              className="akd-input text-xs"
            />
          </div>

          <div>
            <label className="akd-label">Valid Until</label>
            <input
              type="date"
              required
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="akd-input text-xs"
            />
          </div>

          <div>
            <label className="akd-label">Quotation Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as QuotationStatus)}
              className="akd-select text-xs"
            >
              {QUOTATION_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Itemized BOQ Table */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Itemized Bill of Quantities (BOQ)
              </h3>
              <p className="text-[11px] text-slate-500">
                Add bespoke interior works, materials, or turnkey execution packages
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!editQuotation && (
                <button
                  type="button"
                  onClick={handleApplyBlankStructureTemplate}
                  className="akd-btn-secondary h-7 px-2.5 text-[11px] inline-flex items-center gap-1 text-slate-600"
                  title="Insert blank room category rows with ₹0 rate"
                >
                  <LayoutList className="w-3.5 h-3.5" /> + Blank Room Headings (₹0)
                </button>
              )}
              <button
                type="button"
                onClick={handleAddItem}
                className="akd-btn-secondary h-7 px-2.5 text-xs inline-flex items-center gap-1 text-[#5448ED]"
              >
                <Plus className="w-3.5 h-3.5" /> Add Line Item
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {items.map((it, idx) => {
              const amount =
                Math.round(
                  (Number(it.quantity) || 0) * (Number(it.rate) || 0) * 100
                ) / 100;
              return (
                <div
                  key={it.id || idx}
                  className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/60 hover:bg-slate-50 space-y-2.5 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded bg-slate-200/80 text-slate-700">
                      Item #{idx + 1}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveItem(idx, 'up')}
                        className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-30"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === items.length - 1}
                        onClick={() => handleMoveItem(idx, 'down')}
                        className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-30"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600"
                        title="Remove Item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Item inputs row */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                    <div className="sm:col-span-5">
                      <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">
                        Work / Service Description *
                      </label>
                      <input
                        type="text"
                        required
                        value={it.item_name}
                        onChange={(e) =>
                          handleItemChange(idx, 'item_name', e.target.value)
                        }
                        placeholder="e.g. Master Bedroom Sliding Wardrobe"
                        className="akd-input text-xs"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">
                        Quantity *
                      </label>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        required
                        value={it.quantity}
                        onChange={(e) =>
                          handleItemChange(idx, 'quantity', e.target.value)
                        }
                        className="akd-input text-xs text-right"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">
                        Unit
                      </label>
                      <select
                        value={it.unit}
                        onChange={(e) =>
                          handleItemChange(idx, 'unit', e.target.value)
                        }
                        className="akd-select text-xs"
                      >
                        {COMMON_BOQ_UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">
                        Rate (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={it.rate}
                        onChange={(e) =>
                          handleItemChange(idx, 'rate', e.target.value)
                        }
                        className="akd-input text-xs text-right"
                      />
                    </div>
                  </div>

                  {/* Specification & Row total */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                    <div className="sm:col-span-9">
                      <input
                        type="text"
                        value={it.description}
                        onChange={(e) =>
                          handleItemChange(idx, 'description', e.target.value)
                        }
                        placeholder="Optional specification: BWP marine plywood, 1mm laminate finish, soft-close hardware..."
                        className="w-full text-[11px] px-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>
                    <div className="sm:col-span-3 text-right">
                      <span className="text-[10px] text-slate-500 block">
                        Line Amount
                      </span>
                      <span className="text-xs font-bold text-slate-900 font-mono tabular-nums">
                        {formatINR(amount)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Financial Calculation Block */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 p-4 rounded-xl border border-slate-200 bg-white">
          <div className="sm:col-span-6 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Discounts &amp; Applicable Tax
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Discount (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={discountPercentage}
                    onChange={(e) => setDiscountPercentage(Number(e.target.value))}
                    className="akd-input text-xs text-right pr-7"
                  />
                  <span className="absolute right-2.5 top-2 text-xs text-slate-400">
                    %
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  GST / Tax (%)
                </label>
                <select
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  className="akd-select text-xs"
                >
                  <option value={0}>0% (No Tax / Inclusive)</option>
                  <option value={5}>5% GST</option>
                  <option value={12}>12% GST</option>
                  <option value={18}>18% GST (Standard Interior)</option>
                  <option value={28}>28% GST</option>
                </select>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              Tax is calculated on the taxable subtotal after discount.
            </p>
          </div>

          <div className="sm:col-span-6 flex flex-col justify-between pl-0 sm:pl-4 sm:border-l border-slate-200 space-y-2">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>BOQ Subtotal:</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {formatINR(totals.subtotal)}
                </span>
              </div>
              {totals.discount_amount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Discount ({discountPercentage}%):</span>
                  <span className="font-semibold tabular-nums">
                    -{formatINR(totals.discount_amount)}
                  </span>
                </div>
              )}
              {taxRate > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>GST / Tax ({taxRate}%):</span>
                  <span className="font-semibold text-slate-900 tabular-nums">
                    +{formatINR(totals.tax_amount)}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-200 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-slate-900">
                  Grand Total:
                </span>
                <span className="text-xl font-bold font-display text-[#5448ED] tabular-nums">
                  {formatINR(totals.total_amount)}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 italic text-right">
                {amountToIndianWords(totals.total_amount)}
              </p>
            </div>
          </div>
        </div>

        {/* Scope of Work, Payment Terms, Terms & Conditions, Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="akd-label">Scope of Work (Optional)</label>
            <textarea
              rows={3}
              value={scopeOfWork}
              onChange={(e) => setScopeOfWork(e.target.value)}
              placeholder="Summary of turnkey interior scope and material specifications..."
              className="akd-textarea text-xs"
            />
          </div>

          <div>
            <label className="akd-label">Payment Terms (Optional)</label>
            <textarea
              rows={3}
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              placeholder="Milestone payment stages (e.g., 50% booking advance, 30% carpentry, 20% handover)..."
              className="akd-textarea text-xs"
            />
          </div>

          <div>
            <label className="akd-label">Terms &amp; Conditions (Optional)</label>
            <textarea
              rows={3}
              value={termsAndConditions}
              onChange={(e) => setTermsAndConditions(e.target.value)}
              placeholder="Warranty terms, material approvals, site readiness conditions..."
              className="akd-textarea text-xs"
            />
          </div>

          <div>
            <label className="akd-label">Additional Notes (Optional)</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Special client notes, delivery timelines, or exclusions..."
              className="akd-textarea text-xs"
            />
          </div>
        </div>

        {/* =====================================================================
            WHAT SHOULD APPEAR ON THE PDF? (13 SECTION CHECKBOXES + BANK & SIGNATORY)
        ===================================================================== */}
        <div className="p-4 sm:p-5 rounded-xl border border-indigo-200/80 bg-indigo-50/20 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-indigo-100">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span>What should appear on the PDF?</span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-semibold normal-case">
                  {Object.values(pdfSections).filter(Boolean).length} of 13 sections enabled
                </span>
              </h3>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Tick or untick which sections to show on the Quotation PDF (Bank details, GST, Discount, Scope, Terms, Signature, etc.)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllSections}
                className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 px-2.5 py-1 rounded-md bg-white border border-indigo-200 hover:bg-indigo-50 transition-colors"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={handleResetToStudioDefaults}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 px-2.5 py-1 rounded-md bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Use Studio Defaults
              </button>
              <button
                type="button"
                onClick={handleSaveAsStudioDefault}
                disabled={isSavingDefault}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
              >
                <BookmarkCheck className="w-3.5 h-3.5 text-indigo-600" />
                {isSavingDefault ? 'Saving...' : 'Save as Studio Default'}
              </button>
            </div>
          </div>

          {/* 13 Checkboxes Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {pdfSectionOptions.map((opt) => {
              const checked = pdfSections[opt.key];
              const isSubDisabled =
                opt.key === 'showRateQtyAmount' && !pdfSections.showBoqTable;

              return (
                <button
                  type="button"
                  key={opt.key}
                  role="checkbox"
                  aria-checked={checked}
                  disabled={isSubDisabled}
                  onClick={() => !isSubDisabled && togglePdfSection(opt.key)}
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all ${
                    isSubDisabled
                      ? 'opacity-50 bg-slate-50 border-slate-200 cursor-not-allowed'
                      : checked
                        ? 'bg-white border-indigo-300 shadow-2xs cursor-pointer'
                        : 'bg-white/60 border-slate-200/80 hover:bg-white cursor-pointer'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {checked && !isSubDisabled ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-xs font-semibold text-slate-900 truncate">
                        {opt.label}
                      </span>
                      {opt.badge && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                          {opt.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[10.5px] text-slate-500 leading-snug mt-0.5">
                      {opt.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {((!pdfSections.showTax && totals.tax_amount > 0) ||
            (!pdfSections.showDiscount && totals.discount_amount > 0)) && (
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200/80 flex items-start gap-2 text-xs text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Calculation Integrity:</span> Hiding
                the discount or tax row only hides that breakdown line on the PDF.
                The Grand Total ({formatINR(totals.total_amount)}) remains accurate.
              </div>
            </div>
          )}

          {/* Inline Bank Details & Authorized Signatory Editor when checked */}
          {(pdfSections.showBankDetails || pdfSections.showSignature) && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2 border-t border-indigo-100">
              {pdfSections.showBankDetails && (
                <div
                  className={`${
                    pdfSections.showSignature ? 'lg:col-span-7' : 'lg:col-span-12'
                  } p-3.5 rounded-xl bg-white border border-slate-200 space-y-3`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Landmark className="w-4 h-4 text-indigo-600" />
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Bank Details to Print on Quotation PDF
                      </h4>
                    </div>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-semibold">
                      Included on PDF
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">
                        Account Holder Name
                      </label>
                      <input
                        type="text"
                        value={bankAccountName}
                        onChange={(e) => setBankAccountName(e.target.value)}
                        placeholder="e.g. Sk Subrati Amin"
                        className="akd-input text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">
                        Bank Name
                      </label>
                      <input
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="e.g. Canara Bank"
                        className="akd-input text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">
                        Account Number
                      </label>
                      <input
                        type="text"
                        value={bankAccountNumber}
                        onChange={(e) => setBankAccountNumber(e.target.value)}
                        placeholder="e.g. 110135860623"
                        className="akd-input text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">
                        IFSC Code
                      </label>
                      <input
                        type="text"
                        value={bankIfscCode}
                        onChange={(e) =>
                          setBankIfscCode(e.target.value.toUpperCase())
                        }
                        placeholder="e.g. CNRB0004983"
                        className="akd-input text-xs font-mono uppercase"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">
                        Branch Name &amp; Address
                      </label>
                      <input
                        type="text"
                        value={bankBranch}
                        onChange={(e) => setBankBranch(e.target.value)}
                        placeholder="e.g. I floor pirbaba tower Inda OT Road"
                        className="akd-input text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">
                        UPI ID (Optional)
                      </label>
                      <input
                        type="text"
                        value={bankUpiId}
                        onChange={(e) => setBankUpiId(e.target.value)}
                        placeholder="e.g. akdinterior@okaxis"
                        className="akd-input text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {pdfSections.showSignature && (
                <div
                  className={`${
                    pdfSections.showBankDetails ? 'lg:col-span-5' : 'lg:col-span-12'
                  } p-3.5 rounded-xl bg-white border border-slate-200 space-y-3 flex flex-col justify-between`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <PenTool className="w-4 h-4 text-indigo-600" />
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Authorized Signatory
                        </h4>
                      </div>
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-semibold">
                        Included on PDF
                      </span>
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">
                        Signatory Name (Printed below signature)
                      </label>
                      <input
                        type="text"
                        value={authorizedSignatory}
                        onChange={(e) => setAuthorizedSignatory(e.target.value)}
                        placeholder="e.g. Sk Subrati Amin"
                        className="akd-input text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-600 block">
                        Signature Image (Optional PNG/JPG)
                      </label>
                      <div className="flex items-center gap-2">
                        <label className="akd-btn-secondary h-8 px-3 text-xs cursor-pointer inline-flex items-center gap-1.5">
                          <Upload className="w-3.5 h-3.5 text-indigo-600" />
                          <span>
                            {signatureUrl ? 'Change Signature' : 'Upload Signature'}
                          </span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={handleSignatureImageUpload}
                            className="hidden"
                          />
                        </label>
                        {signatureUrl && (
                          <button
                            type="button"
                            onClick={() => setSignatureUrl('')}
                            className="text-xs text-rose-600 hover:underline px-2 py-1"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      {signatureUrl && (
                        <div className="p-2 border border-slate-200 rounded-lg bg-slate-50 inline-block mt-1">
                          <img
                            src={signatureUrl}
                            alt="Signature preview"
                            className="max-h-10 object-contain"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500">
                    Prints as &ldquo;For {settings.business_name}&rdquo; with{' '}
                    {authorizedSignatory || 'Authorized Signatory'} on the bottom-right of the PDF.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="akd-btn-secondary h-9 px-4 text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => persistQuotation(true)}
            className="akd-btn-secondary h-9 px-4 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50 inline-flex items-center gap-1.5 font-semibold"
          >
            <FileDown className="w-3.5 h-3.5 text-indigo-600" />
            {isSubmitting
              ? 'Saving...'
              : editQuotation
                ? 'Update & Preview / Download PDF'
                : 'Save & Preview / Download PDF'}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="akd-btn-primary h-9 px-5 text-xs"
          >
            {isSubmitting
              ? 'Saving...'
              : editQuotation
                ? 'Update Quotation'
                : 'Save Quotation'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
