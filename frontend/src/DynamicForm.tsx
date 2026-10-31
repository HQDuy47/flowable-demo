import { useState } from 'react';

export type Field = {
  id: string; name: string; type: string;
  required?: boolean; readOnly?: boolean; value?: any;
  options?: { name: string }[];
};
export type FormModel = { name?: string; fields: Field[]; outcomes?: { id: string; name: string }[] };

function renderField(f: Field, value: any, onChange: (v: any) => void) {
  if (f.readOnly) return <div className="readonly">{String(value ?? '') || '—'}</div>;
  switch (f.type) {
    case 'multi-line-text': return <textarea id={f.id} value={value} onChange={e => onChange(e.target.value)} />;
    case 'integer':         return <input id={f.id} type="number" value={value} onChange={e => onChange(e.target.value)} />;
    case 'date':            return <input id={f.id} type="date" value={value} onChange={e => onChange(e.target.value)} />;
    case 'boolean':         return <input id={f.id} type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} />;
    case 'dropdown':
    case 'radio-buttons':
      return (
        <select id={f.id} value={value} onChange={e => onChange(e.target.value)}>
          <option value="">-- Chọn --</option>
          {f.options?.map(o => <option key={o.name}>{o.name}</option>)}
        </select>
      );
    default:                return <input id={f.id} value={value} onChange={e => onChange(e.target.value)} />;
  }
}

export function DynamicForm({ form, onSubmit, onError, hideReadOnly, submitLabel = 'Gửi' }: {
  form: FormModel;
  onSubmit: (values: Record<string, any>, outcome?: string) => Promise<void>;
  onError: (msg: string) => void;
  /** Ẩn các ô chỉ-đọc (khi thông tin đơn đã hiện ở chỗ khác) */
  hideReadOnly?: boolean;
  submitLabel?: string;
}) {
  const [values, setValues] = useState<Record<string, any>>(() =>
    Object.fromEntries(form.fields.map(f => [f.id, f.value ?? (f.type === 'boolean' ? false : '')]))
  );
  const [busy, setBusy] = useState(false);

  const submit = async (outcome?: string) => {
    const missing = form.fields.filter(f => f.required && !f.readOnly && !values[f.id]);
    if (missing.length) return onError('Còn thiếu: ' + missing.map(f => f.name).join(', '));
    // chỉ gửi các ô user được sửa
    const editable = Object.fromEntries(form.fields.filter(f => !f.readOnly).map(f => [f.id, values[f.id]]));
    setBusy(true);
    try { await onSubmit(editable, outcome); } finally { setBusy(false); }
  };

  const fields = hideReadOnly ? form.fields.filter(f => !f.readOnly) : form.fields;

  return (
    <div className="form">
      <div className="form-grid">
        {fields.map(f => (
          <label key={f.id} className={'field' + (f.type === 'multi-line-text' ? ' field-wide' : '')}>
            <span>{f.name}{f.required && <em className="req"> *</em>}</span>
            {renderField(f, values[f.id], v => setValues(p => ({ ...p, [f.id]: v })))}
          </label>
        ))}
      </div>
      <div className="actions">
        {form.outcomes?.length
          ? form.outcomes.map((o, i) => (
              <button key={o.id} disabled={busy} className={i === 0 ? 'btn' : 'btn btn-ghost'} onClick={() => submit(o.id)}>{o.name}</button>
            ))
          : <button className="btn" disabled={busy} onClick={() => submit()}>{submitLabel}</button>}
      </div>
    </div>
  );
}
