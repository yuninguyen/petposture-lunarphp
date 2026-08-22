import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { logout } from '@/lib/auth';

export function AppShell({ children, userName }: { children: ReactNode; userName: string }) {
  const { t, i18n } = useTranslation();

  const NAV_ITEMS = [
    { 
      to: '/posts', 
      label: t('nav.posts'),
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l6 6v10a2 2 0 01-2 2z" />
        </svg>
      )
    },
  ];

  return (
    <div className="min-h-screen flex bg-slate-50 overflow-hidden">
      
      {/* Full-height Dark Sidebar */}
      <aside className="w-60 bg-[#1e293b] flex flex-col hidden md:flex z-40 flex-shrink-0 border-r border-[#0f172a]">
        
        {/* Logo Area */}
        <div className="h-16 flex items-center px-6 flex-shrink-0 border-b border-white/5">
          <img src="/logo.png" alt="Logo" className="h-9 w-auto object-contain" />
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 py-6 flex flex-col gap-1.5 overflow-y-auto px-3">
          <div className="px-3 mb-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t('nav.main_menu', 'Main Menu')}
            </p>
          </div>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all rounded-lg ${
                  isActive
                    ? 'text-white bg-white/10 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
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
