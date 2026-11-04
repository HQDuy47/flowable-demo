import { useState, type ReactNode } from 'react';
import { date, time } from '../lib/format';

/** Dòng tiêu đề trang: tiêu đề bên trái, các nút thao tác ngang hàng bên phải. */
export function RecordHeader({ title, subtitle, fields, actions }: {
  title: ReactNode; subtitle?: ReactNode; fields: { label: string; value: ReactNode }[]; actions?: ReactNode;
}) {
  return (
    <div className="rhead">
      <div className="rhead__title">
        <div className="rhead__titleline"><h1>{title}</h1></div>
        <p>
          {subtitle}
          {fields.map(f => (
            <span key={f.label} className="rhead__field"><span className="rhead__label">{f.label}</span> {f.value}</span>
          ))}
        </p>
      </div>
      {actions && <div className="rhead__actions" role="toolbar" aria-label="Actions">{actions}</div>}
    </div>
  );
}

/** Card có tiêu đề. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="sec" aria-label={title}>
      <h2 className="sec__title">{title}</h2>
      {children}
    </section>
  );
}

/** Tab đơn giản; nội dung các tab vẫn nằm trong DOM, chỉ ẩn đi. */
export function Tabs({ tabs }: { tabs: { id: string; label: string; body: ReactNode }[] }) {
  const [on, setOn] = useState(tabs[0].id);
  return (
    <>
      <div className="rtabs" role="tablist">
        {tabs.map(t => (
          <button key={t.id} type="button" role="tab" aria-selected={on === t.id} className="rtab" onClick={() => setOn(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map(t => (
        <div key={t.id} role="tabpanel" hidden={on !== t.id}>{t.body}</div>
      ))}
    </>
  );
}

/** Danh sách nhãn và giá trị (cột phải). */
export function KeyValues({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="kv">
      {rows.map(r => <div key={r.label} className="kv__row"><dt>{r.label}</dt><dd>{r.value}</dd></div>)}
    </dl>
  );
}

/** Ngày giờ dạng "31/10/2026 22:34". */
export function When({ at }: { at: string | null | undefined }) {
  if (!at) return <span className="muted">Not yet</span>;
  return <time className="mono" dateTime={at}>{date(at)} {time(at)}</time>;
}
