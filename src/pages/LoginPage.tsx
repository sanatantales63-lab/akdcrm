import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, ShieldCheck, KeyRound, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { isSupabaseConfigured } from '@/lib/supabase';

export const LoginPage: React.FC = () => {
  const {
    session,
    isLoading,
    isOwnerProvisioned,
    signIn,
    provisionInitialOwner,
    requestPasswordReset,
  } = useAuth();
  const { success, error: showError } = useToast();
  const navigate = useNavigate();

  const [view, setView] = useState<'login' | 'provision' | 'forgot'>(() =>
    isOwnerProvisioned ? 'login' : 'provision'
  );

  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Initial Owner Provisioning State (One-time setup when no owner exists yet)
  const [provName, setProvName] = useState('AKD Studio Principal');
  const [provEmail, setProvEmail] = useState('owner@akdstudio.com');
  const [provPassword, setProvPassword] = useState('');
  const [provConfirmPassword, setProvConfirmPassword] = useState('');
  const [provRecoveryKey, setProvRecoveryKey] = useState('AKD-2026-OWNER');

  // Password Reset State
  const [resetEmail, setResetEmail] = useState('');
  const [resetRecoveryKey, setResetRecoveryKey] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  if (!isLoading && session) {
    return <Navigate to="/" replace />;
  }

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!email.trim() || !password) {
      setAuthError('Please enter your owner email address and password.');
      return;
    }

    setSubmitting(true);
    try {
      await signIn(email, password);
      success('Welcome back', 'Authenticated as AKD Interior Studio Owner.');
      navigate('/', { replace: true });
    } catch (err: any) {
      setAuthError(err?.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProvisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (provPassword.length < 8) {
      setAuthError('Password must be at least 8 characters long.');
      return;
    }
    if (provPassword !== provConfirmPassword) {
      setAuthError('Passwords do not match.');
      return;
    }
    if (provRecoveryKey.trim().length < 6) {
      setAuthError('Recovery security key must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await provisionInitialOwner({
        fullName: provName,
        email: provEmail,
        password: provPassword,
        recoveryKey: provRecoveryKey,
      });
      success(
        'Owner Account Provisioned',
        'Your private studio owner account is now active and locked to your credentials.'
      );
      navigate('/', { replace: true });
    } catch (err: any) {
      setAuthError(err?.message || 'Could not provision owner account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setResetMessage(null);

    setSubmitting(true);
    try {
      const res = await requestPasswordReset({
        email: resetEmail,
        recoveryKey: resetRecoveryKey,
        newPassword: resetNewPassword,
      });
      setResetMessage(res.message);
      showError === undefined ? null : success('Password Reset', res.message);
      if (!isSupabaseConfigured) {
        setTimeout(() => {
          setEmail(resetEmail);
          setPassword('');
          setView('login');
        }, 1500);
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Password reset failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col lg:flex-row">
      {/* Left Architectural Brand Column */}
      <div className="hidden lg:flex lg:w-[46%] bg-slate-950 border-r border-slate-800/60 p-12 flex-col justify-between relative overflow-hidden text-white">
        {/* Modern SaaS Grid & Ambient Glow */}
        <div
          className="absolute inset-0 opacity-[0.15] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(to right, #334155 1px, transparent 1px), linear-gradient(to bottom, #334155 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="absolute top-0 left-0 w-96 h-96 bg-brand-primary/20 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none translate-x-1/3 translate-y-1/3" />

        <div className="relative z-10 flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 p-2 flex items-center justify-center shadow-md">
            <img
              src="/logo.png"
              alt="AKD All Kind Decor Logo"
              className="w-full h-full object-contain brightness-110"
            />
          </div>
          <div>
            <span className="font-display font-bold text-base tracking-tight text-white block">
              AKD INTERIOR
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-400">
              All Kind Decor • Kharagpur
            </span>
          </div>
        </div>

        <div className="relative z-10 max-w-md space-y-6 my-auto py-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[11px] font-semibold text-indigo-300">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            Private Studio Management System
          </div>

          <h1 className="font-display text-3xl font-bold text-white tracking-tight leading-[1.2]">
            Architectural precision for your studio operations &amp; finances.
          </h1>

          <p className="text-sm text-slate-400 leading-relaxed">
            Exclusively built for AKD Interior to manage residential &amp; commercial clients,
            turnkey projects, prospective enquiries, milestone collections, and studio expenditure.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800/80">
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
              <p className="text-xs font-semibold text-slate-200">Turnkey Project Control</p>
              <p className="text-xs text-slate-400 mt-1">
                Track progress, site schedules, and receivable balances.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
              <p className="text-xs font-semibold text-slate-200">Verified Financial Ledger</p>
              <p className="text-xs text-slate-400 mt-1">
                Instant PDF payment receipts &amp; structured Excel reports.
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-slate-500 pt-4 border-t border-slate-800/80">
          <span>www.akdinterior.in</span>
          <span className="flex items-center gap-1.5 font-medium text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Owner-Only Access
          </span>
        </div>
      </div>

      {/* Right Authentication Form Area */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-20 bg-[#F8FAFC]">
        <div className="w-full max-w-md mx-auto bg-white p-8 sm:p-10 rounded-2xl border border-slate-200/80 shadow-card">
          {/* Mobile Brand Header */}
          <div className="flex flex-col items-center text-center mb-8 lg:items-start lg:text-left">
            <div className="w-14 h-14 rounded-xl bg-slate-950 border border-slate-800 p-2 flex items-center justify-center shadow-md mb-4 lg:hidden">
              <img
                src="/logo.png"
                alt="AKD Interior Logo"
                className="w-full h-full object-contain brightness-110"
              />
            </div>

            {view === 'provision' && !isOwnerProvisioned ? (
              <>
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-primary">
                  First-Run Security Provisioning
                </span>
                <h2 className="text-2xl font-bold text-slate-900 font-display mt-1 tracking-tight">
                  Provision Studio Owner Account
                </h2>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Configure your private owner credentials. Public sign-up is permanently disabled
                  once your owner account is initialized.
                </p>
              </>
            ) : view === 'forgot' ? (
              <>
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-primary">
                  Account Recovery
                </span>
                <h2 className="text-2xl font-bold text-slate-900 font-display mt-1 tracking-tight">
                  Reset Owner Password
                </h2>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  {isSupabaseConfigured
                    ? 'Enter your registered owner email to receive a password reset link.'
                    : 'Verify your registered owner email and Recovery Security Key to set a new password.'}
                </p>
              </>
            ) : (
              <>
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-primary">
                  AKD All Kind Decor • Private Portal
                </span>
                <h2 className="text-2xl font-bold text-slate-900 font-display mt-1 tracking-tight">
                  Sign in to Studio CRM
                </h2>
                <p className="text-xs text-slate-500 mt-1.5">
                  Enter your authorized owner credentials to access business records.
                </p>
              </>
            )}
          </div>

          {authError && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
              {authError}
            </div>
          )}

          {resetMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{resetMessage}</span>
            </div>
          )}

          {/* VIEW 1: INITIAL OWNER PROVISIONING */}
          {view === 'provision' && !isOwnerProvisioned && (
            <form onSubmit={handleProvisionSubmit} className="space-y-4">
              <div>
                <label htmlFor="prov-name" className="akd-label">
                  Owner / Principal Name
                </label>
                <input
                  id="prov-name"
                  type="text"
                  required
                  value={provName}
                  onChange={(e) => setProvName(e.target.value)}
                  className="akd-input"
                />
              </div>

              <div>
                <label htmlFor="prov-email" className="akd-label">
                  Owner Email Address
                </label>
                <input
                  id="prov-email"
                  type="email"
                  required
                  value={provEmail}
                  onChange={(e) => setProvEmail(e.target.value)}
                  className="akd-input"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="prov-password" className="akd-label">
                    Create Strong Password
                  </label>
                  <div className="relative">
                    <input
                      id="prov-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      placeholder="Min. 8 characters"
                      value={provPassword}
                      onChange={(e) => setProvPassword(e.target.value)}
                      className="akd-input pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="prov-confirm" className="akd-label">
                    Confirm Password
                  </label>
                  <input
                    id="prov-confirm"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    placeholder="Repeat password"
                    value={provConfirmPassword}
                    onChange={(e) => setProvConfirmPassword(e.target.value)}
                    className="akd-input"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="prov-recovery" className="akd-label">
                  Owner Recovery Security Key (For Password Reset)
                </label>
                <input
                  id="prov-recovery"
                  type="text"
                  required
                  value={provRecoveryKey}
                  onChange={(e) => setProvRecoveryKey(e.target.value)}
                  className="akd-input font-mono uppercase"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Save this key securely. It is required if you ever need to reset your password.
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full akd-btn-primary h-10 mt-2"
              >
                <Lock className="w-4 h-4" />
                {submitting ? 'Provisioning Owner Vault...' : 'Provision Owner Account & Enter CRM'}
              </button>
            </form>
          )}

          {/* VIEW 2: OWNER SIGN IN */}
          {(view === 'login' || (view === 'provision' && isOwnerProvisioned)) && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="akd-label">
                  Owner Email Address
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="owner@akdstudio.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="akd-input"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="login-password" className="text-xs font-medium text-slate-800">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthError(null);
                      setResetEmail(email);
                      setView('forgot');
                    }}
                    className="text-xs font-semibold text-brand-primary hover:text-brand-primary-hover hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    placeholder="Enter owner password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="akd-input pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full akd-btn-primary h-10 mt-2"
              >
                <Lock className="w-4 h-4" />
                {submitting ? 'Authenticating...' : 'Sign In to AKD CRM'}
              </button>
            </form>
          )}

          {/* VIEW 3: FORGOT PASSWORD / RECOVERY */}
          {view === 'forgot' && (
            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div>
                <label htmlFor="reset-email" className="akd-label">
                  Registered Owner Email
                </label>
                <input
                  id="reset-email"
                  type="email"
                  required
                  placeholder="owner@akdstudio.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="akd-input"
                />
              </div>

              {!isSupabaseConfigured && (
                <>
                  <div>
                    <label htmlFor="reset-key" className="akd-label">
                      Owner Recovery Security Key
                    </label>
                    <input
                      id="reset-key"
                      type="text"
                      required
                      placeholder="e.g., AKD-2026-OWNER"
                      value={resetRecoveryKey}
                      onChange={(e) => setResetRecoveryKey(e.target.value)}
                      className="akd-input font-mono uppercase"
                    />
                  </div>

                  <div>
                    <label htmlFor="reset-new-password" className="akd-label">
                      New Owner Password
                    </label>
                    <input
                      id="reset-new-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      placeholder="Minimum 8 characters"
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                      className="akd-input"
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full akd-btn-primary h-10"
              >
                <KeyRound className="w-4 h-4" />
                {submitting
                  ? 'Processing...'
                  : isSupabaseConfigured
                    ? 'Send Password Reset Link'
                    : 'Verify & Reset Owner Password'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthError(null);
                  setResetMessage(null);
                  setView('login');
                }}
                className="w-full akd-btn-secondary h-9 text-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
              </button>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>Restricted Owner Portal • No Public Sign-Up</span>
            <span className="font-medium text-slate-700">AKD Interior</span>
          </div>
        </div>
      </div>
    </div>
  );
};
