import { NavLink, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  {
    to: '/',
    label: '首页',
    icon: (active) => (
      <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    to: '/exercises',
    label: '动作库',
    icon: (active) => (
      <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    to: '/workouts',
    label: '训练',
    icon: (active) => (
      <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    to: '/stats',
    label: '统计',
    icon: (active) => (
      <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    to: '/profile',
    label: '我的',
    icon: (active) => (
      <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const location = useLocation();

  // Hide on login page
  if (location.pathname === '/login') return null;

  return (
    <>
      {/* Mobile: Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-950/95 backdrop-blur-sm border-t border-gray-800 z-40
                      safe-area-inset-bottom lg:hidden">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {NAV_ITEMS.map(({ to, label, icon }) => {
            const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
            return (
              <NavLink
                key={to}
                to={to}
                className={`flex flex-col items-center py-2 px-4 min-w-[60px] transition-colors
                  ${active ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'}`}
                style={{ minHeight: '44px', justifyContent: 'center' }}
              >
                {icon(active)}
                <span className="text-[10px] mt-0.5">{label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Desktop: Left sidebar */}
      <nav className="hidden lg:flex fixed left-0 top-0 bottom-0 w-14 xl:w-52 bg-gray-950 border-r border-gray-800
                      flex-col z-40 py-4">
        {/* Logo */}
        <div className="px-3 xl:px-5 mb-6">
          <h1 className="text-lg font-bold text-emerald-400 xl:block hidden">FitLog</h1>
          <div className="xl:hidden flex justify-center">
            <span className="text-emerald-400 font-bold text-lg">F</span>
          </div>
        </div>

        {/* Nav items */}
        <div className="flex-1 flex flex-col gap-1 px-2 xl:px-3">
          {NAV_ITEMS.map(({ to, label, icon }) => {
            const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
            return (
              <NavLink
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
                  ${active
                    ? 'bg-emerald-600/10 text-emerald-400'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}
                style={{ minHeight: '44px' }}
              >
                {icon(active)}
                <span className="text-sm font-medium hidden xl:block">{label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </>
  );
}
