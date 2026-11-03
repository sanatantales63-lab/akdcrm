import React, { useState } from 'react';
import {
  Share2,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Eye,
  ShieldCheck,
  AlertTriangle,
  Smartphone,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useCRM } from '@/context/CRMContext';
import { useToast } from '@/context/ToastContext';
import { Project, Client } from '@/types/crm';

interface ShareProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  client?: Client;
}

export const ShareProjectModal: React.FC<ShareProjectModalProps> = ({
  isOpen,
  onClose,
  project,
  client,
}) => {
  const {
    generateProjectSharingToken,
    toggleProjectSharing,
    revokeAndRegenerateProjectSharingToken,
  } = useCRM();
  const { success, error: showError } = useToast();

  const [copied, setCopied] = useState(false);
  const [confirmRegenerateOpen, setConfirmRegenerateOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const sharingToken = project.sharing_token;
  const isEnabled = Boolean(project.is_sharing_enabled && sharingToken);
  const origin = window.location.origin;
  const shareableUrl = sharingToken ? `${origin}/track/${sharingToken}` : '';

  const handleEnableSharing = async () => {
    setIsUpdating(true);
    try {
      if (!sharingToken) {
        await generateProjectSharingToken(project.id);
      } else {
        await toggleProjectSharing(project.id, true);
      }
      success('Sharing Enabled', 'Private client tracking link is now active.');
    } catch (err: any) {
      showError('Action Failed', err?.message || 'Could not enable sharing.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDisableSharing = async () => {
    setIsUpdating(true);
    try {
      await toggleProjectSharing(project.id, false);
      success('Sharing Disabled', 'The private tracking link has been disabled.');
    } catch (err: any) {
      showError('Action Failed', err?.message || 'Could not disable sharing.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareableUrl) return;
    try {
      await navigator.clipboard.writeText(shareableUrl);
      setCopied(true);
      success('Link Copied', 'Project tracking link copied to clipboard.');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showError('Copy Failed', 'Please manually select and copy the link.');
    }
  };

  const handleWhatsAppShare = () => {
    if (!shareableUrl) return;
    const clientName = client?.full_name || 'Client';
    const message = `Hello ${clientName}, here is your private project progress tracking link for "${project.project_name}":\n\n${shareableUrl}\n\nTrack real-time photos, execution stages, and updates directly from AKD Interior.`;
    const cleanPhone = client?.phone ? client.phone.replace(/[^0-9]/g, '') : '';
    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  const handleRegenerateLink = async () => {
    setIsUpdating(true);
    try {
      await revokeAndRegenerateProjectSharingToken(project.id);
      setConfirmRegenerateOpen(false);
      success('Link Replaced', 'Old link invalidated. New secure link generated.');
    } catch (err: any) {
      showError('Action Failed', err?.message || 'Could not regenerate link.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Share Project with Client"
        subtitle={`Generate a private, live tracking webpage for ${client?.full_name || 'the client'}`}
        size="lg"
      >
        <div className="space-y-5">
          {/* Status Header Strip */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-slate-200/80 bg-slate-50">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                  }`}
                />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  {isEnabled ? 'Client Portal Active' : 'Client Portal Disabled'}
                </span>
              </div>
              <p className="text-xs text-slate-600">
                {isEnabled
                  ? 'Anyone with this unique link can view client-visible updates without logging in.'
                  : 'Enable this to give the client a private live view of their project progress.'}
              </p>
            </div>

            <div>
              {isEnabled ? (
                <button
                  type="button"
                  onClick={handleDisableSharing}
                  disabled={isUpdating}
                  className="akd-btn-secondary h-8 px-3 text-xs text-rose-600 hover:text-rose-700"
                >
                  Disable Link
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleEnableSharing}
                  disabled={isUpdating}
                  className="akd-btn-primary h-8 px-4 text-xs"
                >
                  Enable Sharing
                </button>
              )}
            </div>
          </div>

          {/* Shareable Link Box */}
          {isEnabled && shareableUrl ? (
            <div className="space-y-4">
              <div>
                <label className="akd-label">Shareable Project Link</label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      readOnly
                      value={shareableUrl}
                      className="akd-input text-xs font-mono pr-8 bg-white select-all"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="akd-btn-primary h-[38px] px-3.5 text-xs inline-flex items-center gap-1.5"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-300" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy Link
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Action Buttons: WhatsApp & Preview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleWhatsAppShare}
                  className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-xs"
                >
                  <Smartphone className="w-4 h-4" /> Share on WhatsApp
                </button>

                <a
                  href={shareableUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="akd-btn-secondary h-10 px-4 text-xs inline-flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4 text-[#5448ED]" /> View Client Page{' '}
                  <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                </a>
              </div>

              {/* Security & Privacy Guarantees */}
              <div className="p-3.5 rounded-lg border border-slate-200/60 bg-white space-y-2 text-xs">
                <div className="flex items-center gap-2 text-slate-900 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  What the Client Sees &amp; Doesn't See
                </div>
                <ul className="space-y-1 text-slate-600 text-[11px] list-disc list-inside">
                  <li>
                    <strong className="text-slate-800">Visible to client:</strong> Current work
                    stage, progress %, milestones, published photographs, and client notes.
                  </li>
                  <li>
                    <strong className="text-slate-800">Strictly hidden:</strong> Internal notes,
                    worker contact numbers, project quotation &amp; financials, vendor payments, and
                    other studio records.
                  </li>
                </ul>
              </div>

              {/* Revoke / Regenerate Action */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Need to revoke previous access?</span>
                <button
                  type="button"
                  onClick={() => setConfirmRegenerateOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-rose-600"
                >
                  <RefreshCw className="w-3 h-3" /> Regenerate Replacement Link
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl space-y-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 mx-auto flex items-center justify-center">
                <Share2 className="w-5 h-5" />
              </div>
              <p className="text-xs text-slate-600 max-w-sm mx-auto">
                Sharing is currently turned off. Click "Enable Sharing" above to activate a secure
                un-guessable portal link for this project.
              </p>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmRegenerateOpen}
        onClose={() => setConfirmRegenerateOpen(false)}
        onConfirm={handleRegenerateLink}
        title="Regenerate Sharing Link?"
        description="This will immediately invalidate any previous link you shared with the client. The client will need the new link to view progress."
        confirmLabel="Regenerate & Invalidate Old"
        variant="danger"
        isLoading={isUpdating}
      />
    </>
  );
};
