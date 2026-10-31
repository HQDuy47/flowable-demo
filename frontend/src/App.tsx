import { useEffect, useState } from 'react';
import { api, setApiUser, type User } from './api';
import { DynamicForm, type FormModel } from './DynamicForm';
import { RequestList, TaskList } from './Lists';
import { RequestDetail } from './RequestDetail';
import { Avatar, Icon } from './ui';

type View = 'new' | 'mine' | 'inbox' | 'done';

// Người tạo: tạo đơn + theo dõi đơn của mình. Người duyệt: duyệt đơn + xem lại đơn đã xử lý.
const VIEWS: Record<View, { label: string; title: string; hint: string; role: User['role']; icon: 'list' | 'plus' | 'inbox' | 'check' }> = {
  mine:  { label: 'Đơn của tôi', title: 'Đơn của tôi', hint: 'Theo dõi trạng thái các đơn bạn đã gửi.', role: 'employee', icon: 'list' },
  new:   { label: 'Tạo đơn mới', title: 'Tạo đơn mới', hint: 'Điền thông tin và gửi để bắt đầu quy trình duyệt.', role: 'employee', icon: 'plus' },
  inbox: { label: 'Chờ tôi duyệt', title: 'Chờ tôi duyệt', hint: 'Các đơn đang chờ bạn xử lý.', role: 'approver', icon: 'inbox' },
  done:  { label: 'Đã xử lý', title: 'Đơn đã xử lý', hint: 'Các đơn bạn đã duyệt hoặc từ chối.', role: 'approver', icon: 'check' },
};

// Rút gọn lỗi BFF (vd. bấm vào quy trình mẫu không có start form)
const errorText = (e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  try { return JSON.parse(msg).message ?? msg; } catch { return msg; }
};

const USER_KEY = 'flowable-demo:user';
const savedUser = () => { try { return localStorage.getItem(USER_KEY); } catch { return null; } };

export default function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [me, setMe] = useState<User | null>(null);
  const [view, setView] = useState<View>('mine');
  const [openId, setOpenId] = useState<string | null>(null);
  const [inboxCount, setInboxCount] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showError = (e: unknown) => setError(typeof e === 'string' ? e : errorText(e));
  const notify = (msg: string) => { setToast(msg); setTimeout(() => setToast(t => (t === msg ? null : t)), 3000); };
  const changed = () => setReloadKey(k => k + 1);

  useEffect(() => {
    api.users().then(list => {
      setUsers(list);
      switchUser(list.find(u => u.id === savedUser()) ?? list[0]);
    }).catch(showError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Số việc chờ duyệt cho badge trên menu
  useEffect(() => {
    if (me?.role !== 'approver') return setInboxCount(0);
    api.tasks().then(t => setInboxCount(t.length)).catch(() => {});
  }, [me, reloadKey]);

  function switchUser(u: User) {
    setApiUser(u.id);
    try { localStorage.setItem(USER_KEY, u.id); } catch { /* bỏ qua */ }
    setMe(u);
    setView(u.role === 'approver' ? 'inbox' : 'mine');
    setOpenId(null);
    setError(null);
  }

  const go = (v: View) => { setView(v); setOpenId(null); setError(null); };
  const open = (id: string) => { setOpenId(id); setError(null); };

  if (!me) return <>{error && <p className="error">{error}</p>}</>;

  const menu = (Object.keys(VIEWS) as View[]).filter(k => VIEWS[k].role === me.role);
  const v = VIEWS[view];

  return (
    <div className="admin">
      <aside className="sidebar">
        <div className="brand"><Icon name="logo" size={22} /> Quản lý đơn từ</div>
        <div className="menu-label">{me.role === 'approver' ? 'Phê duyệt' : 'Đơn từ'}</div>
        <ul className="menu">
          {menu.map(k => (
            <li key={k}>
              <button className={view === k && !openId ? 'selected' : ''} onClick={() => go(k)}>
                <Icon name={VIEWS[k].icon} />
                <span>{VIEWS[k].label}</span>
                {k === 'inbox' && inboxCount > 0 && <span className="count">{inboxCount}</span>}
              </button>
            </li>
          ))}
        </ul>
        <div className="sidebar-foot">Demo Flowable · chưa có đăng nhập</div>
      </aside>

      <div className="main">
        <header className="topbar">
          <nav className="crumbs">
            <span>Trang chủ</span>
            <span className="sep">/</span>
            {openId
              ? <><button onClick={() => setOpenId(null)}>{v.label}</button><span className="sep">/</span><b>Chi tiết đơn</b></>
              : <b>{v.label}</b>}
          </nav>
          <label className="user-switch" title="Đổi người dùng (demo)">
            <Avatar user={me} size={30} />
            <span className="user-meta">
              <span>{me.name}</span>
              <small>{me.title}</small>
            </span>
            <span className="caret">▾</span>
            <select value={me.id} onChange={e => switchUser(users.find(u => u.id === e.target.value)!)}>
              {users.map(u => <option key={u.id} value={u.id}>{u.name} — {u.title}</option>)}
            </select>
          </label>
        </header>

        <main className="content">
          {error && <p className="error" onClick={() => setError(null)}>{error}</p>}

          {openId ? (
            <RequestDetail
              key={openId}
              id={openId}
              me={me}
              onChanged={changed}
              onError={showError}
              notify={notify}
            />
          ) : (
            <>
              <header className="page-head">
                <div>
                  <h1>{v.title}</h1>
                  <p className="muted">{v.hint}</p>
                </div>
                {view === 'mine' && <button className="btn" onClick={() => go('new')}><Icon name="plus" size={16} /> Tạo đơn mới</button>}
              </header>
              {view === 'new' && (
                <NewRequest key={me.id} me={me} onError={showError} onCreated={id => { notify('Đã gửi đơn'); changed(); open(id); }} />
              )}
              {view === 'mine' && (
                <RequestList reloadKey={`${me.id}:${reloadKey}`} onOpen={open} onError={showError} />
              )}
              {(view === 'inbox' || view === 'done') && (
                <TaskList kind={view === 'inbox' ? 'pending' : 'done'} reloadKey={`${me.id}:${reloadKey}`} onOpen={open} onError={showError} />
              )}
            </>
          )}
        </main>
      </div>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function NewRequest({ me, onCreated, onError }: {
  me: User; onCreated: (id: string) => void; onError: (e: unknown) => void;
}) {
  const [processes, setProcesses] = useState<{ id: string; key: string; name?: string }[] | null>(null);
  const [active, setActive] = useState<{ key: string; form: FormModel } | null>(null);

  const pick = async (p: { id: string; key: string }) => {
    try {
      const form = await api.startForm(p.id);
      // Điền sẵn họ tên người đang đăng nhập (nếu form có ô này)
      for (const f of form.fields) if (f.id === 'employeeName' && !f.value) f.value = me.name;
      setActive({ key: p.key, form });
    } catch (e) { onError(e); }
  };

  useEffect(() => {
    api.processes().then(list => {
      setProcesses(list);
      if (list.length === 1) pick(list[0]);
    }).catch(onError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (values: Record<string, any>) => {
    try { onCreated((await api.start(active!.key, values)).id); }
    catch (e) { onError(e); }
  };

  if (!processes) return <p className="muted">Đang tải…</p>;

  return (
    <div className="stack">
      {processes.length > 1 && (
        <div className="process-grid">
          {processes.map(p => (
            <button key={p.id} className={'chip' + (active?.key === p.key ? ' chip-selected' : '')} onClick={() => pick(p)}>
              {p.name ?? p.key}
            </button>
          ))}
        </div>
      )}
      {active && (
        <section className="card">
          <h2>{active.form.name}</h2>
          <DynamicForm key={active.key} form={active.form} onSubmit={submit} onError={onError} submitLabel="Gửi đơn" />
        </section>
      )}
    </div>
  );
}
