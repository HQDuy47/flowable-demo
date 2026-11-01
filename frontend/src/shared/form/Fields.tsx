import { Ic } from '../ui/icons';
import { arrangeFields } from './arrange';
import { DateInput } from './DateInput';
import type { Field } from './types';
import type { FormCtl } from './useDynamicForm';

/** Ô nhập phù hợp với kiểu trường của Flowable. */
function Control({ ctl, f }: { ctl: FormCtl; f: Field }) {
  const id = ctl.idOf(f);
  const err = ctl.error(f);
  const value = ctl.values[f.id];
  const common = {
    id, name: f.id,
    onBlur: () => ctl.touch(f.id),
    'aria-invalid': !!err || undefined,
    'aria-required': f.required || undefined,
    'aria-describedby': `${id}-msg`,
  };
  const on = (v: unknown) => ctl.set(f.id, v);
  switch (f.type) {
    case 'multi-line-text':
      return <textarea {...common} className="fi fi--area" value={value} onChange={e => on(e.target.value)} />;
    case 'integer':
      return <input {...common} className="fi" type="number" inputMode="numeric" value={value} onChange={e => on(e.target.value)} />;
    case 'date':
      return <DateInput value={value ?? ''} onChange={on} inputProps={common} />;
    case 'boolean':
      return <input {...common} className="fi-check" type="checkbox" checked={!!value} onChange={e => on(e.target.checked)} />;
    case 'dropdown':
    case 'radio-buttons':
      return (
        <span className="fi-select">
          <select {...common} className="fi" value={value} onChange={e => on(e.target.value)}>
            <option value="">Select…</option>
            {f.options?.map(o => <option key={o.name}>{o.name}</option>)}
          </select>
        </span>
      );
    default:
      return <input {...common} className="fi" type="text" autoComplete={f.id === 'employeeName' ? 'name' : 'off'} value={value} onChange={e => on(e.target.value)} />;
  }
}

/** Các dòng form nhãn trái, hai cột. Trường chỉ đọc hiện giá trị. */
export function Fields({ ctl, fields }: { ctl: FormCtl; fields?: Field[] }) {
  return (
    <div className="fgrid">
      {arrangeFields(fields ?? ctl.form.fields).map(f => {
        const id = ctl.idOf(f);
        const err = ctl.error(f);
        const wide = f.type === 'multi-line-text';
        if (f.readOnly) {
          return (
            <div key={f.id} className={`fl${wide ? ' fl--wide' : ''}`}>
              <span className="fl__label"><Ic name="lock" />{f.name}</span>
              <span className="fl__value">{String(ctl.values[f.id] ?? '') || <span className="muted">---</span>}</span>
            </div>
          );
        }
        return (
          <div key={f.id} className={`fl${wide ? ' fl--wide' : ''}${err ? ' is-invalid' : ''}`}>
            <label className="fl__label" htmlFor={id}>
              {f.name}{f.required && <span className="req" aria-hidden="true"> *</span>}
            </label>
            <div className="fl__ctl">
              <Control key={ctl.version} ctl={ctl} f={f} />
              <span className="fl__msg" id={`${id}-msg`}>{err}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
