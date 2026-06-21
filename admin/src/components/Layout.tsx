import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';

const navItems = [
  { path: '/dashboard', label: 'Overview', icon: 'grid' },
  { path: '/listings', label: 'Listings', icon: 'tag' },
  { path: '/users', label: 'Users', icon: 'users' },
  { path: '/reports', label: 'Reports', icon: 'flag' },
  { path: '/analytics', label: 'Search analytics', icon: 'chart' },
  { path: '/activity', label: 'Activity log', icon: 'activity' },
] as const;

type IconName = (typeof navItems)[number]['icon'] | 'menu' | 'close' | 'logout';

function Icon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    grid: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
    tag: <path d="m20 13-7 7-9-9V4h7l9 9Z M8 8h.01" />,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    flag: <path d="M5 21V4m0 0c4-3 7 3 14 0v10c-7 3-10-3-14 0" />,
    chart: <><path d="M4 19V5M4 19h16" /><path d="m7 15 4-4 3 2 5-6" /></>,
    activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M21 19V5a2 2 0 0 0-2-2h-6" /></>,
  };
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    sessionStorage.removeItem('accessToken');
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-950">
      {isSidebarOpen && <button type="button" className="fixed inset-0 z-40 bg-slate-950/55 md:hidden" aria-label="Close navigation" onClick={() => setIsSidebarOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col bg-slate-950 px-3 py-4 text-slate-300 shadow-2xl transition-transform duration-200 ease-out md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-3 pb-5">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-400 text-slate-950 shadow-sm">
              <span className="text-base font-black">P</span>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-300">PocketTrade</p>
              <h1 className="text-base font-semibold text-white">Admin console</h1>
            </div>
          </div>
          <button type="button" className="grid h-10 w-10 place-items-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white md:hidden" aria-label="Close navigation" onClick={() => setIsSidebarOpen(false)}><Icon name="close" /></button>
        </div>

        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Workspace</p>
        <nav className="space-y-1" aria-label="Admin navigation">
          {navItems.map((item) => (
            <NavLink key={item.path} to={item.path} onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors ${isActive ? 'bg-emerald-400 text-slate-950 shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto border-t border-white/10 px-3 pt-4">
          <div className="mb-3 flex items-center gap-3">
            <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white">AD<span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-slate-950 bg-emerald-400" /></span>
            <div className="min-w-0"><p className="truncate text-sm font-medium text-white">Administrator</p><p className="text-xs text-slate-500">Moderation workspace</p></div>
          </div>
          <button type="button" onClick={() => setShowLogoutConfirm(true)} className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-sm font-medium text-slate-400 hover:bg-white/10 hover:text-white"><Icon name="logout" /><span>Log out</span></button>
        </div>
      </aside>

      <div className="min-w-0 md:ml-[272px]">
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-slate-200/80 bg-[#f4f7fb]/95 px-4 backdrop-blur md:px-7">
          <div className="flex items-center gap-3"><button type="button" className="grid h-10 w-10 place-items-center rounded-md text-slate-600 hover:bg-white hover:text-slate-950 md:hidden" aria-label="Open navigation" onClick={() => setIsSidebarOpen(true)}><Icon name="menu" /></button><div><p className="text-xs font-medium text-slate-500">Marketplace operations</p><p className="text-sm font-semibold text-slate-900">Review, protect, and grow PocketTrade</p></div></div>
          <span className="hidden items-center gap-2 text-xs font-medium text-slate-500 sm:flex"><span className="h-2 w-2 rounded-full bg-emerald-500" />System online</span>
        </header>
        <main className="mx-auto w-full max-w-[1560px] p-4 sm:p-6 lg:p-7">{children}</main>
      </div>

      {showLogoutConfirm && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 px-4"><div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-2xl"><h2 className="text-lg font-semibold text-slate-950">Log out?</h2><p className="mt-2 text-sm leading-6 text-slate-600">You will need to sign in again to access the moderation workspace.</p><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setShowLogoutConfirm(false)} className="min-h-10 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button><button type="button" onClick={handleLogout} className="min-h-10 rounded-md bg-slate-950 px-3 text-sm font-medium text-white hover:bg-slate-800">Log out</button></div></div></div>}
    </div>
  );
}
