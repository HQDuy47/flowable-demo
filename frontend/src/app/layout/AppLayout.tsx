import { Suspense, useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { useTasks } from '@/features/approvals';
import { useLogout } from '@/features/users';
import { getSession, type SessionUser } from '@/shared/auth/session';
import { code, initials } from '@/shared/lib/format';
import { Cmd, Ic, Skeleton } from '@/shared/ui';
import { homeOf, NAV, navOf, TAB_TITLE } from './nav';

/** Chặn route: chưa đăng nhập → /login; mở màn không thuộc vai trò của mình → về màn đầu của vai trò đó. */
export function AppLayout() {
  const { pathname } = useLocation();
  const user = getSession();
  if (!user) return <Navigate to="/login" replace />;
  const current = navOf(pathname);
  if (!current || current.role !== user.role) return <Navigate to={homeOf(user.role)} replace />;
  return <Shell user={user} current={current} />;
}

/** Khung app: sidebar (chỉ các mục của vai trò), thanh trên (breadcrumb + người đăng nhập), vùng nội dung. */
function Shell({ user, current }: { user: SessionUser; current: (typeof NAV)[number] }) {
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useLogout();
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => setNavOpen(false), [location.pathname]);
  // Chữ trên thanh tab theo vai trò; rời khung app (đăng xuất) thì trả lại chữ cũ
  useEffect(() => {
    const prev = document.title;
    document.title = TAB_TITLE[user.role];
    return () => { document.title = prev; };
  }, [user.role]);

  const items = NAV.filter(n => n.role === user.role);
  const home = homeOf(user.role);
  // Hàng chờ nằm ở đây để menu hiện số đơn chờ duyệt (chỉ người duyệt)
  const tasks = useTasks(user.role === 'approver');
  const taskMatch = useMatch('/approvals/:taskId');
  const openTask = taskMatch ? tasks.data?.find(t => t.id === taskMatch.params.taskId) : undefined;

  const crumbs = [
    { label: 'Requests', to: home },
    { label: current.name, to: current.path },
    ...(openTask ? [{ label: code(openTask.request.id), to: undefined }] : []),
  ];

  const signOut = () => { logout(); navigate('/login', { replace: true }); };

  return (
    <div className={`app${navOpen ? ' nav-open' : ''}`}>
      <nav className="snav" id="snav" aria-label="Main navigation">
        <Link className="snav__logo" to={home}><span className="snav__mark" aria-hidden="true">RQ</span>Requests</Link>
        {items.map(item => {
          const count = item.path === '/approvals' ? tasks.data?.length : undefined;
          return (
            <NavLink key={item.path} className="snav__item" to={item.path}>
              <Ic name={item.icon} />
              <span>{item.name}</span>
              {!!count && <span className="snav__count">{count}</span>}
            </NavLink>
          );
        })}
        <span className="snav__me"><Ic name="user" />{user.name}</span>
      </nav>
      <button type="button" className="scrim" tabIndex={-1} aria-label="Close menu" onClick={() => setNavOpen(false)} />

      <main className="workspace">
        <header className="topbar">
          <button type="button" className="topbar__menu" aria-label="Open menu" aria-expanded={navOpen} aria-controls="snav" onClick={() => setNavOpen(o => !o)}>
            <Ic name="menu" />
          </button>
          <nav className="crumbs" aria-label="Breadcrumb">
            {crumbs.map((c, i) => (
              <span key={i} className="crumbs__item">
                {i > 0 && <span className="crumbs__sep" aria-hidden="true" />}
                {c.to && i < crumbs.length - 1 ? <Link to={c.to}>{c.label}</Link> : <b aria-current="page">{c.label}</b>}
              </span>
            ))}
          </nav>
          <div className="me" title={`Signed in as ${user.title.toLowerCase()}`}>
            <span className="me__avatar" aria-hidden="true">{initials(user.name)}</span>
            <span className="me__text"><b>{user.name}</b><small>{user.title}</small></span>
            <Cmd icon="logout" label="Sign out" onClick={signOut} />
          </div>
        </header>
        <Suspense fallback={<div className="pad"><Skeleton rows={8} /></div>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
