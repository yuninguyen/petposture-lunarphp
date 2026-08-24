import { ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import { logout } from '@/lib/auth';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  children?: NavItem[];
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export function AppShell({ children, userName }: { children: ReactNode; userName: string }) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [expandedNavGroups, setExpandedNavGroups] = useState<Record<string, boolean>>({
    '0': true,
    '1': true,
  });

  const NAV_GROUPS: NavGroup[] = [
    {
      title: t('sidebar.content', 'CONTENT'),
      items: [
        { 
          to: '/blog-categories', 
          label: t('blog_categories.title', 'Blog Categories'),
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          )
        },
        { 
          to: '/posts', 
          label: t('nav.posts'),
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l6 6v10a2 2 0 01-2 2z" />
            </svg>
          )
        },
        { 
          to: '/comments', 
          label: t('comments.title', 'Comments'),
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          )
        },
        { 
          to: '/tags', 
          label: t('tags.title', 'Tags'),
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
          )
        },
        {
          to: '/seo-social',
          label: t('seo_social.title', 'SEO & Social'),
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )
        },
        {
          to: '/legal-policies',
          label: t('pages.title', 'Legal & Policies'),
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )
        }
      ]
    },
    {
      title: t('sidebar.catalogue', 'CATALOGUE'),
      items: [
        {
          to: '/products',
          label: t('products.title', 'Products'),
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          ),
        },
        {
          to: '/product-types',
          label: t('product_types.title', 'Product Types'),
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0-8 5-8-5m16 0-8 5m-8-5 8 5m0 0v3" />
            </svg>
          ),
        },
        {
          to: '/custom-fields',
          label: t('custom_fields.title', 'Custom Fields'),
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h10M4 18h7m6-8v8m-4-4h8" />
            </svg>
          ),
        },
        {
          to: '/brands',
          label: t('brands.title', 'Brands'),
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h10v10H7zM4 4h16v16H4z" />
            </svg>
          ),
        },
        {
          to: '/collection-groups',
          label: t('collection_groups.title', 'Collection Groups'),
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h10" />
            </svg>
          ),
          children: [
            {
              to: '/collections',
              label: t('collections.title', 'Collections'),
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v4m0 0H6a2 2 0 00-2 2v2m8-4h6a2 2 0 012 2v2m-8-4v4M2 15h4v4H2v-4zm8 0h4v4h-4v-4zm8 0h4v4h-4v-4z" />
                </svg>
              ),
            },
          ],
        },
        {
          to: '/breeds',
          label: t('breeds.title', 'Breeds'),
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
            </svg>
          ),
        },
        {
          to: '/solutions',
          label: t('solutions.title', 'Solutions'),
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          ),
        },
      ],
    }
  ];

  const activeNavGroupKey = String(NAV_GROUPS.findIndex((group) => (
    group.items.some((item) => (
      location.pathname === item.to
      || location.pathname.startsWith(`${item.to}/`)
      || item.children?.some((child) => (
        location.pathname === child.to || location.pathname.startsWith(`${child.to}/`)
      ))
    ))
  )));

  useEffect(() => {
    if (activeNavGroupKey === '-1') return;

    setExpandedNavGroups((current) => (
      current[activeNavGroupKey]
        ? current
        : { ...current, [activeNavGroupKey]: true }
    ));
  }, [activeNavGroupKey]);

  return (
    <div className="min-h-screen flex bg-slate-50 overflow-hidden">
      
      {/* Full-height Dark Sidebar */}
      <aside className="w-60 bg-[#1e293b] flex flex-col hidden md:flex z-40 flex-shrink-0 border-r border-[#0f172a]">
        
        {/* Logo Area */}
        <div className="h-16 flex items-center px-6 flex-shrink-0 border-b border-white/5">
          <img src="/logo.png" alt="Logo" className="h-9 w-auto object-contain" />
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 py-6 flex flex-col gap-6 overflow-y-auto px-3">
          {NAV_GROUPS.map((group, groupIdx) => {
            const groupKey = String(groupIdx);
            const expanded = expandedNavGroups[groupKey] ?? true;

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
                  aria-label={t(expanded ? 'sidebar.collapse_group' : 'sidebar.expand_group', { group: group.title })}
                >
                  <span className="text-xs font-semibold uppercase tracking-wider">{group.title}</span>
                  <span className={`text-sm transition-transform ${expanded ? 'rotate-90' : ''}`}>›</span>
                </button>
                {expanded && group.items.map((item) => (
                  <div key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                          isActive
                            ? 'bg-white/10 text-white shadow-sm'
                            : 'text-slate-400 hover:bg-white/5 hover:text-white'
                        }`
                      }
                    >
                      {item.icon}
                      {item.label}
                    </NavLink>
                    {item.children && (
                      <div className="ml-4 mt-1 border-l border-white/10 pl-2">
                        {item.children.map((child) => (
                          <NavLink
                            key={child.to}
                            to={child.to}
                            className={({ isActive }) =>
                              `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                                isActive
                                  ? 'bg-white/10 text-white shadow-sm'
                                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
                              }`
                            }
                          >
                            {child.icon}
                            {child.label}
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
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-end sticky top-0 z-30 flex-shrink-0 shadow-sm">
          
          <div className="flex items-center gap-4 sm:gap-6">
            
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

            {/* User Profile */}
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                <span className="text-sm font-bold text-primary">
                  {userName.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-sm font-medium text-slate-700 hidden md:block">{userName}</span>
            </div>
            
            {/* Logout Button */}
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
