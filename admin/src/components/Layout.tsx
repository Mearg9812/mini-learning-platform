import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, ChevronDown, ClipboardList, GraduationCap, LayoutDashboard, LogOut, Menu, Moon, ShieldCheck, Sun, Users, Video, X } from 'lucide-react';

const navigation = [
  { to: '/dashboard/videos', label: 'Video library', icon: Video },
  { to: '/dashboard/users', label: 'Users & access', icon: Users },
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isEnrollmentOpen, setIsEnrollmentOpen] = useState(() => location.pathname.startsWith('/dashboard/enrollment'));
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const currentUserRole = localStorage.getItem('role') || 'ADMIN';

  useEffect(() => {
    const theme = isDarkMode ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [isDarkMode]);

  useEffect(() => {
    if (location.pathname.startsWith('/dashboard/enrollment')) setIsEnrollmentOpen(true);
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-30 bg-slate-950/45 backdrop-blur-[2px] md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[268px] flex-col border-r border-slate-800 bg-[#111827] text-slate-200 shadow-2xl shadow-slate-950/10 transition-transform duration-200 md:static md:z-auto md:translate-x-0 md:shadow-none ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-[76px] items-center justify-between border-b border-white/[0.07] px-5">
          <Link to="/dashboard/videos" onClick={() => setIsSidebarOpen(false)} className="flex min-w-0 items-center gap-3 no-underline">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-950/40">
              <BookOpen size={20} strokeWidth={2.2} />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-bold tracking-tight text-white">Mini Learning</span>
              <span className="mt-0.5 block text-[11px] font-medium tracking-wide text-slate-400">ADMIN CONSOLE</span>
            </span>
          </Link>
          <button type="button" aria-label="Close navigation menu" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white md:hidden" onClick={(event) => { event.preventDefault(); setIsSidebarOpen(false); }}>
            <X size={19} />
          </button>
        </div>

        <div className="px-4 pb-2 pt-7 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Workspace</div>
        <nav aria-label="Main navigation" className="flex-1 space-y-1 px-3">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setIsSidebarOpen(false)}
              className={({ isActive }) => `group flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition ${isActive ? 'bg-indigo-500/15 text-white ring-1 ring-inset ring-indigo-400/20' : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'}`}
            >
              {({ isActive }) => <>
                <Icon size={18} className={isActive ? 'text-indigo-300' : 'text-slate-500 group-hover:text-slate-300'} />
                <span className="flex-1">{label}</span>
                {isActive && <span className="h-1.5 w-1.5 rounded-full bg-indigo-300" />}
              </>}
            </NavLink>
          ))}
          <div>
            <button
              type="button"
              aria-expanded={isEnrollmentOpen}
              aria-controls="enrollment-subpages"
              onClick={() => setIsEnrollmentOpen((open) => !open)}
              className={`group flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-medium transition ${location.pathname.startsWith('/dashboard/enrollment') ? 'bg-indigo-500/15 text-white ring-1 ring-inset ring-indigo-400/20' : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'}`}
            >
              <GraduationCap size={18} className={location.pathname.startsWith('/dashboard/enrollment') ? 'text-indigo-300' : 'text-slate-500 group-hover:text-slate-300'} />
              <span className="flex-1">Enrollment</span>
              <ChevronDown size={16} className={`transition-transform ${isEnrollmentOpen ? 'rotate-180' : ''}`} />
            </button>
            {isEnrollmentOpen && (
              <div id="enrollment-subpages" className="ml-5 mt-1 space-y-1 border-l border-white/10 pl-3">
                <NavLink
                  to="/dashboard/enrollment/enroll-students"
                  onClick={() => setIsSidebarOpen(false)}
                  className={({ isActive }) => `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium transition ${isActive ? 'bg-indigo-500/15 text-white' : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'}`}
                >
                  <ClipboardList size={15} /> Enroll students
                </NavLink>
                <NavLink
                  to="/dashboard/enrollment/students"
                  onClick={() => setIsSidebarOpen(false)}
                  className={({ isActive }) => `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium transition ${isActive ? 'bg-indigo-500/15 text-white' : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'}`}
                >
                  <Users size={15} /> Students
                </NavLink>
              </div>
            )}
          </div>
        </nav>

        <div className="m-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-3.5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-700/70 text-slate-200"><ShieldCheck size={17} /></span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-slate-200">Signed in as</span>
              <span className="mt-0.5 block truncate text-[11px] text-slate-400">{currentUserRole.replace('_', ' ')}</span>
            </span>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-10 flex h-[76px] shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation menu"
              aria-expanded={isSidebarOpen}
              className="-ml-2 rounded-xl p-2 text-slate-600 transition hover:bg-slate-100 md:hidden"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu size={21} />
            </button>
            <div className="min-w-0">
              <div className="hidden items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:flex">
                <LayoutDashboard size={13} /> Workspace <span className="text-slate-300">/</span> Admin
              </div>
              <h1 className="text-sm font-bold tracking-tight text-slate-800 sm:mt-1">Admin console</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsDarkMode((dark) => !dark)}
              aria-label={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
              title={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
              className="ui-button ui-button-secondary min-h-10 px-3 text-slate-600"
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
              <span className="hidden sm:inline">{isDarkMode ? 'Light mode' : 'Dark mode'}</span>
            </button>
            <button type="button" onClick={handleLogout} className="ui-button ui-button-secondary min-h-10 px-3 text-slate-600">
              <LogOut size={16} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto px-4 py-6 sm:px-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-[1440px]"><Outlet /></div>
        </div>
      </main>
    </div>
  );
}
