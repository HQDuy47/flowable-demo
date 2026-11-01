import { Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useMatch } from 'react-router-dom';
import { useTasks } from '@/features/approvals';
import { useUser } from '@/features/users';
import { code, initials } from '@/shared/lib/format';
import { Ic, Problem, Skeleton } from '@/shared/ui';
import { NAV, navOf } from './nav';

/** Khung app: sidebar, thanh trên (breadcrumb + người đang thao tác), vùng nội dung. */
export function AppLayout() {
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => setNavOpen(false), [location.pathname]);

  const current = navOf(location.pathname);
  const actor = useUser(current?.actor ?? '');
  // Hàng chờ nằm ở đây để menu hiện số đơn chờ duyệt
  const tasks = useTasks();
  const taskMatch = useMatch('/approvals/:taskId');
  const openTask = taskMatch ? tasks.data?.find(t => t.id === taskMatch.params.taskId) : undefined;

  const crumbs = [
    { label: 'Requests', to: '/new' },
    ...(current ? [{ label: current.name, to: current.path }] : []),
    ...(openTask ? [{ label: code(openTask.request.id), to: undefined }] : []),
  ];

  return (
    <div className={`app${navOpen ? ' nav-open' : ''}`}>
      <nav className="snav" id="snav" aria-label="Main navigation">
        <Link className="snav__logo" to="/new"><span className="snav__mark" aria-hidden="true">RQ</span>Requests</Link>
        {NAV.map(item => {
          const count = item.path === '/approvals' ? tasks.data?.length : undefined;
          return (
            <NavLink key={item.path} className="snav__item" to={item.path}>
              <Ic name={item.icon} />
              <span>{item.name}</span>
              {!!count && <span className="snav__count">{count}</span>}
            </NavLink>
          );
        })}
        {actor.data && <span className="snav__me"><Ic name="user" />{actor.data.name}</span>}
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
          {actor.data && (
            <div className="me" title={`Acting as ${actor.data.title.toLowerCase()}`}>
              <span className="me__avatar" aria-hidden="true">{initials(actor.data.name)}</span>
              <span className="me__text"><b>{actor.data.name}</b><small>{actor.data.title}</small></span>
            </div>
          )}
        </header>
        {actor.isError && <div className="pad"><Problem error={actor.error} onRetry={() => actor.refetch()} /></div>}
        <Suspense fallback={<div className="pad"><Skeleton rows={8} /></div>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
