import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Sliders,
  Lock,
  Database,
  Plus,
  X,
  Save,
  FileSpreadsheet,
  Download,
  LogOut,
  RotateCcw,
  Sparkles,
  Trash2,
  Landmark,
} from 'lucide-react';
import { useCRM } from '@/context/CRMContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { exportFullDatabaseWorkbook } from '@/lib/exporters';
import {
  DEFAULT_QUOTATION_PDF_SECTIONS,
  QuotationPDFSections,
} from '@/types/crm';
import { uploadToCloudinary, isCloudinaryConfigured } from '@/lib/cloudinary';


const PDF_SECTION_LABELS: Array<{ key: keyof QuotationPDFSections; label: string }> = [
  { key: 'showBusinessDetails', label: 'Business logo & details' },
  { key: 'showClientDetails', label: 'Client details' },
  { key: 'showProjectDetails', label: 'Project / site details' },
  { key: 'showBoqTable', label: 'BOQ table' },
  { key: 'showRateQtyAmount', label: 'Rate, quantity & amount columns' },
  { key: 'showDiscount', label: 'Discount section' },
  { key: 'showTax', label: 'Tax / GST section' },
  { key: 'showScopeOfWork', label: 'Scope of work' },
  { key: 'showPaymentTerms', label: 'Payment terms' },
  { key: 'showTermsAndConditions', label: 'Terms and conditions' },
  { key: 'showNotes', label: 'Notes' },
  { key: 'showBankDetails', label: 'Bank details' },
  { key: 'showSignature', label: 'Authorized signature' },
];

export const SettingsPage: React.FC = () => {
  const {
    settings,
    clients,
    enquiries,
    projects,
    payments,
    expenses,
    updateSettings,
    clearAllBusinessData,
    seedFictionalSampleData,
  } = useCRM();
  const { session, changePassword, signOut } = useAuth();
  const { success, error: showError } = useToast();
  const navigate = useNavigate();

  // Business Profile Form State
  const [businessName, setBusinessName] = useState(settings.business_name);
  const [signatory, setSignatory] = useState(settings.authorized_signatory);
  const [logoUrl, setLogoUrl] = useState(settings.logo_url);
  const [signatureUrl, setSignatureUrl] = useState(settings.signature_url || '');
  const [phone, setPhone] = useState(settings.phone);
  const [email, setEmail] = useState(settings.email);
  const [address, setAddress] = useState(settings.address);
  const [website, setWebsite] = useState(settings.website);
  const [gstin, setGstin] = useState(settings.gstin || '');
  const [currency, setCurrency] = useState(settings.currency || 'INR');
  const [savingProfile, setSavingProfile] = useState(false);

  // Bank Details & Quotation Defaults State
  const [bankAccountName, setBankAccountName] = useState(settings.bank_account_name || '');
  const [bankName, setBankName] = useState(settings.bank_name || '');
  const [bankAccountNumber, setBankAccountNumber] = useState(settings.bank_account_number || '');
  const [bankIfscCode, setBankIfscCode] = useState(settings.bank_ifsc_code || '');
  const [bankBranch, setBankBranch] = useState(settings.bank_branch || '');
  const [bankUpiId, setBankUpiId] = useState(settings.bank_upi_id || '');
  const [defaultValidityDays, setDefaultValidityDays] = useState<number>(
    settings.default_quotation_validity_days || 30
  );
  const [defaultPaymentTerms, setDefaultPaymentTerms] = useState(
    settings.default_payment_terms || ''
  );
  const [defaultTermsAndConditions, setDefaultTermsAndConditions] = useState(
    settings.default_terms_and_conditions || ''
  );
  const [pdfDefaults, setPdfDefaults] = useState<QuotationPDFSections>({
    ...DEFAULT_QUOTATION_PDF_SECTIONS,
    ...(settings.quotation_pdf_defaults || {}),
  });
  const [savingQuotationSettings, setSavingQuotationSettings] = useState(false);

  // Preferences State
  const [dateFormat, setDateFormat] = useState<
    'dd MMM yyyy' | 'dd/MM/yyyy' | 'yyyy-MM-dd'
  >(settings.date_format);
  const [fyStartMonth, setFyStartMonth] = useState<number>(
    settings.financial_year_start_month
  );
  const [projectCategories, setProjectCategories] = useState<string[]>(
    settings.project_categories
  );
  const [newProjectCat, setNewProjectCat] = useState('');
  const [expenseCategories, setExpenseCategories] = useState<string[]>(
    settings.expense_categories
  );
  const [newExpenseCat, setNewExpenseCat] = useState('');
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Account Password Change State
  const [ownerFullName, setOwnerFullName] = useState(session?.user.full_name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);

  // Data Management Modals
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [confirmSeedOpen, setConfirmSeedOpen] = useState(false);
  const [processingData, setProcessingData] = useState(false);

  useEffect(() => {
    setBusinessName(settings.business_name);
    setSignatory(settings.authorized_signatory);
    setLogoUrl(settings.logo_url);
    setSignatureUrl(settings.signature_url || '');
    setPhone(settings.phone);
    setEmail(settings.email);
    setAddress(settings.address);
    setWebsite(settings.website);
    setGstin(settings.gstin || '');
    setCurrency(settings.currency || 'INR');
    setBankAccountName(settings.bank_account_name || '');
    setBankName(settings.bank_name || '');
    setBankAccountNumber(settings.bank_account_number || '');
    setBankIfscCode(settings.bank_ifsc_code || '');
    setBankBranch(settings.bank_branch || '');
    setBankUpiId(settings.bank_upi_id || '');
    setDefaultValidityDays(settings.default_quotation_validity_days || 30);
    setDefaultPaymentTerms(settings.default_payment_terms || '');
    setDefaultTermsAndConditions(settings.default_terms_and_conditions || '');
    setPdfDefaults({
      ...DEFAULT_QUOTATION_PDF_SECTIONS,
      ...(settings.quotation_pdf_defaults || {}),
    });
    setDateFormat(settings.date_format);
    setFyStartMonth(settings.financial_year_start_month);
    setProjectCategories(settings.project_categories);
    setExpenseCategories(settings.expense_categories);
  }, [settings]);

  const handleSaveBusinessProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateSettings({
        business_name: businessName.trim() || 'AKD All Kind Decor',
        authorized_signatory: signatory.trim() || businessName.trim(),
        logo_url: logoUrl.trim() || '/logo.png',
        signature_url: signatureUrl.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        website: website.trim(),
        gstin: gstin.trim(),
        currency: currency.trim() || 'INR',
      });
      success('Business Profile Saved', 'Updated studio identity, signature, and contact details.');
    } catch (err: any) {
      showError('Save Failed', err?.message || 'Could not update business profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveQuotationAndBankSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingQuotationSettings(true);
    try {
      await updateSettings({
        bank_account_name: bankAccountName.trim(),
        bank_name: bankName.trim(),
        bank_account_number: bankAccountNumber.trim(),
        bank_ifsc_code: bankIfscCode.trim().toUpperCase(),
        bank_branch: bankBranch.trim(),
        bank_upi_id: bankUpiId.trim(),
        default_quotation_validity_days: Math.max(1, Number(defaultValidityDays) || 30),
        default_payment_terms: defaultPaymentTerms.trim(),
        default_terms_and_conditions: defaultTermsAndConditions.trim(),
        quotation_pdf_defaults: pdfDefaults,
      });
      success(
        'Quotation & Bank Settings Saved',
        'Updated bank details and default quotation PDF preferences.'
      );
    } catch (err: any) {
      showError('Save Failed', err?.message || 'Could not save quotation settings.');
    } finally {
      setSavingQuotationSettings(false);
    }
  };

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);

  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showError('File Too Large', 'Please select a logo image smaller than 5MB.');
      return;
    }
    setUploadingLogo(true);
    try {
      if (isCloudinaryConfigured) {
        const result = await uploadToCloudinary(file, 'akd-crm/settings');
        setLogoUrl(result.secure_url);
      } else {
        // Fallback: Base64 local
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') setLogoUrl(reader.result);
        };
        reader.readAsDataURL(file);
      }
    } catch (err: any) {
      showError('Upload Failed', err?.message || 'Could not upload logo image.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSignatureFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showError('File Too Large', 'Please select a signature image smaller than 5MB.');
      return;
    }
    setUploadingSignature(true);
    try {
      if (isCloudinaryConfigured) {
        const result = await uploadToCloudinary(file, 'akd-crm/settings');
        setSignatureUrl(result.secure_url);
      } else {
        // Fallback: Base64 local
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') setSignatureUrl(reader.result);
        };
        reader.readAsDataURL(file);
      }
    } catch (err: any) {
      showError('Upload Failed', err?.message || 'Could not upload signature image.');
    } finally {
      setUploadingSignature(false);
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPrefs(true);
    try {
      await updateSettings({
        date_format: dateFormat,
        financial_year_start_month: fyStartMonth,
        project_categories: projectCategories,
        expense_categories: expenseCategories,
      });
      success('Preferences Updated', 'Saved date format, financial year, and category lists.');
    } catch (err: any) {
      showError('Update Failed', err?.message || 'Could not save preferences.');
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleAddProjectCategory = () => {
    const clean = newProjectCat.trim();
    if (!clean || projectCategories.includes(clean)) return;
    setProjectCategories((prev) => [...prev, clean]);
    setNewProjectCat('');
  };

  const handleAddExpenseCategory = () => {
    const clean = newExpenseCat.trim();
    if (!clean || expenseCategories.includes(clean)) return;
    setExpenseCategories((prev) => [...prev, clean]);
    setNewExpenseCat('');
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword && newPassword !== confirmPassword) {
      showError('Validation Error', 'New password and confirmation do not match.');
      return;
    }
    setSavingAccount(true);
    try {
      await changePassword({
        currentPassword,
        newPassword,
        fullName: ownerFullName,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      success('Account Updated', 'Your owner security credentials have been updated.');
    } catch (err: any) {
      showError('Update Failed', err?.message || 'Could not update credentials.');
    } finally {
      setSavingAccount(false);
    }
  };

  const handleExportJSONBackup = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      studio: settings.business_name,
      settings,
      clients,
      enquiries,
      projects,
      payments,
      expenses,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AKD_Interior_CRM_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    success('Backup Downloaded', 'Exported complete JSON data archive.');
  };

  const handleSeedDemoData = async () => {
    setProcessingData(true);
    try {
      await seedFictionalSampleData();
      success(
        'Fictional Sample Data Loaded',
        'Loaded clearly marked [DEMO] records for testing charts and exports.'
      );
      setConfirmSeedOpen(false);
    } catch (err: any) {
      showError('Seed Failed', err?.message || 'Could not load sample data.');
    } finally {
      setProcessingData(false);
    }
  };

  const handleClearData = async () => {
    setProcessingData(true);
    try {
      await clearAllBusinessData();
      success('Database Cleared', 'All business records have been reset to a clean empty state.');
      setConfirmClearOpen(false);
    } catch (err: any) {
      showError('Reset Failed', err?.message || 'Could not clear database.');
    } finally {
      setProcessingData(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200/80">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-display tracking-tight">
          Studio &amp; System Settings
        </h1>
        <p className="text-xs text-slate-600 mt-0.5">
          Manage AKD Interior business identity, categories, owner credentials, and data exports.
        </p>
      </div>

      {/* 1. Business Profile */}
      <form onSubmit={handleSaveBusinessProfile} className="akd-card p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900 font-display">
                1. Business Profile &amp; Branding
              </h2>
              <p className="text-xs text-slate-600">
                Displayed across the application, payment receipts, and exported PDF reports
              </p>
            </div>
          </div>
          <button
            type="submit"
            disabled={savingProfile}
            className="akd-btn-primary h-[34px] px-4 text-xs"
          >
            <Save className="w-3.5 h-3.5" />
            {savingProfile ? 'Saving...' : 'Save Profile'}
          </button>
        </div>

        {/* Logo Preview & Upload */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="w-16 h-16 rounded-xl bg-slate-950 border border-slate-800 p-2 flex items-center justify-center shrink-0">
            <img
              src={logoUrl || '/logo.png'}
              alt="Studio Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <p className="text-xs font-semibold text-slate-900">Official Studio Logo</p>
            <p className="text-xs text-slate-600">
              Uses the official AKD All Kind Decor logo by default. You can upload an updated PNG or reset to default.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <label className={`akd-btn-secondary h-8 px-3 text-xs ${uploadingLogo ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}`}>
                {uploadingLogo ? 'Uploading...' : 'Upload Logo Image'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={handleLogoFileUpload}
                  className="hidden"
                  disabled={uploadingLogo}
                />
              </label>
              {logoUrl !== '/logo.png' && (
                <button
                  type="button"
                  onClick={() => setLogoUrl('/logo.png')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#5448ED] hover:underline px-2"
                >
                  <RotateCcw className="w-3 h-3" /> Reset to Official AKD Logo
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="set-bname" className="akd-label">
              Business Name
            </label>
            <input
              id="set-bname"
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="akd-input"
              required
            />
          </div>

          <div>
            <label htmlFor="set-signatory" className="akd-label">
              Authorized Business Name (For Receipts)
            </label>
            <input
              id="set-signatory"
              type="text"
              value={signatory}
              onChange={(e) => setSignatory(e.target.value)}
              className="akd-input"
              required
            />
          </div>

          <div>
            <label htmlFor="set-phone" className="akd-label">
              Phone Number
            </label>
            <input
              id="set-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="akd-input"
            />
          </div>

          <div>
            <label htmlFor="set-email" className="akd-label">
              Email Address
            </label>
            <input
              id="set-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="akd-input"
            />
          </div>

          <div>
            <label htmlFor="set-website" className="akd-label">
              Official Website
            </label>
            <input
              id="set-website"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="akd-input"
            />
          </div>

          <div>
            <label htmlFor="set-gstin" className="akd-label">
              GSTIN / Tax Registration (Optional)
            </label>
            <input
              id="set-gstin"
              type="text"
              placeholder="e.g. 19AABCU9603R1ZM"
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
              className="akd-input uppercase"
            />
          </div>

          <div>
            <label htmlFor="set-currency" className="akd-label">
              Default Currency
            </label>
            <input
              id="set-currency"
              type="text"
              value={currency}
              disabled
              className="akd-input bg-slate-50 text-slate-600"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="set-address" className="akd-label">
              Business Address
            </label>
            <input
              id="set-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="akd-input"
            />
          </div>
        </div>

        {/* Authorized Signature Upload for Quotations */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="w-28 h-14 rounded-lg bg-white border border-slate-200 p-1.5 flex items-center justify-center shrink-0">
            {signatureUrl ? (
              <img
                src={signatureUrl}
                alt="Authorized Signature"
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="text-[10px] text-slate-400 italic">No signature image</span>
            )}
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-xs font-semibold text-slate-900">
              Authorized Signature Image (Optional)
            </p>
            <p className="text-xs text-slate-600">
              Printed in the bottom-right Authorized Signatory block on exported Quotation PDFs when enabled.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <label className={`akd-btn-secondary h-8 px-3 text-xs ${uploadingSignature ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}`}>
                {uploadingSignature ? 'Uploading...' : 'Upload Signature Image'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleSignatureFileUpload}
                  className="hidden"
                  disabled={uploadingSignature}
                />
              </label>
              {signatureUrl && (
                <button
                  type="button"
                  onClick={() => setSignatureUrl('')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline px-2"
                >
                  <X className="w-3 h-3" /> Remove Signature Image
                </button>
              )}
            </div>
          </div>
        </div>
      </form>

      {/* 1b. Bank Details & Quotation PDF Defaults */}
      <form onSubmit={handleSaveQuotationAndBankSettings} className="akd-card p-6 space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <Landmark className="w-4 h-4 text-indigo-600" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900 font-display">
                2. Bank Details &amp; Quotation PDF Defaults
              </h2>
              <p className="text-xs text-slate-600">
                Configure optional banking details and default sections for client Quotation PDFs (never shown on public tracking links)
              </p>
            </div>
          </div>
          <button
            type="submit"
            disabled={savingQuotationSettings}
            className="akd-btn-primary h-[34px] px-4 text-xs"
          >
            <Save className="w-3.5 h-3.5" />
            {savingQuotationSettings ? 'Saving...' : 'Save Quotation Settings'}
          </button>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Studio Bank Details (Optional — For Quotation PDFs)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="akd-label">Account Holder Name</label>
              <input
                type="text"
                value={bankAccountName}
                onChange={(e) => setBankAccountName(e.target.value)}
                placeholder="e.g. AKD All Kind Decor"
                className="akd-input text-xs"
              />
            </div>

            <div>
              <label className="akd-label">Bank Name</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. HDFC Bank"
                className="akd-input text-xs"
              />
            </div>

            <div>
              <label className="akd-label">Account Number</label>
              <input
                type="text"
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
                placeholder="e.g. 50200012345678"
                className="akd-input text-xs font-mono"
              />
            </div>

            <div>
              <label className="akd-label">IFSC Code</label>
              <input
                type="text"
                value={bankIfscCode}
                onChange={(e) => setBankIfscCode(e.target.value)}
                placeholder="e.g. HDFC0001234"
                className="akd-input text-xs font-mono uppercase"
              />
            </div>

            <div>
              <label className="akd-label">Branch</label>
              <input
                type="text"
                value={bankBranch}
                onChange={(e) => setBankBranch(e.target.value)}
                placeholder="e.g. Salt Lake Sector V, Kolkata"
                className="akd-input text-xs"
              />
            </div>

            <div>
              <label className="akd-label">UPI ID (Optional)</label>
              <input
                type="text"
                value={bankUpiId}
                onChange={(e) => setBankUpiId(e.target.value)}
                placeholder="e.g. akdinterior@hdfcbank"
                className="akd-input text-xs"
              />
            </div>
          </div>
        </div>

        {/* Quotation Defaults */}
        <div className="space-y-4 pt-3 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Default Quotation Terms &amp; Validity
            </h3>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-600 font-medium">
                Default Validity (Days):
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={defaultValidityDays}
                onChange={(e) => setDefaultValidityDays(Number(e.target.value))}
                className="w-20 akd-input h-8 text-xs text-right"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="akd-label">Default Payment Terms</label>
              <textarea
                rows={3}
                value={defaultPaymentTerms}
                onChange={(e) => setDefaultPaymentTerms(e.target.value)}
                placeholder="1. 50% advance with order confirmation..."
                className="akd-textarea text-xs"
              />
            </div>
            <div>
              <label className="akd-label">Default Terms &amp; Conditions</label>
              <textarea
                rows={3}
                value={defaultTermsAndConditions}
                onChange={(e) => setDefaultTermsAndConditions(e.target.value)}
                placeholder="1. All materials and finishes strictly as per approved BOQ..."
                className="akd-textarea text-xs"
              />
            </div>
          </div>
        </div>

        {/* Default Quotation PDF Sections */}
        <div className="space-y-2.5 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Default Quotation PDF Sections (&ldquo;What should appear on the PDF?&rdquo;)
              </h3>
              <p className="text-[11px] text-slate-500">
                Choose which sections are checked by default when exporting a Quotation PDF. Each quotation can still override these before download.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
            {PDF_SECTION_LABELS.map((item) => (
              <label
                key={item.key}
                className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200/80 bg-slate-50/60 hover:bg-slate-50 cursor-pointer text-xs text-slate-800"
              >
                <input
                  type="checkbox"
                  checked={Boolean(pdfDefaults[item.key])}
                  onChange={() =>
                    setPdfDefaults((prev) => ({
                      ...prev,
                      [item.key]: !prev[item.key],
                    }))
                  }
                  className="rounded border-slate-300 text-[#5448ED] focus:ring-[#5448ED]"
                />
                <span className="font-medium">{item.label}</span>
              </label>
            ))}
          </div>
        </div>
      </form>

      {/* 2. Preferences & Categories */}
      <form onSubmit={handleSavePreferences} className="akd-card p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-indigo-600" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900 font-display">
                2. Studio Preferences &amp; Categories
              </h2>
              <p className="text-xs text-slate-600">
                Configure date formatting, financial year start, and business category lists
              </p>
            </div>
          </div>
          <button
            type="submit"
            disabled={savingPrefs}
            className="akd-btn-primary h-[34px] px-4 text-xs"
          >
            <Save className="w-3.5 h-3.5" />
            {savingPrefs ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="pref-date" className="akd-label">
              Display Date Format
            </label>
            <select
              id="pref-date"
              value={dateFormat}
              onChange={(e) =>
                setDateFormat(
                  e.target.value as 'dd MMM yyyy' | 'dd/MM/yyyy' | 'yyyy-MM-dd'
                )
              }
              className="akd-select"
            >
              <option value="dd MMM yyyy">26 Oct 2026 (dd MMM yyyy)</option>
              <option value="dd/MM/yyyy">26/10/2026 (dd/MM/yyyy)</option>
              <option value="yyyy-MM-dd">2026-10-26 (yyyy-MM-dd)</option>
            </select>
          </div>

          <div>
            <label htmlFor="pref-fy" className="akd-label">
              Financial Year Start Month
            </label>
            <select
              id="pref-fy"
              value={fyStartMonth}
              onChange={(e) => setFyStartMonth(Number(e.target.value))}
              className="akd-select"
            >
              <option value={4}>April &mdash; March (Indian Standard FY)</option>
              <option value={1}>January &mdash; December (Calendar Year)</option>
            </select>
          </div>
        </div>

        {/* Project Categories Manager */}
        <div className="space-y-2.5 pt-2 border-t border-slate-100">
          <label className="akd-label">Default Project Categories</label>
          <div className="flex flex-wrap gap-2">
            {projectCategories.map((cat) => (
              <span
                key={cat}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-800"
              >
                {cat}
                {projectCategories.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setProjectCategories((prev) => prev.filter((c) => c !== cat))
                    }
                    className="text-slate-400 hover:text-rose-600 transition-colors"
                    aria-label={`Remove ${cat}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
          <div className="flex gap-2 max-w-md pt-1">
            <input
              type="text"
              value={newProjectCat}
              onChange={(e) => setNewProjectCat(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddProjectCategory();
                }
              }}
              placeholder="Add project category (e.g., False Ceiling)"
              className="akd-input h-[34px] text-xs"
            />
            <button
              type="button"
              onClick={handleAddProjectCategory}
              className="akd-btn-secondary h-[34px] px-3 text-xs shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        </div>

        {/* Expense Categories Manager */}
        <div className="space-y-2.5 pt-2 border-t border-slate-100">
          <label className="akd-label">Expense Categories</label>
          <div className="flex flex-wrap gap-2">
            {expenseCategories.map((cat) => (
              <span
                key={cat}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-800"
              >
                {cat}
                {expenseCategories.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpenseCategories((prev) => prev.filter((c) => c !== cat))
                    }
                    className="text-slate-400 hover:text-rose-600 transition-colors"
                    aria-label={`Remove ${cat}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
          <div className="flex gap-2 max-w-md pt-1">
            <input
              type="text"
              value={newExpenseCat}
              onChange={(e) => setNewExpenseCat(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddExpenseCategory();
                }
              }}
              placeholder="Add expense category (e.g., Electrical Fittings)"
              className="akd-input h-[34px] text-xs"
            />
            <button
              type="button"
              onClick={handleAddExpenseCategory}
              className="akd-btn-secondary h-[34px] px-3 text-xs shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        </div>
      </form>

      {/* 3. Owner Account & Security */}
      <form onSubmit={handleUpdateAccount} className="akd-card p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-indigo-600" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900 font-display">
                3. Owner Account &amp; Authentication
              </h2>
              <p className="text-xs text-slate-600">
                Manage owner display name, security credentials, or sign out
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              await signOut();
              navigate('/login');
            }}
            className="akd-btn-danger h-[34px] px-3 text-xs"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="acc-name" className="akd-label">
              Owner Full Name
            </label>
            <input
              id="acc-name"
              type="text"
              value={ownerFullName}
              onChange={(e) => setOwnerFullName(e.target.value)}
              className="akd-input"
            />
          </div>

          <div>
            <label htmlFor="acc-email" className="akd-label">
              Authenticated Owner Email
            </label>
            <input
              id="acc-email"
              type="email"
              value={session?.user.email || ''}
              disabled
              className="akd-input bg-slate-50 text-slate-600"
            />
          </div>

          <div>
            <label htmlFor="acc-curr-pass" className="akd-label">
              Current Password <span className="text-rose-500">*</span>
            </label>
            <input
              id="acc-curr-pass"
              type="password"
              required
              placeholder="Required to confirm changes"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="akd-input"
            />
          </div>

          <div>
            <label htmlFor="acc-new-pass" className="akd-label">
              New Password <span className="text-slate-600 font-normal">(Min 8 chars)</span>
            </label>
            <input
              id="acc-new-pass"
              type="password"
              minLength={8}
              placeholder="Leave blank if only updating name"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="akd-input"
            />
          </div>

          {newPassword && (
            <div className="sm:col-span-2">
              <label htmlFor="acc-conf-pass" className="akd-label">
                Confirm New Password
              </label>
              <input
                id="acc-conf-pass"
                type="password"
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="akd-input max-w-md"
              />
            </div>
          )}
        </div>

        <div className="pt-1">
          <button
            type="submit"
            disabled={savingAccount || !currentPassword}
            className="akd-btn-primary h-[34px] px-4 text-xs"
          >
            {savingAccount ? 'Updating Credentials...' : 'Update Owner Account'}
          </button>
        </div>
      </form>

      {/* 4. Data Management & Export Facility */}
      <div className="akd-card p-6 space-y-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <Database className="w-4 h-4 text-indigo-600" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900 font-display">
              4. Data Management &amp; Export Facility
            </h2>
            <p className="text-xs text-slate-600">
              Export complete business archives in Excel or JSON format
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between gap-3">
            <div>
              <h3 className="text-xs font-semibold text-slate-900">
                Complete Studio Excel Workbook (.xlsx)
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                Exports all Clients, Projects, Enquiries, Payments, and Expenses into a structured multi-sheet Excel file.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                exportFullDatabaseWorkbook({
                  settings,
                  clients,
                  enquiries,
                  projects,
                  payments,
                  expenses,
                });
                success('Full Workbook Exported', 'Downloaded complete studio .xlsx archive.');
              }}
              className="akd-btn-secondary h-[34px] text-xs w-full"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Export Full Studio Workbook (.xlsx)
            </button>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between gap-3">
            <div>
              <h3 className="text-xs font-semibold text-slate-900">
                Structured JSON Data Archive (.json)
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                Download a complete, portable JSON snapshot of all studio records and settings without exposing credentials.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportJSONBackup}
              className="akd-btn-secondary h-[34px] text-xs w-full"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" /> Export JSON Data Backup
            </button>
          </div>
        </div>

        {/* Development Sample Dataset & Reset Controls */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            <span className="font-semibold text-slate-900 block">
              Development &amp; First-Run Utilities
            </span>
            <span>
              Load clearly marked fictional <code>[DEMO]</code> records to test analytics &amp; exports, or reset all records to an empty database.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setConfirmSeedOpen(true)}
              className="akd-btn-secondary h-8 px-3 text-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Load Sample Records
            </button>

            <button
              type="button"
              onClick={() => setConfirmClearOpen(true)}
              className="akd-btn-danger h-8 px-3 text-xs"
            >
              <Trash2 className="w-3.5 h-3.5" /> Reset Database
            </button>
          </div>
        </div>
      </div>

      {/* Confirm Load Fictional Sample Data */}
      <ConfirmDialog
        isOpen={confirmSeedOpen}
        onClose={() => setConfirmSeedOpen(false)}
        onConfirm={handleSeedDemoData}
        isLoading={processingData}
        variant="warning"
        title="Load Fictional Sample Records"
        description="This will insert clearly labeled [DEMO] clients, projects, enquiries, payments, and expenses so you can preview charts and PDF/Excel exports. You can clear them at any time."
        confirmLabel="Load [DEMO] Records"
      />

      {/* Confirm Clear Database */}
      <ConfirmDialog
        isOpen={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
        onConfirm={handleClearData}
        isLoading={processingData}
        variant="danger"
        title="Reset Studio Database to Empty State"
        description="Are you sure you want to remove all clients, projects, enquiries, payments, and expenses? Your Owner Account and Studio Profile Settings will be preserved."
        confirmLabel="Clear All Records"
      />
    </div>
  );
};
