import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  IndianRupee,
  MoreHorizontal,
  Plus,
  X,
  MessageSquareMore,
  Receipt,
  BarChart3,
  Settings,
  LogOut,
  UserPlus,
  FolderPlus,
  PlusCircle,
  FileSpreadsheet,
  CalendarCheck,
  Package,
} from 'lucide-react';
import { useCRM } from '@/context/CRMContext';
import { useAuth } from '@/context/AuthContext';

export const SwipeMobileNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { openQuickModal, settings } = useCRM();
  const { signOut, session } = useAuth();

  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);

  const handleLogout = async () => {
    setMoreDrawerOpen(false);
    await signOut();
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Swipe Docked Bottom Navigation Bar (Visible on Mobile & Tablet < 1024px) */}
      <nav
        className="swipe-bottom-nav lg:hidden"
        aria-label="Mobile Navigation"
      >
        {/* Tab 1: Home / Dashboard */}
        <NavLink
          to="/"
          className={`swipe-nav-btn ${isActive('/') ? 'active' : ''}`}
        >
          <div className="swipe-nav-icon-wrap">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <span>Home</span>
        </NavLink>

        {/* Tab 2: Clients */}
        <NavLink
          to="/clients"
          className={`swipe-nav-btn ${isActive('/clients') ? 'active' : ''}`}
        >
          <div className="swipe-nav-icon-wrap">
            <Users className="w-5 h-5" />
          </div>
          <span>Clients</span>
        </NavLink>

        {/* Center Swipe Quick Action FAB Button */}
        <button
          type="button"
          onClick={() => setCreateSheetOpen(true)}
          className="swipe-nav-fab-btn"
          title="Create New"
          aria-label="Create New"
        >
          <Plus className="w-6 h-6 stroke-[2.8]" />
        </button>

        {/* Tab 3: Projects */}
        <NavLink
          to="/projects"
          className={`swipe-nav-btn ${isActive('/projects') ? 'active' : ''}`}
        >
          <div className="swipe-nav-icon-wrap">
            <FolderKanban className="w-5 h-5" />
          </div>
          <span>Projects</span>
        </NavLink>

        {/* Tab 4: Payments / Ledger */}
        <NavLink
          to="/payments"
          className={`swipe-nav-btn ${isActive('/payments') ? 'active' : ''}`}
        >
          <div className="swipe-nav-icon-wrap">
            <IndianRupee className="w-5 h-5" />
          </div>
          <span>Payments</span>
        </NavLink>

        {/* Tab 5: More (Drawer with Enquiries, Expenses, Reports, Settings) */}
        <button
          type="button"
          onClick={() => setMoreDrawerOpen(true)}
          className={`swipe-nav-btn ${
            isActive('/enquiries') ||
            isActive('/attendance') ||
            isActive('/materials') ||
            isActive('/expenses') ||
            isActive('/reports') ||
            isActive('/settings')
              ? 'active'
              : ''
          }`}
          aria-label="More Menu"
        >
          <div className="swipe-nav-icon-wrap">
            <MoreHorizontal className="w-5 h-5" />
          </div>
          <span>More</span>
        </button>
      </nav>

      {/* Swipe Quick Create Bottom Sheet */}
      {createSheetOpen && (
        <div
          className="swipe-bottom-sheet-overlay"
          onClick={() => setCreateSheetOpen(false)}
        >
          <div
            className="swipe-bottom-sheet-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="swipe-sheet-handle" />

            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display">
                  Quick Create
                </h3>
                <p className="text-xs text-slate-500">
                  Select a record to log into {settings.business_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateSheetOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Swipe App Style Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 py-2">
              {/* 1. Add Client */}
              <button
                type="button"
                onClick={() => {
                  setCreateSheetOpen(false);
                  openQuickModal({ type: 'client' });
                }}
                className="swipe-quick-tile group"
              >
                <div className="swipe-quick-icon-box bg-indigo-50 text-[#5448ED] border border-indigo-100 group-hover:bg-[#5448ED] group-hover:text-white transition-colors">
                  <UserPlus className="w-5 h-5" />
                </div>
                <span className="swipe-quick-label">Add Client</span>
              </button>

              {/* 2. New Project */}
              <button
                type="button"
                onClick={() => {
                  setCreateSheetOpen(false);
                  openQuickModal({ type: 'project' });
                }}
                className="swipe-quick-tile group"
              >
                <div className="swipe-quick-icon-box bg-blue-50 text-blue-600 border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <span className="swipe-quick-label">New Project</span>
              </button>

              {/* 3. Record Payment */}
              <button
                type="button"
                onClick={() => {
                  setCreateSheetOpen(false);
                  openQuickModal({ type: 'payment' });
                }}
                className="swipe-quick-tile group"
              >
                <div className="swipe-quick-icon-box bg-emerald-50 text-emerald-600 border border-emerald-100 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <span className="swipe-quick-label">Payment</span>
              </button>

              {/* 4. Record Expense */}
              <button
                type="button"
                onClick={() => {
                  setCreateSheetOpen(false);
                  openQuickModal({ type: 'expense' });
                }}
                className="swipe-quick-tile group"
              >
                <div className="swipe-quick-icon-box bg-rose-50 text-rose-600 border border-rose-100 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                  <Receipt className="w-5 h-5" />
                </div>
                <span className="swipe-quick-label">Expense</span>
              </button>

              {/* 5. Log Enquiry */}
              <button
                type="button"
                onClick={() => {
                  setCreateSheetOpen(false);
                  openQuickModal({ type: 'enquiry' });
                }}
                className="swipe-quick-tile group"
              >
                <div className="swipe-quick-icon-box bg-amber-50 text-amber-600 border border-amber-100 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                  <MessageSquareMore className="w-5 h-5" />
                </div>
                <span className="swipe-quick-label">Log Enquiry</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Swipe More Drawer (Full Quick Drawer for Mobile) */}
      {moreDrawerOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden bg-slate-950/45 backdrop-blur-sm flex justify-end"
          onClick={() => setMoreDrawerOpen(false)}
        >
          <div
            className="w-[290px] max-w-[85vw] bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#5448ED] text-white flex items-center justify-center font-bold text-xs">
                  {session?.user.full_name?.charAt(0).toUpperCase() || 'A'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {session?.user.full_name || 'Studio Owner'}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {settings.business_name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMoreDrawerOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Menu Sections */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              <div>
                <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Operations &amp; Leads
                </p>
                <div className="space-y-1 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMoreDrawerOpen(false);
                      navigate('/enquiries');
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                      isActive('/enquiries')
                        ? 'bg-[#EEF2FF] text-[#5448ED]'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <MessageSquareMore className="w-4 h-4 text-amber-600" />
                    <span>Enquiries &amp; Leads</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMoreDrawerOpen(false);
                      navigate('/attendance');
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                      isActive('/attendance')
                        ? 'bg-[#EEF2FF] text-[#5448ED]'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <CalendarCheck className="w-4 h-4 text-emerald-600" />
                    <span>Team &amp; Attendance</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMoreDrawerOpen(false);
                      navigate('/materials');
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                      isActive('/materials')
                        ? 'bg-[#EEF2FF] text-[#5448ED]'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Package className="w-4 h-4 text-indigo-600" />
                    <span>Materials &amp; Stock</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMoreDrawerOpen(false);
                      navigate('/expenses');
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                      isActive('/expenses')
                        ? 'bg-[#EEF2FF] text-[#5448ED]'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Receipt className="w-4 h-4 text-rose-600" />
                    <span>Expenses &amp; Bills</span>
                  </button>
                </div>
              </div>

              <div>
                <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Analytics &amp; System
                </p>
                <div className="space-y-1 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMoreDrawerOpen(false);
                      navigate('/reports');
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                      isActive('/reports')
                        ? 'bg-[#EEF2FF] text-[#5448ED]'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4 text-violet-600" />
                    <span>Reports &amp; Analytics</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMoreDrawerOpen(false);
                      navigate('/settings');
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                      isActive('/settings')
                        ? 'bg-[#EEF2FF] text-[#5448ED]'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Settings className="w-4 h-4 text-slate-600" />
                    <span>Studio Settings</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Logout Footer */}
            <div className="p-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 h-10 px-3 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
