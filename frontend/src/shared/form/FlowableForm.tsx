import { useId, useImperativeHandle, useState, type Ref } from 'react';
import { Ic } from '../ui/icons';
import { DateInput } from './DateInput';
import type { FlowableField, FlowableFormModel, FormValues } from './types';
import { fieldProblem } from './validate';

export type FlowableFormRef = { validate: () => boolean };

type FieldProps = {
  f: FlowableField; id: string; value: unknown; invalid: boolean;
  onChange: (v: unknown) => void;
};

/**
 * Giá trị lưu giống rjsf để chuyển qua lại giữa hai renderer không mất dữ liệu:
 * ô trống → undefined, ô số hợp lệ → number, ô số chưa hợp lệ giữ nguyên chữ (để báo lỗi kiểu).
 */
const blankToUndef = (s: string) => (s === '' ? undefined : s);
const toInteger = (s: string) => (s === '' ? undefined : /^-?\d+$/.test(s) ? Number(s) : s);

const aria = ({ f, id, invalid }: FieldProps) => ({
  id, name: f.id,
  'aria-invalid': invalid || undefined,
  'aria-required': f.required || undefined,
  'aria-describedby': `${id}__error`,
});

/* ---------- Mỗi kiểu ô một component ---------- */

function TextField(p: FieldProps) {
  return <input {...aria(p)} className="fi" type="text" autoComplete={p.f.id === 'employeeName' ? 'name' : 'off'}
    value={String(p.value ?? '')} onChange={e => p.onChange(blankToUndef(e.target.value))} />;
}

function MultiLineTextField(p: FieldProps) {
  return <textarea {...aria(p)} className="fi fi--area"
    value={String(p.value ?? '')} onChange={e => p.onChange(blankToUndef(e.target.value))} />;
}

function IntegerField(p: FieldProps) {
  return <input {...aria(p)} className="fi" type="number" inputMode="numeric" step={1}
    value={p.value == null ? '' : String(p.value)} onChange={e => p.onChange(toInteger(e.target.value))} />;
}

function DateField(p: FieldProps) {
  return <DateInput value={typeof p.value === 'string' ? p.value : ''} onChange={iso => p.onChange(iso || undefined)} inputProps={aria(p)} />;
}

function DropdownField(p: FieldProps) {
  return (
    <span className="fi-select">
      <select {...aria(p)} className="fi" value={String(p.value ?? '')} onChange={e => p.onChange(blankToUndef(e.target.value))}>
        <option value="">Select…</option>
        {p.f.options?.map(o => <option key={o.name} value={o.name}>{o.name}</option>)}
      </select>
    </span>
  );
}

function BooleanField(p: FieldProps) {
  return <input {...aria(p)} className="fi-check" type="checkbox" checked={p.value === true} onChange={e => p.onChange(e.target.checked)} />;
}

/** Bảng kiểu trường Flowable → component. Kiểu lạ thì vẽ như ô chữ. */
const CONTROLS: Record<string, (p: FieldProps) => React.JSX.Element> = {
  text: TextField,
  'multi-line-text': MultiLineTextField,
  integer: IntegerField,
  date: DateField,
  dropdown: DropdownField,
  'radio-buttons': DropdownField,
  boolean: BooleanField,
};

/** Giá trị của trường chỉ đọc, dạng dễ đọc. */
function shown(f: FlowableField, v: unknown) {
  if (v === undefined || v === null || v === '') return <span className="muted">---</span>;
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v.split('-').reverse().join('/');
  if (typeof v === 'number' && f.type === 'integer') return v.toLocaleString('en-US');
  return String(v);
}

/**
 * Renderer tự viết: vẽ thẳng từ form model kiểu Flowable (fields: id, name, type, required, readOnly, options, rules),
 * không qua JSON Schema. Dùng chung khung .fl/.fi với SchemaForm nên hai cách trông giống nhau.
 * Nút gửi nằm ngoài form nên gọi ref.current.validate() trước khi gửi.
 */
export function FlowableForm({ form, data, onChange, ref }: {
  form: FlowableFormModel; data: FormValues; onChange: (data: FormValues) => void; ref?: Ref<FlowableFormRef>;
}) {
  const uid = useId();
  // bấm gửi lần đầu xong mới kiểm tra theo từng phím, giống SchemaForm
  const [live, setLive] = useState(false);
  const idOf = (f: FlowableField) => `${uid}-${f.id}`;

  useImperativeHandle(ref, () => ({
    validate() {
      setLive(true);
      const bad = form.fields.find(f => fieldProblem(f, data[f.id]));
      if (bad) document.getElementById(idOf(bad))?.focus();
      return !bad;
    },
  }));

  return (
    <div className="fgrid">
      {form.fields.map(f => {
        const id = idOf(f);
        const wide = f.type === 'multi-line-text';
        if (f.readOnly) {
          return (
            <div key={f.id} className={`fl${wide ? ' fl--wide' : ''}`}>
              <span className="fl__label"><Ic name="lock" />{f.name}</span>
              <span className="fl__value">{shown(f, data[f.id])}</span>
            </div>
          );
        }
        const err = live ? fieldProblem(f, data[f.id]) : null;
        const Control = CONTROLS[f.type] ?? TextField;
        return (
          <div key={f.id} className={`fl${wide ? ' fl--wide' : ''}${err ? ' is-invalid' : ''}`}>
            <label className="fl__label" htmlFor={id}>
              {f.name}{f.required && <span className="req" aria-hidden="true"> *</span>}
            </label>
            <div className="fl__ctl">
              <Control f={f} id={id} value={data[f.id]} invalid={!!err} onChange={v => onChange({ ...data, [f.id]: v })} />
              <span className="fl__msg" id={`${id}__error`}>{err}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
