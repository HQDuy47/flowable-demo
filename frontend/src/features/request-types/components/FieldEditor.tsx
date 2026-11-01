import { Ic } from '@/shared/ui';
import { FIELD_TYPES, type FieldType } from '../api';

/** Một trường đang thiết kế. `uid` chỉ dùng làm key trong React; `id` có khi trường đã được lưu. */
export type DraftField = { uid: string; id?: string; name: string; type: FieldType; required: boolean; options: string };

let seq = 0;
export const newField = (): DraftField => ({ uid: `n${++seq}`, name: '', type: 'text', required: false, options: '' });

/** Danh sách trường: nhãn, kiểu, bắt buộc, lựa chọn (dropdown), đổi thứ tự, xoá. */
export function FieldEditor({ fields, onChange, showErrors }: {
  fields: DraftField[]; onChange: (fields: DraftField[]) => void; showErrors: boolean;
}) {
  const patch = (i: number, p: Partial<DraftField>) => onChange(fields.map((f, j) => (j === i ? { ...f, ...p } : f)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...fields];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };

  return (
    <div className="fed">
      <ol className="fed__list">
        {fields.map((f, i) => {
          const n = i + 1;
          const noName = showErrors && !f.name.trim();
          const noOptions = showErrors && f.type === 'dropdown' && !f.options.trim();
          return (
            <li key={f.uid} className="fed__row">
              <span className="fed__n" aria-hidden="true">{n}</span>
              <label className="fed__name">
                <span className="visually-hidden">Field {n} label</span>
                <input className="fi" placeholder="Field label, e.g. Amount" value={f.name} maxLength={80}
                  aria-invalid={noName || undefined} onChange={e => patch(i, { name: e.target.value })} />
              </label>
              <label className="fed__type">
                <span className="visually-hidden">Field {n} type</span>
                <span className="fi-select">
                  <select className="fi" value={f.type} onChange={e => patch(i, { type: e.target.value as FieldType })}>
                    {FIELD_TYPES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </span>
              </label>
              <label className="fed__req">
                <input className="fi-check" type="checkbox" checked={f.required} onChange={e => patch(i, { required: e.target.checked })} />
                Required
              </label>
              <span className="fed__tools">
                <button type="button" className="cmd cmd--icon" aria-label={`Move field ${n} up`} disabled={i === 0} onClick={() => move(i, -1)}><Ic name="up" /></button>
                <button type="button" className="cmd cmd--icon" aria-label={`Move field ${n} down`} disabled={i === fields.length - 1} onClick={() => move(i, 1)}><Ic name="down" /></button>
                <button type="button" className="cmd cmd--icon" aria-label={`Remove field ${n}`} disabled={fields.length === 1} onClick={() => onChange(fields.filter((_, j) => j !== i))}><Ic name="trash" /></button>
              </span>
              {f.type === 'dropdown' && (
                <label className="fed__opts">
                  <span className="fl__label">Options, one per line</span>
                  <textarea className="fi fi--area" rows={3} value={f.options} aria-invalid={noOptions || undefined}
                    placeholder={'Laptop\nMonitor\nOther'} onChange={e => patch(i, { options: e.target.value })} />
                </label>
              )}
            </li>
          );
        })}
      </ol>
      <button type="button" className="cmd" onClick={() => onChange([...fields, newField()])} disabled={fields.length >= 30}>
        <Ic name="add" /><span>Add field</span>
      </button>
    </div>
  );
}
