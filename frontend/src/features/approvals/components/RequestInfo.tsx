import type { ReactNode } from 'react';
import { arrangeFields } from '@/shared/form';
import { date, initials } from '@/shared/lib/format';
import { When } from '@/shared/ui';
import type { RequestDetail } from '../types';
import { OutcomeBadge } from './badges';

/** Thông tin đã điền trong đơn, chỉ đọc, nhãn trái hai cột. */
export function RequestFields({ request: r }: { request: RequestDetail }) {
  const show = (type: string, v: unknown) => {
    if (v === null || v === undefined || v === '') return <span className="muted">---</span>;
    if (type === 'date') return <span className="mono">{date(v)}</span>;
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    return String(v);
  };
  return (
    <div className="fgrid">
      {arrangeFields(r.fields).map(f => (
        <div key={f.id} className={`fl${f.type === 'multi-line-text' ? ' fl--wide' : ''}`}>
          <span className="fl__label">{f.label}</span>
          <span className="fl__value">{show(f.type, f.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Dòng thời gian: gửi đơn, các bước duyệt, ý kiến. Mới nhất ở trên. */
export function Timeline({ request: r }: { request: RequestDetail }) {
  type Item = { key: string; who: string; text: ReactNode; at: string | null; note?: string };
  const items: Item[] = [
    { key: 'start', who: r.initiator?.name ?? '?', text: <><b>{r.initiator?.name}</b> submitted the request</>, at: r.startTime },
  ];
  for (const s of r.steps) {
    if (!s.endTime) items.push({ key: s.id + 'a', who: s.assignee?.name ?? '?', text: <>Waiting for <b>{s.assignee?.name ?? 'the approver'}</b></>, at: s.startTime });
    else if (s.cancelled) items.push({ key: s.id + 'c', who: r.initiator?.name ?? '?', text: <>The request was withdrawn</>, at: s.endTime });
    else
      items.push({
        key: s.id + 'b', who: s.assignee?.name ?? '?',
        text: <><b>{s.assignee?.name}</b> {s.outcome ? <OutcomeBadge outcome={s.outcome} /> : 'completed'}</>,
        at: s.endTime,
        note: s.notes.map(n => String(n.value)).join(' '),
      });
  }
  items.reverse();
  return (
    <ul className="tl">
      {items.map(i => (
        <li key={i.key}>
          <span className="tl__av" aria-hidden="true">{initials(i.who)}</span>
          <div>
            <p>{i.text}</p>
            {i.note && <blockquote>{i.note}</blockquote>}
            <small><When at={i.at} /></small>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Bảng nhật ký xử lý (tab Nhật ký). */
export function HistoryTable({ request: r }: { request: RequestDetail }) {
  return (
    <div className="grid-wrap">
      <table className="grid">
        <thead><tr><th>Step</th><th>Assignee</th><th>Started</th><th>Finished</th><th>Result</th><th>Comment</th></tr></thead>
        <tbody>
          <tr>
            <td>Submitted</td><td>{r.initiator?.name}</td><td><When at={r.startTime} /></td><td><When at={r.startTime} /></td>
            <td><span className="badge badge--neutral">Sent</span></td><td />
          </tr>
          {r.steps.map(s => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>{s.assignee?.name ?? <span className="muted">Unassigned</span>}</td>
              <td><When at={s.startTime} /></td>
              <td>{s.endTime ? <When at={s.endTime} /> : <span className="muted">Waiting</span>}</td>
              <td>{s.cancelled ? <span className="badge badge--cancelled">Stopped</span> : s.outcome ? <OutcomeBadge outcome={s.outcome} /> : <span className="badge badge--pending">In progress</span>}</td>
              <td>{s.notes.map(n => String(n.value)).join(' ') || <span className="muted">---</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
