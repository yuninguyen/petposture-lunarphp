import { ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { logout } from '@/lib/auth';
import { useBranding } from '@/context/BrandingContext';
import { getVisibleNavigation } from '@/navigation/adminNavigation';
import { MobileAdminNav } from '@/components/navigation/MobileAdminNav';
import { humanizeRole } from '@/lib/humanizeRole';
import { NotificationBell } from '@/features/system-notifications/NotificationBell';

export function AppShell({ children, userName, userRoles, userAbilities = [] }: { children: ReactNode; userName: string; userRoles: string[]; userAbilities?: string[] }) {
  const { t, i18n } = useTranslation();
  const branding = useBranding();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [expandedNavGroups, setExpandedNavGroups] = useState<Record<string, boolean>>({
    dashboard: true,
    sales: true,
    content: true,
    catalogue: true,
    finance: true,
    affiliate: true,
    system: true,
  });

  const visibleNavGroups = getVisibleNavigation(userRoles, userAbilities);

  const activeNavGroupKey = visibleNavGroups.find((group) => (
    group.items.some((item) => (
      location.pathname === item.path
      || location.pathname.startsWith(`${item.path}/`)
      || item.children?.some((child) => (
        location.pathname === child.path || location.pathname.startsWith(`${child.path}/`)
      ))
    ))
  ))?.key;

  useEffect(() => {
    if (!activeNavGroupKey) return;

    setExpandedNavGroups((current) => (
      current[activeNavGroupKey]
        ? current
        : { ...current, [activeNavGroupKey]: true }
    ));
  }, [activeNavGroupKey]);

  // Close mobile drawer on route / location change
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname, location.search]);

  // Close mobile drawer on resize across md breakpoint (>= 768px)
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    const handleMediaChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        setMobileNavOpen(false);
      }
    };
    if (mql.matches) {
      setMobileNavOpen(false);
    }
    if (mql.addEventListener) {
      mql.addEventListener('change', handleMediaChange);
      return () => mql.removeEventListener('change', handleMediaChange);
    } else {
      mql.addListener(handleMediaChange);
      return () => mql.removeListener(handleMediaChange);
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="min-h-screen flex bg-slate-50 overflow-hidden">
      {/* Mobile Navigation Drawer */}
      <MobileAdminNav
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        groups={visibleNavGroups}
        userName={userName}
        triggerRef={hamburgerRef}
      />
      
      {/* Full-height Dark Sidebar */}
      <aside className="w-60 bg-[#1e293b] flex flex-col hidden md:flex z-40 flex-shrink-0 border-r border-[#0f172a]">
        
        {/* Logo Area */}
        <div className="h-16 flex items-center px-6 flex-shrink-0 border-b border-white/5">
          <img src={branding.logoUrl} alt="Logo" className="h-9 w-auto object-contain" />
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 py-6 flex flex-col gap-6 overflow-y-auto px-3">
          {visibleNavGroups.map((group) => {
            const groupKey = group.key;
            const expanded = expandedNavGroups[groupKey] ?? true;
            const groupTitle = t(group.titleKey, group.fallbackTitle);

            return (
              <div key={groupKey} className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => setExpandedNavGroups((current) => ({
                    ...current,
                    [groupKey]: !expanded,
                  }))}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300"
                  aria-expanded={expanded}
                  aria-label={t(expanded ? 'sidebar.collapse_group' : 'sidebar.expand_group', { group: groupTitle })}
                >
                  <span className="text-xs font-semibold uppercase tracking-wider">{groupTitle}</span>
                  <span className={`text-sm transition-transform ${expanded ? 'rotate-90' : ''}`}>›</span>
                </button>
                {expanded && group.items.map((item) => (
                  <div key={item.path}>
                    <NavLink
                      to={item.path}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                          isActive
                            ? 'bg-white/10 text-white shadow-sm'
                            : 'text-slate-400 hover:bg-white/5 hover:text-white'
                        }`
                      }
                    >
                      {item.icon}
                      {t(item.labelKey, item.fallbackLabel)}
                    </NavLink>
                    {item.children && (
                      <div className="ml-4 mt-1 border-l border-white/10 pl-2">
                        {item.children.map((child) => (
                          <NavLink
                            key={child.path}
                            to={child.path}
                            className={({ isActive }) =>
                              `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                                isActive
                                  ? 'bg-white/10 text-white shadow-sm'
                                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
                              }`
                            }
                          >
                            {child.icon}
                            {t(child.labelKey, child.fallbackLabel)}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </nav>

        {/* Bottom Sidebar Footer */}
        <div className="p-4 mt-auto border-t border-white/5">
          <div className="bg-white/5 rounded-xl p-3 flex items-center gap-3">
             <div className="h-8 w-8 rounded-full bg-secondary flex flex-shrink-0 items-center justify-center shadow-sm">
              <span className="text-sm font-bold text-white">
                {userName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate leading-tight">{userName}</p>
              <p className="text-xs text-slate-400 truncate">Admin</p>
            </div>
            <button 
              onClick={() => logout().then(() => window.location.reload())}
              className="text-slate-400 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-white/10 flex-shrink-0"
              title={t('auth.logout')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* White Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 flex-shrink-0 shadow-sm">
          {/* Mobile hamburger & branding */}
          <div className="flex items-center gap-3 md:hidden">
            <button
              ref={hamburgerRef}
              type="button"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              className="p-2 -ml-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              aria-label={t('navigation.open', 'Open navigation')}
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-admin-drawer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <img src={branding.logoUrl} alt="Logo" className="h-8 w-auto object-contain" />
          </div>

          <div className="flex items-center gap-4 sm:gap-6 ml-auto">
            {/* Notification Bell */}
            <NotificationBell />

            {/* Language Selector */}
            <div className="relative">
              <select
                value={i18n.language}
                onChange={(e) => i18n.changeLanguage(e.target.value)}
                className="appearance-none bg-white border border-slate-200 text-slate-600 text-sm font-medium rounded-lg pl-3 pr-8 py-1.5 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer shadow-sm"
              >
                <option value="vi">VI</option>
                <option value="en">EN</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            <div className="h-5 w-px bg-slate-200 hidden sm:block"></div>

            {/* User Profile Menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
                className="flex items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                  <span className="text-sm font-bold text-primary">
                    {userName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-sm font-medium text-slate-700 hidden md:block">{userName}</span>
                <svg className={`h-4 w-4 text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 bg-white py-1 shadow-lg z-50">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-900 truncate">{userName}</p>
                    <p className="text-xs text-slate-500 truncate">{userRoles.map(humanizeRole).join(', ')}</p>
                  </div>
                  <Link
                    to="/profile"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>{t('nav.profile', 'Profile')}</span>
                  </Link>
                  <div className="border-t border-slate-100 my-1" />
                  <button
                    type="button"
                    onClick={() => logout().then(() => window.location.reload())}
                    className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>{t('auth.logout', 'Logout')}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Quick Logout Button */}
            <button 
              onClick={() => logout().then(() => window.location.reload())} 
              className="flex items-center gap-2 text-slate-500 hover:text-red-600 transition-colors p-2 rounded-lg hover:bg-red-50"
              title={t('auth.logout')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="text-sm font-medium hidden sm:block">{t('auth.logout')}</span>
            </button>
          </div>
        </header>
        
        {/* Main Scrollable Area */}
        <main className="flex-1 overflow-y-auto bg-slate-50">
          {children}
        </main>
      </div>
    </div>
  );
}
