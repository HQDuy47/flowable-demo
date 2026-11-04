import { Ic } from '@demo/shared/ui';
import { FIELD_TYPES, type FieldRules, type FieldType } from '../api';

/** Rule đang nhập (chuỗi như trong ô nhập). Cận dưới / cận trên chọn được "≥ / >" và "≤ / <". */
export type DraftRules = {
  lo: string; loOp: 'minimum' | 'exclusiveMinimum';
  hi: string; hiOp: 'maximum' | 'exclusiveMaximum';
  step: string; // multipleOf: chưa có ô nhập, chỉ giữ giá trị viết tay trong file
  minLength: string; maxLength: string; pattern: string; patternHint: string;
};

/** Một trường đang thiết kế. `uid` chỉ dùng làm key trong React; `id` có khi trường đã được lưu. */
export type DraftField = { uid: string; id?: string; name: string; type: FieldType; required: boolean; options: string; rules: DraftRules };

const str = (v: unknown) => (v == null ? '' : String(v));

export const toDraftRules = (r: FieldRules = {}): DraftRules => ({
  lo: str(r.exclusiveMinimum ?? r.minimum), loOp: r.exclusiveMinimum != null ? 'exclusiveMinimum' : 'minimum',
  hi: str(r.exclusiveMaximum ?? r.maximum), hiOp: r.exclusiveMaximum != null ? 'exclusiveMaximum' : 'maximum',
  step: str(r.multipleOf), minLength: str(r.minLength), maxLength: str(r.maxLength), pattern: str(r.pattern),
  patternHint: str(r.patternHint),
});

/** Rule gửi lên theo kiểu trường; kiểu không có rule gửi {} để xoá rule cũ. Ô trống bỏ qua. */
export function toRules(f: DraftField): FieldRules {
  const r = f.rules;
  const pairs: [keyof FieldRules, string][] =
    f.type === 'integer' ? [[r.loOp, r.lo], [r.hiOp, r.hi], ['multipleOf', r.step]]
      : f.type === 'text' || f.type === 'multi-line-text' ? [['minLength', r.minLength], ['maxLength', r.maxLength], ['pattern', r.pattern], ['patternHint', r.patternHint]]
      : [];
  return Object.fromEntries(
    pairs.filter(([, v]) => v.trim() !== '').map(([k, v]) => [k, k === 'pattern' || k === 'patternHint' ? v.trim() : Number(v)]),
  );
}

let seq = 0;
export const newField = (): DraftField => ({ uid: `n${++seq}`, name: '', type: 'text', required: false, options: '', rules: toDraftRules() });

/** Ô nhập rule theo kiểu trường: số → min / max; chữ → độ dài, pattern. Kiểu khác không có rule. */
function RuleInputs({ f, n, set }: { f: DraftField; n: number; set: (p: Partial<DraftRules>) => void }) {
  const r = f.rules;
  const num = (label: string, key: 'minLength' | 'maxLength') => (
    <label className="fed__rule">
      <span className="fl__label">{label}</span>
      <input className="fi" type="number" min={0} inputMode="numeric" placeholder="None" value={r[key]}
        onChange={e => set({ [key]: e.target.value })} />
    </label>
  );
  if (f.type === 'integer') {
    return (
      <div className="fed__rules" role="group" aria-label={`Field ${n} rules`}>
        <div className="fed__rule">
          <span className="fl__label" id={`rule-lo-${f.uid}`}>Minimum</span>
          <span className="fed__pair">
            <span className="fi-select fed__op">
              <select className="fi" aria-label={`Field ${n} minimum: comparison`} value={r.loOp}
                onChange={e => set({ loOp: e.target.value as DraftRules['loOp'] })}>
                <option value="minimum">≥</option>
                <option value="exclusiveMinimum">&gt;</option>
              </select>
            </span>
            <input className="fi" type="number" inputMode="numeric" placeholder="None" value={r.lo}
              aria-labelledby={`rule-lo-${f.uid}`} onChange={e => set({ lo: e.target.value })} />
          </span>
        </div>
        <div className="fed__rule">
          <span className="fl__label" id={`rule-hi-${f.uid}`}>Maximum</span>
          <span className="fed__pair">
            <span className="fi-select fed__op">
              <select className="fi" aria-label={`Field ${n} maximum: comparison`} value={r.hiOp}
                onChange={e => set({ hiOp: e.target.value as DraftRules['hiOp'] })}>
                <option value="maximum">≤</option>
                <option value="exclusiveMaximum">&lt;</option>
              </select>
            </span>
            <input className="fi" type="number" inputMode="numeric" placeholder="None" value={r.hi}
              aria-labelledby={`rule-hi-${f.uid}`} onChange={e => set({ hi: e.target.value })} />
          </span>
        </div>
      </div>
    );
  }
  if (f.type === 'text' || f.type === 'multi-line-text') {
    return (
      <div className="fed__rules" role="group" aria-label={`Field ${n} rules`}>
        {num('Min length', 'minLength')}
        {num('Max length', 'maxLength')}
        <label className="fed__rule fed__rule--wide">
          <span className="fl__label">Pattern (regex)</span>
          <input className="fi mono" placeholder="e.g. ^NV\d{4}$" value={r.pattern} spellCheck={false}
            onChange={e => set({ pattern: e.target.value })} />
        </label>
        {r.pattern.trim() && (
          <label className="fed__rule fed__rule--full">
            <span className="fl__label">Message when the format is wrong</span>
            <input className="fi" placeholder="e.g. Use NV followed by 4 digits, e.g. NV0123." value={r.patternHint} maxLength={200}
              onChange={e => set({ patternHint: e.target.value })} />
          </label>
        )}
      </div>
    );
  }
  return null;
}

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
              <RuleInputs f={f} n={n} set={p => patch(i, { rules: { ...f.rules, ...p } })} />
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
