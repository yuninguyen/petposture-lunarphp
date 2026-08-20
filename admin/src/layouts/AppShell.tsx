import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { logout } from '@/lib/auth';

const NAV_ITEMS = [
  { to: '/posts', label: 'Bài viết' },
];

export function AppShell({ children, userName }: { children: ReactNode; userName: string }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-primary px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white font-bold text-sm">
          <span className="w-2 h-2 rounded-full bg-secondary" />
          PetPosture Admin
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-300 text-xs">{userName}</span>
          <button onClick={() => logout().then(() => window.location.reload())} className="text-gray-300 text-xs hover:text-white">
            Đăng xuất
          </button>
        </div>
      </header>
      <div className="flex flex-1">
        <nav className="w-44 bg-primary-dark py-4">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block px-5 py-2.5 text-sm ${isActive ? 'text-white bg-primary font-semibold border-r-4 border-secondary' : 'text-gray-300'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <main className="flex-1 bg-gray-100 p-6">{children}</main>
      </div>
    </div>
  );
}
