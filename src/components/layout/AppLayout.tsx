import React, { useState, useMemo, useRef, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  MessageSquareMore,
  IndianRupee,
  Receipt,
  BarChart3,
  Settings,
  Menu,
  X,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  ChevronDown,
  LayoutGrid,
  HelpCircle,
  Sparkles,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { useAuth } from '@/context/AuthContext';
import { useCRM } from '@/context/CRMContext';
import { GlobalModalHost } from '@/components/modals/GlobalModalHost';
import { SwipeMobileNav } from '@/components/layout/SwipeMobileNav';
import { formatINR } from '@/lib/formatters';

interface NavSectionItem {
  label: string;
  path: string;
  icon: React.FC<{ className?: string }>;
  section: 'main' | 'data' | 'financials' | 'system';
}

const PRIMARY_NAV_ITEMS: NavSectionItem[] = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard, section: 'main' },
  { label: 'Clients', path: '/clients', icon: Users, section: 'data' },
  { label: 'Projects', path: '/projects', icon: FolderKanban, section: 'data' },
  { label: 'Enquiries', path: '/enquiries', icon: MessageSquareMore, section: 'data' },
  { label: 'Payments', path: '/payments', icon: IndianRupee, section: 'financials' },
  { label: 'Expenses', path: '/expenses', icon: Receipt, section: 'financials' },
  { label: 'Reports & Analytics', path: '/reports', icon: BarChart3, section: 'financials' },
  { label: 'Settings', path: '/settings', icon: Settings, section: 'system' },
];

export const AppLayout: React.FC = () => {
  const { session, signOut } = useAuth();
  const {
    settings,
    clients,
    projects,
    enquiries,
    payments,
    openQuickModal,
  } = useCRM();
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const quickCreateRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setSearchOpen(false);
    setQuickCreateOpen(false);
    setProfileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setSearchOpen(false);
      }
      if (
        quickCreateRef.current &&
        !quickCreateRef.current.contains(e.target as Node)
      ) {
        setQuickCreateOpen(false);
      }
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(e.target as Node)
      ) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global search results across Clients, Projects, Enquiries, Payments
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;

    const matchedClients = clients
      .filter(
        (c) =>
          c.full_name.toLowerCase().includes(q) ||
          c.client_code.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          (c.email && c.email.toLowerCase().includes(q))
      )
      .slice(0, 4);

    const matchedProjects = projects
      .filter(
        (p) =>
          p.project_name.toLowerCase().includes(q) ||
          p.project_code.toLowerCase().includes(q) ||
          p.property_location.toLowerCase().includes(q)
      )
      .slice(0, 4);

    const matchedEnquiries = enquiries
      .filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.enquiry_code.toLowerCase().includes(q) ||
          e.phone.toLowerCase().includes(q)
      )
      .slice(0, 3);

    const matchedPayments = payments
      .filter(
        (p) =>
          p.receipt_number.toLowerCase().includes(q) ||
          p.payment_code.toLowerCase().includes(q) ||
          (p.transaction_reference && p.transaction_reference.toLowerCase().includes(q))
      )
      .slice(0, 3);

    const total =
      matchedClients.length +
      matchedProjects.length +
      matchedEnquiries.length +
      matchedPayments.length;

    return {
      total,
      matchedClients,
      matchedProjects,
      matchedEnquiries,
      matchedPayments,
    };
  }, [searchQuery, clients, projects, enquiries, payments]);

  const currentSectionTitle = useMemo(() => {
    if (location.pathname === '/') return 'Dashboard';
    if (location.pathname.startsWith('/clients/')) return 'Client Profile';
    if (location.pathname.startsWith('/projects/')) return 'Project Details';
    const found = PRIMARY_NAV_ITEMS.find(
      (item) => item.path !== '/' && location.pathname.startsWith(item.path)
    );
    return found?.label || 'Studio Management';
  }, [location.pathname]);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col lg:flex-row overflow-x-hidden font-sans">
      {/* Desktop Left Sidebar (Mixpanel / Linear UI Aesthetic) */}
      <aside
        className={`hidden lg:flex flex-col fixed inset-y-0 left-0 z-30 bg-white border-r border-slate-200/90 transition-all duration-200 ${
          collapsed ? 'w-[72px]' : 'w-[252px]'
        }`}
      >
        {/* Workspace Selector Header (Matches Mixpanel Header) */}
        <div
          className={`h-[60px] border-b border-slate-200/80 flex items-center shrink-0 ${
            collapsed ? 'justify-center px-2 py-3' : 'justify-between px-4 py-3'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <BrandLogo
              logoUrl={settings.logo_url}
              collapsed={collapsed}
              size="sm"
            />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold text-slate-900 truncate">
                    {settings.business_name}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </div>
                <span className="text-[10px] text-slate-600 font-medium block truncate">
                  Studio Workspace
                </span>
              </div>
            )}
          </div>

          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sidebar Action & Navigation */}
        <div className="flex-1 flex flex-col overflow-y-auto px-3 py-3 space-y-4">
          {/* Mixpanel-style "+ Create New" Prominent Button */}
          <div className="relative" ref={quickCreateRef}>
            {collapsed ? (
              <button
                type="button"
                onClick={() => setQuickCreateOpen((prev) => !prev)}
                className="w-10 h-10 mx-auto rounded-lg bg-[#5448ED] hover:bg-[#4338CA] text-white flex items-center justify-center shadow-sm shadow-[#5448ED]/30 transition-all"
                title="Create New..."
              >
                <Plus className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setQuickCreateOpen((prev) => !prev)}
                className="w-full h-10 px-3 bg-[#5448ED] hover:bg-[#4338CA] text-white text-xs font-semibold rounded-lg flex items-center justify-between shadow-sm shadow-[#5448ED]/25 transition-all group"
              >
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Create New</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-white/80 group-hover:text-white transition-transform" />
              </button>
            )}

            {/* Quick Action Popup Menu */}
            {quickCreateOpen && (
              <div
                className={`absolute mt-1.5 w-52 bg-white border border-slate-200 rounded-xl shadow-dropdown py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 ${
                  collapsed ? 'left-12 top-0' : 'left-0 right-0'
                }`}
              >
                <div className="px-3 py-1 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                  Quick Actions
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setQuickCreateOpen(false);
                    openQuickModal({ type: 'client' });
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                >
                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Add Client</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQuickCreateOpen(false);
                    openQuickModal({ type: 'enquiry' });
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                >
                  <MessageSquareMore className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Log Enquiry</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQuickCreateOpen(false);
                    openQuickModal({ type: 'project' });
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                >
                  <FolderKanban className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Create Project</span>
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  onClick={() => {
                    setQuickCreateOpen(false);
                    openQuickModal({ type: 'payment' });
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                >
                  <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Record Payment</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQuickCreateOpen(false);
                    openQuickModal({ type: 'expense' });
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                >
                  <Receipt className="w-3.5 h-3.5 text-amber-600" />
                  <span>Record Expense</span>
                </button>
              </div>
            )}
          </div>

          {/* Quick Search Shortcut in Sidebar */}
          {!collapsed && (
            <div
              onClick={() => {
                searchInputRef.current?.focus();
                setSearchOpen(true);
              }}
              className="h-[34px] px-2.5 rounded-lg border border-slate-200/90 bg-slate-50/60 hover:bg-slate-50 hover:border-slate-300 flex items-center justify-between text-xs text-slate-600 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <span>Search</span>
              </div>
              <span className="text-[10px] font-mono text-slate-600 bg-white border border-slate-200 rounded px-1.5 py-0.5">
                ⌘K
              </span>
            </div>
          )}

          {/* Navigation Links Grouped Mixpanel-style */}
          <nav className="space-y-4 pt-1" aria-label="Main Navigation">
            {/* Overview / Home */}
            <div className="space-y-1">
              {PRIMARY_NAV_ITEMS.filter((i) => i.section === 'main').map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === '/';
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    title={collapsed ? item.label : undefined}
                    className={`group flex items-center ${
                      collapsed ? 'justify-center px-2' : 'px-3'
                    } h-9 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive
                          ? 'text-[#5448ED]'
                          : 'text-slate-500 group-hover:text-slate-700'
                      }`}
                    />
                    {!collapsed && <span className="ml-2.5 truncate">{item.label}</span>}
                  </NavLink>
                );
              })}
            </div>

            {/* Studio Data Section */}
            <div className="space-y-1">
              {!collapsed && (
                <div className="px-3 py-1 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                  Data &amp; Operations
                </div>
              )}
              {PRIMARY_NAV_ITEMS.filter((i) => i.section === 'data').map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    title={collapsed ? item.label : undefined}
                    className={`group flex items-center ${
                      collapsed ? 'justify-center px-2' : 'px-3'
                    } h-9 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive
                          ? 'text-[#5448ED]'
                          : 'text-slate-500 group-hover:text-slate-700'
                      }`}
                    />
                    {!collapsed && <span className="ml-2.5 truncate">{item.label}</span>}
                  </NavLink>
                );
              })}
            </div>

            {/* Financials Section */}
            <div className="space-y-1">
              {!collapsed && (
                <div className="px-3 py-1 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                  Financials &amp; Reports
                </div>
              )}
              {PRIMARY_NAV_ITEMS.filter((i) => i.section === 'financials').map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    title={collapsed ? item.label : undefined}
                    className={`group flex items-center ${
                      collapsed ? 'justify-center px-2' : 'px-3'
                    } h-9 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive
                          ? 'text-[#5448ED]'
                          : 'text-slate-500 group-hover:text-slate-700'
                      }`}
                    />
                    {!collapsed && <span className="ml-2.5 truncate">{item.label}</span>}
                  </NavLink>
                );
              })}
            </div>

            {/* System Section */}
            <div className="space-y-1">
              {!collapsed && (
                <div className="px-3 py-1 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                  System
                </div>
              )}
              {PRIMARY_NAV_ITEMS.filter((i) => i.section === 'system').map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    title={collapsed ? item.label : undefined}
                    className={`group flex items-center ${
                      collapsed ? 'justify-center px-2' : 'px-3'
                    } h-9 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive
                          ? 'text-[#5448ED]'
                          : 'text-slate-500 group-hover:text-slate-700'
                      }`}
                    />
                    {!collapsed && <span className="ml-2.5 truncate">{item.label}</span>}
                  </NavLink>
                );
              })}
            </div>
          </nav>
        </div>

        {/* Sidebar Footer (Mixpanel Bottom Dock) */}
        <div className="p-3 border-t border-slate-200/80 bg-white shrink-0 space-y-2">
          {collapsed ? (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="w-full h-[34px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <>
              {/* Studio Status Pill (Matches Mixpanel Upgrade / Status Banner) */}
              <div className="p-2 rounded-lg bg-amber-50/80 border border-amber-200/70 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
                    <Sparkles className="w-3 h-3 text-amber-600" />
                  </div>
                  <div className="min-w-0 leading-tight">
                    <p className="text-[11px] font-semibold text-slate-900 truncate">
                      AKD Studio Pro
                    </p>
                    <p className="text-[10px] text-slate-600 truncate">
                      Private System Active
                    </p>
                  </div>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="System Online" />
              </div>

              {/* Bottom Icon Utility Strip */}
              <div className="flex items-center justify-between px-1 pt-1 text-slate-400">
                <button
                  type="button"
                  onClick={() => navigate('/reports')}
                  className="p-1.5 rounded-md hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  title="Analytics &amp; Metrics"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/settings')}
                  className="p-1.5 rounded-md hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  title="Studio Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  className="p-1.5 rounded-md hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  title="Collapse Sidebar"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Mobile Slide-Over Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px]"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-[275px] max-w-[85vw] bg-white h-full border-r border-slate-200 flex flex-col">
            <div className="h-[60px] px-4 border-b border-slate-200 flex items-center justify-between">
              <BrandLogo logoUrl={settings.logo_url} size="sm" />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                aria-label="Close navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
              {PRIMARY_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.path === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(item.path);

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={`flex items-center px-3.5 h-10 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 mr-3 ${
                        isActive ? 'text-[#5448ED]' : 'text-slate-500'
                      }`}
                    />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            <div className="p-4 border-t border-slate-200">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full akd-btn-secondary h-9 text-xs justify-center"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area Wrapper */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
          collapsed ? 'lg:pl-[72px]' : 'lg:pl-[252px]'
        }`}
      >
        {/* Modern Top Header (Mixpanel Breadcrumbs & Action Bar) */}
        <header className="sticky top-0 z-20 h-[60px] bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 -ml-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb Hierarchy */}
            <div className="flex items-center gap-2 text-xs min-w-0">
              <span className="text-slate-600 font-medium hidden sm:inline">
                {settings.business_name}
              </span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <span className="font-semibold text-slate-900 font-display truncate">
                {currentSectionTitle}
              </span>
            </div>
          </div>

          {/* Right Controls: Global Search, Quick Action, Owner Profile */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Global Search Bar */}
            <div ref={searchContainerRef} className="relative">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onFocus={() => setSearchOpen(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  placeholder="Search clients, projects, receipts..."
                  className="h-[34px] pl-8 pr-12 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[#5448ED] focus:ring-2 focus:ring-[#5448ED]/15 w-36 sm:w-64 transition-all"
                />
                <span className="hidden sm:inline-block absolute right-2 text-[10px] font-mono text-slate-400 border border-slate-200 bg-white rounded px-1">
                  ⌘K
                </span>
              </div>

              {/* Search Dropdown Results */}
              {searchOpen && searchQuery.trim().length > 0 && searchResults && (
                <div className="absolute right-0 mt-1.5 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-dropdown overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
                  {searchResults.total === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      No matching records found for &ldquo;{searchQuery}&rdquo;
                    </div>
                  ) : (
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                      {searchResults.matchedClients.length > 0 && (
                        <div className="p-2">
                          <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Clients
                          </p>
                          {searchResults.matchedClients.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setSearchOpen(false);
                                setSearchQuery('');
                                navigate(`/clients/${c.id}`);
                              }}
                              className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-50 flex items-center justify-between text-xs transition-colors"
                            >
                              <span className="font-medium text-slate-900 truncate">
                                {c.full_name}
                              </span>
                              <span className="text-[11px] text-slate-400 shrink-0 ml-2">
                                {c.client_code} • {c.phone}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {searchResults.matchedProjects.length > 0 && (
                        <div className="p-2">
                          <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Projects
                          </p>
                          {searchResults.matchedProjects.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setSearchOpen(false);
                                setSearchQuery('');
                                navigate(`/projects/${p.id}`);
                              }}
                              className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-50 flex items-center justify-between text-xs transition-colors"
                            >
                              <span className="font-medium text-slate-900 truncate">
                                {p.project_name}
                              </span>
                              <span className="text-[11px] text-slate-400 shrink-0 ml-2">
                                {p.project_code} • {p.status}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {searchResults.matchedEnquiries.length > 0 && (
                        <div className="p-2">
                          <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Enquiries
                          </p>
                          {searchResults.matchedEnquiries.map((e) => (
                            <button
                              key={e.id}
                              type="button"
                              onClick={() => {
                                setSearchOpen(false);
                                setSearchQuery('');
                                navigate(`/enquiries`);
                              }}
                              className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-50 flex items-center justify-between text-xs transition-colors"
                            >
                              <span className="font-medium text-slate-900 truncate">
                                {e.name}
                              </span>
                              <span className="text-[11px] text-slate-400 shrink-0 ml-2">
                                {e.enquiry_code} • {e.status}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {searchResults.matchedPayments.length > 0 && (
                        <div className="p-2">
                          <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Payments
                          </p>
                          {searchResults.matchedPayments.map((pay) => (
                            <button
                              key={pay.id}
                              type="button"
                              onClick={() => {
                                setSearchOpen(false);
                                setSearchQuery('');
                                navigate(`/payments`);
                              }}
                              className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-50 flex items-center justify-between text-xs transition-colors"
                            >
                              <span className="font-medium text-slate-900 truncate">
                                {pay.receipt_number}
                              </span>
                              <span className="text-[11px] font-semibold text-emerald-600 tabular-nums shrink-0 ml-2">
                                {formatINR(pay.amount)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Header Action Button (Desktop) */}
            <button
              type="button"
              onClick={() => openQuickModal({ type: 'payment' })}
              className="hidden md:inline-flex items-center gap-1.5 h-[34px] px-3 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition-colors"
            >
              <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
              <span>Record Payment</span>
            </button>

            {/* Owner Profile Menu */}
            <div ref={profileMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setProfileMenuOpen((prev) => !prev)}
                className="h-[34px] px-2 rounded-lg border border-slate-200/90 bg-white hover:bg-slate-50 flex items-center gap-2 transition-colors shadow-xs"
                aria-label="Owner account menu"
              >
                <div className="w-[22px] h-[22px] rounded-md bg-[#5448ED] text-white flex items-center justify-center text-[10px] font-bold">
                  {session?.user.full_name?.charAt(0).toUpperCase() || 'A'}
                </div>
                <span className="hidden md:inline text-xs font-semibold text-slate-800 max-w-[120px] truncate">
                  {session?.user.full_name || 'Studio Owner'}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-56 bg-white border border-slate-200 rounded-xl shadow-dropdown py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3.5 py-2 border-b border-slate-100">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {session?.user.full_name}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {session?.user.email}
                    </p>
                    <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/80 rounded-md">
                      Authorized Studio Owner
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      navigate('/settings');
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                  >
                    <User className="w-3.5 h-3.5 text-slate-500" /> Studio &amp; Account Settings
                  </button>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left px-3.5 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content Outlet */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto swipe-mobile-padding-bottom">
          <Outlet />
        </main>
      </div>

      {/* Swipe Mobile & Tablet Navigation Bar */}
      <SwipeMobileNav />

      {/* Global Quick Action Modals */}
      <GlobalModalHost />
    </div>
  );
};
