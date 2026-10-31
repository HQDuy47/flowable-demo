import { useEffect, useState } from 'react';
import { api, type RequestSummary, type Status, type TaskRow } from './api';
import { OutcomeBadge, Person, StatusBadge } from './ui';
import { fmtTime, shortId } from './format';

/** Tải dữ liệu lại mỗi khi `key` đổi (đổi user, sau khi gửi/duyệt…) */
function useLoad<T>(load: () => Promise<T>, onError: (e: unknown) => void, key: string) {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let alive = true;
    setData(null);
    load().then(d => alive && setData(d)).catch(onError);
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return data;
}

/** Hàng thẻ số liệu phía trên bảng */
function Stats({ items }: { items: { label: string; value: number | string; tone?: string }[] }) {
  return (
    <div className="stats">
      {items.map(s => (
        <div key={s.label} className={'stat' + (s.tone ? ` stat-${s.tone}` : '')}>
          <div className="stat-label">{s.label}</div>
          <div className="stat-value">{s.value}</div>
        </div>
      ))}
    </div>
  );
}

function Table({ title, toolbar, head, rows, total, empty }: {
  title: string; toolbar?: React.ReactNode; head: string[];
  rows: React.ReactNode[] | null; total: number; empty: string;
}) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
        <div className="toolbar">{toolbar}</div>
      </div>
      {!rows ? <div className="panel-empty">Đang tải…</div>
        : !rows.length ? <div className="panel-empty">{empty}</div>
        : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr>{head.map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>{rows}</tbody>
            </table>
          </div>
        )}
      {rows && <div className="panel-foot">Hiển thị {rows.length} / {total} bản ghi</div>}
    </div>
  );
}

function Search({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <input className="search" type="search" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />;
}

const matches = (q: string, ...texts: (string | undefined)[]) =>
  !q || texts.some(t => t?.toLowerCase().includes(q.trim().toLowerCase()));

type ListProps = { reloadKey: string; onOpen: (requestId: string) => void; onError: (e: unknown) => void };

/** Đơn của tôi (người tạo) */
export function RequestList({ reloadKey, onOpen, onError }: ListProps) {
  const data = useLoad(() => api.requests(), onError, reloadKey);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<Status | ''>('');
  const count = (s: Status) => data?.filter(r => r.status === s).length ?? 0;

  const rows = data
    ?.filter(r => (!status || r.status === status) && matches(q, r.processName, shortId(r.id)))
    .map((r: RequestSummary) => (
      <tr key={r.id} onClick={() => onOpen(r.id)}>
        <td className="mono">{shortId(r.id)}</td>
        <td className="cell-title">{r.processName}</td>
        <td className="nowrap">{fmtTime(r.startTime)}</td>
        <td><StatusBadge status={r.status} /></td>
        <td>{r.currentTask ? `${r.currentTask.name} · ${r.currentTask.assignee?.name ?? ''}` : <span className="muted">Đã kết thúc</span>}</td>
      </tr>
    ));

  return (
    <>
      <Stats items={[
        { label: 'Tổng số đơn', value: data?.length ?? '–' },
        { label: 'Chờ duyệt', value: count('pending'), tone: 'pending' },
        { label: 'Đã duyệt', value: count('approved'), tone: 'approved' },
        { label: 'Từ chối', value: count('rejected'), tone: 'rejected' },
      ]} />
      <Table
        title="Danh sách đơn"
        toolbar={<>
          <Search value={q} onChange={setQ} placeholder="Tìm theo mã, loại đơn…" />
          <select className="filter" value={status} onChange={e => setStatus(e.target.value as Status | '')}>
            <option value="">Tất cả trạng thái</option>
            <option value="pending">Chờ duyệt</option>
            <option value="approved">Đã duyệt</option>
            <option value="rejected">Từ chối</option>
            <option value="cancelled">Đã rút</option>
          </select>
        </>}
        head={['Mã đơn', 'Loại đơn', 'Ngày tạo', 'Trạng thái', 'Bước hiện tại']}
        rows={rows ?? null}
        total={data?.length ?? 0}
        empty={data?.length ? 'Không có đơn phù hợp.' : 'Bạn chưa tạo đơn nào.'}
      />
    </>
  );
}

/** Việc đang chờ tôi (pending) hoặc việc tôi đã xử lý (done) — người duyệt */
export function TaskList({ kind, reloadKey, onOpen, onError }: ListProps & { kind: 'pending' | 'done' }) {
  const data = useLoad(() => (kind === 'pending' ? api.tasks() : api.doneTasks()), onError, `${kind}:${reloadKey}`);
  const [q, setQ] = useState('');
  const [today] = useState(() => new Date().toDateString());
  const n = (f: (t: TaskRow) => boolean) => data?.filter(f).length ?? 0;

  const rows = data
    ?.filter(t => matches(q, t.request.processName, shortId(t.request.id), t.request.initiator?.name))
    .map((t: TaskRow) => (
      <tr key={t.id} onClick={() => onOpen(t.request.id)}>
        <td className="mono">{shortId(t.request.id)}</td>
        <td className="cell-title">{t.request.processName}</td>
        <td><Person user={t.request.initiator} /></td>
        <td>{t.name}</td>
        {kind === 'done' && <td>{t.outcome ? <OutcomeBadge outcome={t.outcome} /> : '—'}</td>}
        <td className="nowrap">{fmtTime(t.time)}</td>
        {kind === 'pending' && <td className="right"><span className="btn btn-sm">Xử lý</span></td>}
      </tr>
    ));

  const stats = kind === 'pending'
    ? [
        { label: 'Đang chờ duyệt', value: data?.length ?? '–', tone: 'pending' },
        { label: 'Nhận hôm nay', value: n(t => new Date(t.time).toDateString() === today) },
      ]
    : [
        { label: 'Đã xử lý', value: data?.length ?? '–' },
        { label: 'Đã duyệt', value: n(t => t.outcome?.id === 'approve'), tone: 'approved' },
        { label: 'Từ chối', value: n(t => t.outcome?.id === 'reject'), tone: 'rejected' },
      ];

  return (
    <>
      <Stats items={stats} />
      <Table
        title={kind === 'pending' ? 'Đơn chờ duyệt' : 'Lịch sử xử lý'}
        toolbar={<Search value={q} onChange={setQ} placeholder="Tìm theo mã, loại đơn, người tạo…" />}
        head={['Mã đơn', 'Loại đơn', 'Người tạo', 'Bước', ...(kind === 'done' ? ['Kết quả', 'Xử lý lúc'] : ['Nhận lúc', ''])]}
        rows={rows ?? null}
        total={data?.length ?? 0}
        empty={data?.length ? 'Không có đơn phù hợp.' : kind === 'pending' ? 'Không có đơn nào đang chờ bạn duyệt.' : 'Bạn chưa xử lý đơn nào.'}
      />
    </>
  );
}
