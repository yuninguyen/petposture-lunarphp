import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import { AdminNavGroup } from '@/navigation/adminNavigation';
import { useBranding } from '@/context/BrandingContext';
import { logout } from '@/lib/auth';

export interface MobileAdminNavProps {
  open: boolean;
  onClose: () => void;
  groups: AdminNavGroup[];
  userName?: string;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

export function MobileAdminNav({
  open,
  onClose,
  groups,
  userName = 'Admin',
  triggerRef,
}: MobileAdminNavProps) {
  const { t } = useTranslation();
  const branding = useBranding();
  const location = useLocation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const [expandedNavGroups, setExpandedNavGroups] = useState<Record<string, boolean>>({
    sales: true,
    content: true,
    catalogue: true,
  });

  // Keep active group expanded
  const activeNavGroupKey = groups.find((group) =>
    group.items.some((item) =>
      location.pathname === item.path ||
      location.pathname.startsWith(`${item.path}/`) ||
      item.children?.some((child) =>
        location.pathname === child.path || location.pathname.startsWith(`${child.path}/`)
      )
    )
  )?.key;

  useEffect(() => {
    if (!activeNavGroupKey) return;
    setExpandedNavGroups((current) => (
      current[activeNavGroupKey] ? current : { ...current, [activeNavGroupKey]: true }
    ));
  }, [activeNavGroupKey]);

  // Handle manual close (Close button, Escape key, backdrop click)
  // Restores focus to the trigger (hamburger) button
  const handleManualClose = () => {
    onClose();
    if (triggerRef?.current) {
      triggerRef.current.focus();
    }
  };

  // Handle route navigation click
  // Closes the drawer naturally without forcing focus back to hamburger
  const handleLinkClick = () => {
    onClose();
  };

  // Body scroll lock & restore
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  // Initial focus on open
  useEffect(() => {
    if (!open) return;
    // Focus the close button or first focusable element
    const timer = setTimeout(() => {
      if (closeButtonRef.current) {
        closeButtonRef.current.focus();
      } else if (dialogRef.current) {
        const firstFocusable = dialogRef.current.querySelector<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleManualClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, triggerRef]);

  // Auto-close on viewport resize across >= 768px (md breakpoint)
  useEffect(() => {
    if (!open) return;
    const mql = window.matchMedia('(min-width: 768px)');
    const handleMediaChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        onClose();
      }
    };

    if (mql.matches) {
      onClose();
      return;
    }

    if (mql.addEventListener) {
      mql.addEventListener('change', handleMediaChange);
      return () => mql.removeEventListener('change', handleMediaChange);
    } else {
      mql.addListener(handleMediaChange);
      return () => mql.removeListener(handleMediaChange);
    }
  }, [open, onClose]);

  // Trap focus inside dialog
  const handleKeyDownTrap = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusables = dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  if (!open) return null;

  return (
    <div
      id="mobile-admin-drawer"
      role="dialog"
      aria-modal="true"
      aria-label={t('navigation.title', 'Admin navigation')}
      onKeyDown={handleKeyDownTrap}
      className="fixed inset-0 z-50 md:hidden flex"
    >
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
        onClick={handleManualClose}
        data-testid="mobile-nav-backdrop"
      />

      {/* Drawer Panel */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative flex-1 flex flex-col max-w-xs w-full bg-[#1e293b] text-white shadow-2xl border-r border-[#0f172a] z-10 outline-none"
      >
        {/* Header with Logo & Close Button */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 flex-shrink-0">
          <img src={branding?.logoUrl || '/logo.png'} alt="Logo" className="h-8 w-auto object-contain" />
          <button
            ref={closeButtonRef}
            type="button"
            onClick={handleManualClose}
            className="p-2 -mr-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white/20"
            aria-label={t('navigation.close', 'Close navigation')}
            data-testid="mobile-nav-close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 py-4 flex flex-col gap-4 overflow-y-auto px-3">
          {groups.map((group) => {
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
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"
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
                      onClick={handleLinkClick}
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
                            onClick={handleLinkClick}
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

        {/* Footer with User info & logout */}
        <div className="p-4 mt-auto border-t border-white/5 flex-shrink-0">
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
              title={t('auth.logout', 'Logout')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
