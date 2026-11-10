import React, { useState } from 'react';
import {
  X,
  FileDown,
  CheckSquare,
  Square,
  BookmarkCheck,
  RotateCcw,
  Eye,
  AlertCircle,
  Landmark,
  PenTool,
  Upload,
} from 'lucide-react';
import {
  BusinessSettings,
  Client,
  DEFAULT_QUOTATION_PDF_SECTIONS,
  Project,
  Quotation,
  QuotationPDFSections,
} from '@/types/crm';
import { useCRM } from '@/context/CRMContext';
import { useToast } from '@/context/ToastContext';
import { exportQuotationPDF } from '@/lib/exporters';
import { amountToIndianWords, formatDate, formatINR } from '@/lib/formatters';
import { BrandLogo } from '@/components/ui/BrandLogo';

interface QuotationPDFExportModalProps {
  isOpen?: boolean;
  quotation: Quotation;
  client: Client;
  project?: Project;
  onClose: () => void;
}

interface SectionOption {
  key: keyof QuotationPDFSections;
  label: string;
  description: string;
  hasContent: boolean;
  emptyHint?: string;
}

export const QuotationPDFExportModal: React.FC<QuotationPDFExportModalProps> = ({
  isOpen = true,
  quotation,
  client,
  project,
  onClose,
}) => {
  const { settings, updateQuotation, updateSettings } = useCRM();
  const { success, error: showError } = useToast();

  const initialSections: QuotationPDFSections = {
    ...DEFAULT_QUOTATION_PDF_SECTIONS,
    ...(settings.quotation_pdf_defaults || {}),
    ...(quotation.pdf_sections || {}),
  };

  const [sections, setSections] = useState<QuotationPDFSections>(initialSections);
  const [isExporting, setIsExporting] = useState(false);
  const [isSavingDefault, setIsSavingDefault] = useState(false);

  // Inline editable bank details & signatory so owner can customize right before export
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

  if (!isOpen) return null;

  const hasConfiguredBankDetails = Boolean(
    bankAccountName.trim() ||
      bankName.trim() ||
      bankAccountNumber.trim() ||
      bankIfscCode.trim() ||
      bankBranch.trim() ||
      bankUpiId.trim()
  );

  const resolvedPaymentTerms = quotation.payment_terms?.trim() || '';

  const sectionOptions: SectionOption[] = [
    {
      key: 'showBusinessDetails',
      label: 'Business logo and details',
      description: 'Studio emblem, business name, address, phone, email, and website',
      hasContent: true,
    },
    {
      key: 'showClientDetails',
      label: 'Client details',
      description: 'Client name, property address, phone, and email',
      hasContent: true,
    },
    {
      key: 'showProjectDetails',
      label: 'Project/site details',
      description: 'Project title, category, code, and work-site location',
      hasContent: true,
    },
    {
      key: 'showBoqTable',
      label: 'BOQ table',
      description: `Itemized schedule of work (${quotation.items.length} line items)`,
      hasContent: quotation.items.length > 0,
    },
    {
      key: 'showRateQtyAmount',
      label: 'Rate, quantity, and amount columns',
      description: 'Unit rates, quantities, and line-item amounts inside the BOQ table',
      hasContent: sections.showBoqTable,
      emptyHint: !sections.showBoqTable ? 'Requires BOQ table enabled' : undefined,
    },
    {
      key: 'showDiscount',
      label: 'Discount section',
      description: 'Discount percentage and deduction line in financial summary',
      hasContent: quotation.discount_amount > 0,
      emptyHint: quotation.discount_amount <= 0 ? 'No discount applied (₹0)' : undefined,
    },
    {
      key: 'showTax',
      label: 'Tax/GST section',
      description: 'Applicable GST/tax rate and tax amount row in financial summary',
      hasContent: quotation.tax_rate > 0 && quotation.tax_amount > 0,
      emptyHint:
        quotation.tax_rate <= 0 || quotation.tax_amount <= 0
          ? 'No tax applied (0%)'
          : undefined,
    },
    {
      key: 'showScopeOfWork',
      label: 'Scope of work',
      description: 'Architectural scope and material specifications narrative',
      hasContent: Boolean(quotation.scope_of_work?.trim()),
      emptyHint: !quotation.scope_of_work?.trim() ? 'Empty on this quotation' : undefined,
    },
    {
      key: 'showPaymentTerms',
      label: 'Payment terms',
      description: 'Milestone billing schedule and payment stages',
      hasContent: Boolean(resolvedPaymentTerms),
      emptyHint: !resolvedPaymentTerms ? 'Empty on this quotation' : undefined,
    },
    {
      key: 'showTermsAndConditions',
      label: 'Terms and conditions',
      description: 'Commercial and execution terms & conditions',
      hasContent: Boolean(quotation.terms_and_conditions?.trim()),
      emptyHint: !quotation.terms_and_conditions?.trim() ? 'Empty on this quotation' : undefined,
    },
    {
      key: 'showNotes',
      label: 'Notes',
      description: 'Additional remarks or warranty/material notes',
      hasContent: Boolean(quotation.notes?.trim()),
      emptyHint: !quotation.notes?.trim() ? 'Empty on this quotation' : undefined,
    },
    {
      key: 'showBankDetails',
      label: 'Bank details',
      description: 'Studio bank account number, IFSC, branch, and UPI details',
      hasContent: hasConfiguredBankDetails,
      emptyHint: !hasConfiguredBankDetails ? 'Fill below to include' : bankName.trim() || 'Configured',
    },
    {
      key: 'showSignature',
      label: 'Authorized signature',
      description: 'Signatory block and uploaded signature image (if configured)',
      hasContent: true,
      emptyHint: authorizedSignatory.trim() || undefined,
    },
  ];

  const toggleSection = (key: keyof QuotationPDFSections) => {
    setSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSelectAll = () => {
    setSections({ ...DEFAULT_QUOTATION_PDF_SECTIONS });
  };

  const handleResetToDefaults = () => {
    setSections({
      ...DEFAULT_QUOTATION_PDF_SECTIONS,
      ...(settings.quotation_pdf_defaults || {}),
    });
    success('Defaults Restored', 'Reset to studio default PDF preferences.');
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const buildEffectiveSettings = (): BusinessSettings => ({
    ...settings,
    bank_account_name: bankAccountName.trim(),
    bank_name: bankName.trim(),
    bank_account_number: bankAccountNumber.trim(),
    bank_ifsc_code: bankIfscCode.trim().toUpperCase(),
    bank_branch: bankBranch.trim(),
    bank_upi_id: bankUpiId.trim(),
    authorized_signatory: authorizedSignatory.trim() || settings.authorized_signatory,
    signature_url: signatureUrl,
  });

  const handleSaveAsStudioDefault = async () => {
    setIsSavingDefault(true);
    try {
      await updateSettings({
        quotation_pdf_defaults: sections,
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
        'Saved PDF section preferences and bank/signatory details as studio default.'
      );
    } catch (err: any) {
      showError('Save Failed', err?.message || 'Failed to save default preferences.');
    } finally {
      setIsSavingDefault(false);
    }
  };

  const handleDownloadPDF = async () => {
    setIsExporting(true);
    try {
      const effectiveSettings = buildEffectiveSettings();

      // Persist bank/signatory edits if modified
      const bankOrSigChanged =
        bankAccountName.trim() !== (settings.bank_account_name || '') ||
        bankName.trim() !== (settings.bank_name || '') ||
        bankAccountNumber.trim() !== (settings.bank_account_number || '') ||
        bankIfscCode.trim().toUpperCase() !== (settings.bank_ifsc_code || '') ||
        bankBranch.trim() !== (settings.bank_branch || '') ||
        bankUpiId.trim() !== (settings.bank_upi_id || '') ||
        authorizedSignatory.trim() !== (settings.authorized_signatory || '') ||
        signatureUrl !== (settings.signature_url || '');

      if (bankOrSigChanged) {
        await updateSettings({
          bank_account_name: effectiveSettings.bank_account_name,
          bank_name: effectiveSettings.bank_name,
          bank_account_number: effectiveSettings.bank_account_number,
          bank_ifsc_code: effectiveSettings.bank_ifsc_code,
          bank_branch: effectiveSettings.bank_branch,
          bank_upi_id: effectiveSettings.bank_upi_id,
          authorized_signatory: effectiveSettings.authorized_signatory,
          signature_url: effectiveSettings.signature_url,
        });
      }

      await updateQuotation(quotation.id, {
        pdf_sections: sections,
      });
      await exportQuotationPDF({
        quotation: { ...quotation, pdf_sections: sections },
        client,
        project,
        settings: effectiveSettings,
        sections,
      });
      success('Quotation Exported', `Quotation ${quotation.quotation_number} PDF downloaded.`);
      onClose();
    } catch (err: any) {
      showError('Export Failed', err?.message || 'Failed to export Quotation PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  const sortedItems = [...(quotation.items || [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-6xl my-auto overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                What should appear on the PDF?
              </h2>
              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/70 text-[11px] font-semibold">
                {quotation.quotation_number}
                {quotation.revision_number > 1 ? ` (Rev ${quotation.revision_number})` : ''}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose which sections to include on this quotation PDF and verify the live layout before downloading.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body: Checklist + Live Preview */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* Left: 13 Independent Checkboxes + Inline Bank & Signatory Editor */}
          <div className="lg:col-span-6 p-5 space-y-4 overflow-y-auto">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                >
                  Select All
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={handleResetToDefaults}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Use Studio Defaults
                </button>
              </div>

              <button
                type="button"
                onClick={handleSaveAsStudioDefault}
                disabled={isSavingDefault}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                <BookmarkCheck className="w-3.5 h-3.5 text-indigo-600" />
                {isSavingDefault ? 'Saving...' : 'Save as Studio Default'}
              </button>
            </div>

            <div className="space-y-1.5">
              {sectionOptions.map((opt) => {
                const checked = sections[opt.key];
                const isSubOptionDisabled =
                  opt.key === 'showRateQtyAmount' && !sections.showBoqTable;

                return (
                  <button
                    type="button"
                    key={opt.key}
                    role="checkbox"
                    aria-checked={checked}
                    disabled={isSubOptionDisabled}
                    onClick={() => !isSubOptionDisabled && toggleSection(opt.key)}
                    className={`w-full flex items-start gap-3 p-2.5 rounded-xl border text-left transition-all ${
                      isSubOptionDisabled
                        ? 'opacity-50 bg-slate-50 border-slate-100 cursor-not-allowed'
                        : checked
                          ? 'bg-indigo-50/35 border-indigo-200/80 cursor-pointer'
                          : 'bg-white border-slate-200/70 hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {checked && !isSubOptionDisabled ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-900">
                          {opt.label}
                        </span>
                        {opt.emptyHint && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">
                            {opt.emptyHint}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                        {opt.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Inline Bank Details Editor when Bank Details is checked */}
            {sections.showBankDetails && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900 uppercase tracking-wider">
                    <Landmark className="w-3.5 h-3.5 text-indigo-600" />
                    Bank Details on PDF
                  </span>
                  <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                    Live Editable
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">
                      Account Name
                    </label>
                    <input
                      type="text"
                      value={bankAccountName}
                      onChange={(e) => setBankAccountName(e.target.value)}
                      placeholder="Sk Subrati Amin"
                      className="akd-input text-xs bg-white"
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
                      placeholder="Canara Bank"
                      className="akd-input text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">
                      Account No.
                    </label>
                    <input
                      type="text"
                      value={bankAccountNumber}
                      onChange={(e) => setBankAccountNumber(e.target.value)}
                      placeholder="110135860623"
                      className="akd-input text-xs font-mono bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">
                      IFSC Code
                    </label>
                    <input
                      type="text"
                      value={bankIfscCode}
                      onChange={(e) => setBankIfscCode(e.target.value.toUpperCase())}
                      placeholder="CNRB0004983"
                      className="akd-input text-xs font-mono uppercase bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">
                      Branch
                    </label>
                    <input
                      type="text"
                      value={bankBranch}
                      onChange={(e) => setBankBranch(e.target.value)}
                      placeholder="I floor pirbaba tower Inda OT Road"
                      className="akd-input text-xs bg-white"
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
                      placeholder="akdinterior@okaxis"
                      className="akd-input text-xs bg-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Inline Signatory Editor when Authorized Signature is checked */}
            {sections.showSignature && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900 uppercase tracking-wider">
                    <PenTool className="w-3.5 h-3.5 text-indigo-600" />
                    Authorized Signatory on PDF
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">
                      Signatory Name
                    </label>
                    <input
                      type="text"
                      value={authorizedSignatory}
                      onChange={(e) => setAuthorizedSignatory(e.target.value)}
                      placeholder="Sk Subrati Amin"
                      className="akd-input text-xs bg-white"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="akd-btn-secondary h-8 px-3 text-xs cursor-pointer inline-flex items-center gap-1.5 bg-white">
                      <Upload className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{signatureUrl ? 'Change Signature' : 'Upload Signature'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleSignatureUpload}
                        className="hidden"
                      />
                    </label>
                    {signatureUrl && (
                      <button
                        type="button"
                        onClick={() => setSignatureUrl('')}
                        className="text-xs text-rose-600 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {((!sections.showTax && quotation.tax_amount > 0) ||
              (!sections.showDiscount && quotation.discount_amount > 0)) && (
              <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 flex items-start gap-2.5 text-xs text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Calculation Integrity Preserved:</span>{' '}
                  Hiding the discount or tax row hides only that breakdown line on the PDF. The
                  saved Grand Total ({formatINR(quotation.total_amount)}) is never silently
                  altered.
                </div>
              </div>
            )}
          </div>

          {/* Right: Live Document Layout Preview */}
          <div className="lg:col-span-6 bg-slate-100/80 p-5 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600">
                <Eye className="w-3.5 h-3.5 text-indigo-600" />
                Live PDF Document Preview
              </span>
              <span className="text-[11px] text-slate-500">
                A4 Portrait • {formatINR(quotation.total_amount)}
              </span>
            </div>

            {/* Simulated A4 Sheet matching reference layout */}
            <div className="bg-white rounded-lg shadow-md border border-slate-200/90 p-5 space-y-4 text-[11px] text-slate-800 flex-1 overflow-y-auto">
              {/* Header */}
              <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-200">
                {sections.showBusinessDetails ? (
                  <div className="flex items-start gap-3 min-w-0">
                    <BrandLogo
                      logoUrl={settings.logo_url}
                      collapsed
                      size="md"
                    />
                    <div className="min-w-0">
                      <p className="font-black text-slate-900 uppercase tracking-tight text-sm truncate">
                        {settings.business_name}
                      </p>
                      {settings.address && (
                        <p className="text-[10px] text-slate-600 leading-snug mt-0.5">
                          {settings.address}
                        </p>
                      )}
                      <p className="text-[10px] text-slate-700 mt-0.5">
                        {settings.phone && (
                          <>
                            <span className="font-semibold">Mobile:</span> {settings.phone}
                          </>
                        )}
                        {settings.phone && settings.email && '  |  '}
                        {settings.email && (
                          <>
                            <span className="font-semibold">Email:</span> {settings.email}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] italic text-slate-400">
                    (Business header hidden)
                  </div>
                )}

                <div className="text-right shrink-0">
                  <p className="text-sm font-black tracking-wide text-[#1D4ED8]">QUOTATION</p>
                  <p className="text-[8.5px] font-semibold uppercase tracking-wider text-slate-400">
                    ORIGINAL FOR RECIPIENT
                  </p>
                  <p className="text-[10px] text-slate-600 mt-1">
                    <span className="font-semibold">Quotation #:</span>{' '}
                    <span className="font-bold text-slate-900">
                      {quotation.quotation_number}
                      {quotation.revision_number > 1 ? ` (Rev ${quotation.revision_number})` : ''}
                    </span>
                  </p>
                  <p className="text-[10px] text-slate-600">
                    <span className="font-semibold">Date:</span>{' '}
                    <span className="font-bold text-slate-900">
                      {formatDate(quotation.quotation_date, settings.date_format)}
                    </span>
                  </p>
                  <p className="text-[10px] text-slate-600">
                    <span className="font-semibold">Valid Until:</span>{' '}
                    <span className="font-bold text-slate-900">
                      {formatDate(quotation.valid_until, settings.date_format)}
                    </span>
                  </p>
                </div>
              </div>

              {/* Client & Project Boxes */}
              {(sections.showClientDetails || sections.showProjectDetails) && (
                <div
                  className={`grid gap-2.5 ${
                    sections.showClientDetails && sections.showProjectDetails
                      ? 'grid-cols-2'
                      : 'grid-cols-1'
                  }`}
                >
                  {sections.showClientDetails && (
                    <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/50 space-y-0.5">
                      <div className="text-[9px] font-bold uppercase text-[#1D4ED8] mb-0.5">
                        Client Details (Bill To)
                      </div>
                      <p className="font-bold text-slate-900">{client.full_name}</p>
                      <p className="text-[10px] text-slate-600">Phone: {client.phone}</p>
                      {(client.full_address || client.property_location) && (
                        <p className="text-[10px] text-slate-600 line-clamp-2">
                          Addr: {client.full_address || client.property_location}
                        </p>
                      )}
                    </div>
                  )}

                  {sections.showProjectDetails && (
                    <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/50 space-y-0.5">
                      <div className="text-[9px] font-bold uppercase text-[#1D4ED8] mb-0.5">
                        Project / Work-Site Details
                      </div>
                      <p className="font-bold text-slate-900">
                        {project?.project_name ||
                          `${client.property_type || client.client_type} Interior Work`}
                      </p>
                      {project && (
                        <p className="text-[10px] text-slate-600">
                          Category: {project.category} ({project.project_code})
                        </p>
                      )}
                      {(project?.site_address ||
                        project?.property_location ||
                        client.property_location) && (
                        <p className="text-[10px] text-slate-600 line-clamp-2">
                          Loc:{' '}
                          {project?.site_address ||
                            project?.property_location ||
                            client.property_location}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* BOQ Table */}
              {sections.showBoqTable && (
                <div className="border border-slate-300 rounded overflow-hidden">
                  <table className="w-full text-left border-collapse text-[10px]">
                    <thead>
                      <tr className="bg-[#EEF2F6] text-slate-900 border-b border-slate-300">
                        <th className="py-1.5 px-2 text-center w-7 font-bold border-r border-slate-300">
                          #
                        </th>
                        <th className="py-1.5 px-2 font-bold border-r border-slate-300">
                          DESCRIPTION OF WORK / SERVICE
                        </th>
                        {sections.showRateQtyAmount ? (
                          <>
                            <th className="py-1.5 px-2 text-right font-bold border-r border-slate-300">
                              RATE (Rs.)
                            </th>
                            <th className="py-1.5 px-2 text-center font-bold border-r border-slate-300">
                              QUANTITY
                            </th>
                            <th className="py-1.5 px-2 text-right font-bold">
                              AMOUNT (Rs.)
                            </th>
                          </>
                        ) : (
                          <th className="py-1.5 px-2 text-center font-bold">UNIT</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300">
                      {sortedItems.map((it, idx) => (
                        <tr key={it.id || idx}>
                          <td className="py-1.5 px-2 text-center font-semibold text-slate-700 border-r border-slate-300 align-top">
                            {idx + 1}
                          </td>
                          <td className="py-1.5 px-2 border-r border-slate-300 align-top">
                            <p className="font-bold text-slate-900">{it.item_name}</p>
                            {it.description && (
                              <p className="text-[9.5px] text-slate-500 mt-0.5">
                                {it.description}
                              </p>
                            )}
                          </td>
                          {sections.showRateQtyAmount ? (
                            <>
                              <td className="py-1.5 px-2 text-right border-r border-slate-300 align-top whitespace-nowrap">
                                {formatINR(it.rate)}
                              </td>
                              <td className="py-1.5 px-2 text-center border-r border-slate-300 align-top whitespace-nowrap">
                                {it.quantity} {it.unit}
                              </td>
                              <td className="py-1.5 px-2 text-right font-bold text-slate-900 align-top whitespace-nowrap">
                                {formatINR(it.amount)}
                              </td>
                            </>
                          ) : (
                            <td className="py-1.5 px-2 text-center text-slate-600 align-top">
                              {it.unit}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Totals & Amount in Words */}
              <div className="grid grid-cols-12 gap-3 items-start">
                <div className="col-span-7 border border-slate-200 bg-slate-50/60 rounded-lg p-2.5">
                  <div className="text-[9px] font-bold text-slate-600">
                    Total Amount (in words):
                  </div>
                  <div className="font-bold text-slate-900 text-[10px] mt-0.5">
                    {amountToIndianWords(quotation.total_amount)}
                  </div>
                </div>

                <div className="col-span-5 text-[10px] space-y-1">
                  <div className="px-1 py-0.5 flex justify-between">
                    <span className="font-semibold text-slate-600">Sub Total:</span>
                    <span className="font-semibold text-slate-900">
                      {formatINR(quotation.subtotal)}
                    </span>
                  </div>
                  {sections.showDiscount && quotation.discount_amount > 0 && (
                    <div className="px-1 py-0.5 flex justify-between text-rose-700">
                      <span className="font-semibold">
                        Discount ({quotation.discount_percentage}%):
                      </span>
                      <span className="font-semibold">
                        - {formatINR(quotation.discount_amount)}
                      </span>
                    </div>
                  )}
                  {sections.showTax && quotation.tax_rate > 0 && quotation.tax_amount > 0 && (
                    <div className="px-1 py-0.5 flex justify-between">
                      <span className="font-semibold text-slate-600">
                        Tax / GST ({quotation.tax_rate}%):
                      </span>
                      <span className="font-semibold text-slate-900">
                        + {formatINR(quotation.tax_amount)}
                      </span>
                    </div>
                  )}
                  <div className="px-1 py-1.5 flex justify-between border-y border-slate-900 font-black text-slate-900 text-[11px]">
                    <span>GRAND TOTAL:</span>
                    <span>{formatINR(quotation.total_amount)}</span>
                  </div>
                </div>
              </div>

              {/* Optional Narrative Sections */}
              {sections.showScopeOfWork && quotation.scope_of_work?.trim() && (
                <div className="space-y-1">
                  <div className="bg-slate-50 border border-slate-200 px-2.5 py-1 text-[9px] font-bold uppercase text-slate-700 rounded">
                    Scope of Work &amp; Specifications
                  </div>
                  <p className="text-[10px] text-slate-600 whitespace-pre-line px-1">
                    {quotation.scope_of_work}
                  </p>
                </div>
              )}

              {sections.showPaymentTerms && resolvedPaymentTerms && (
                <div className="space-y-1">
                  <div className="bg-slate-50 border border-slate-200 px-2.5 py-1 text-[9px] font-bold uppercase text-slate-700 rounded">
                    Payment Terms
                  </div>
                  <p className="text-[10px] text-slate-600 whitespace-pre-line px-1">
                    {resolvedPaymentTerms}
                  </p>
                </div>
              )}

              {sections.showTermsAndConditions && quotation.terms_and_conditions?.trim() && (
                <div className="space-y-1">
                  <div className="bg-slate-50 border border-slate-200 px-2.5 py-1 text-[9px] font-bold uppercase text-slate-700 rounded">
                    Terms and Conditions
                  </div>
                  <p className="text-[10px] text-slate-600 whitespace-pre-line px-1">
                    {quotation.terms_and_conditions}
                  </p>
                </div>
              )}

              {sections.showNotes && quotation.notes?.trim() && (
                <div className="space-y-1">
                  <div className="bg-slate-50 border border-slate-200 px-2.5 py-1 text-[9px] font-bold uppercase text-slate-700 rounded">
                    Notes
                  </div>
                  <p className="text-[10px] text-slate-600 whitespace-pre-line px-1">
                    {quotation.notes}
                  </p>
                </div>
              )}

              {/* Bottom Bank Details & Signature */}
              {((sections.showBankDetails && hasConfiguredBankDetails) ||
                sections.showSignature) && (
                <div className="grid grid-cols-12 gap-3 pt-1 items-end">
                  <div className="col-span-7">
                    {sections.showBankDetails && hasConfiguredBankDetails && (
                      <div className="border border-slate-200 bg-slate-50/50 rounded-lg p-2.5 space-y-0.5 text-[9.5px]">
                        <div className="text-[9px] font-bold uppercase text-[#1D4ED8] mb-1">
                          Bank Details for Direct NEFT / RTGS Transfer
                        </div>
                        {bankAccountName.trim() && (
                          <p className="grid grid-cols-12">
                            <span className="col-span-4 font-semibold text-slate-600">
                              Account Name:
                            </span>
                            <span className="col-span-8 font-bold text-slate-900">
                              {bankAccountName.trim()}
                            </span>
                          </p>
                        )}
                        {bankName.trim() && (
                          <p className="grid grid-cols-12">
                            <span className="col-span-4 font-semibold text-slate-600">
                              Bank Name:
                            </span>
                            <span className="col-span-8 font-bold text-slate-900">
                              {bankName.trim()}
                            </span>
                          </p>
                        )}
                        {bankAccountNumber.trim() && (
                          <p className="grid grid-cols-12">
                            <span className="col-span-4 font-semibold text-slate-600">
                              Account No.:
                            </span>
                            <span className="col-span-8 font-bold text-slate-900">
                              {bankAccountNumber.trim()}
                            </span>
                          </p>
                        )}
                        {bankIfscCode.trim() && (
                          <p className="grid grid-cols-12">
                            <span className="col-span-4 font-semibold text-slate-600">
                              IFSC Code:
                            </span>
                            <span className="col-span-8 font-bold text-slate-900">
                              {bankIfscCode.trim().toUpperCase()}
                            </span>
                          </p>
                        )}
                        {bankBranch.trim() && (
                          <p className="grid grid-cols-12">
                            <span className="col-span-4 font-semibold text-slate-600">
                              Branch:
                            </span>
                            <span className="col-span-8 font-bold text-slate-900">
                              {bankBranch.trim()}
                            </span>
                          </p>
                        )}
                        {bankUpiId.trim() && (
                          <p className="grid grid-cols-12">
                            <span className="col-span-4 font-semibold text-slate-600">
                              UPI ID:
                            </span>
                            <span className="col-span-8 font-bold text-slate-900">
                              {bankUpiId.trim()}
                            </span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="col-span-5">
                    {sections.showSignature && (
                      <div className="p-2 text-right flex flex-col justify-between min-h-[82px]">
                        <p className="text-[9.5px] font-bold text-slate-700">
                          For {settings.business_name}
                        </p>
                        {signatureUrl ? (
                          <div className="my-1.5 flex justify-end">
                            <img
                              src={signatureUrl}
                              alt="Authorized signature"
                              className="max-h-9 object-contain"
                            />
                          </div>
                        ) : (
                          <div className="h-7" />
                        )}
                        <div>
                          {authorizedSignatory.trim() && (
                            <p className="text-[10px] font-bold text-slate-900">
                              {authorizedSignatory.trim()}
                            </p>
                          )}
                          <p className="text-[9px] text-slate-500">Authorized Signatory</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500 hidden sm:block">
            Hidden sections are completely omitted from the generated PDF.
          </p>
          <div className="flex items-center gap-3 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isExporting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              <FileDown className="w-4 h-4 text-[#C5A059]" />
              {isExporting ? 'Generating PDF...' : 'Download Quotation PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
