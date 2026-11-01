import { useRef, useState } from 'react';
import { Ic } from '../ui/icons';

const isoToText = (iso: unknown) => (typeof iso === 'string' && iso ? iso.split('-').reverse().join('/') : '');

/** "dd/mm/yyyy" hợp lệ → "yyyy-mm-dd", ngược lại chuỗi rỗng. */
function textToIso(t: string) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (!m) return '';
  const [d, mo, y] = [+m[1], +m[2], +m[3]];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

/** Ô ngày luôn hiện dd/mm/yyyy, không phụ thuộc ngôn ngữ trình duyệt. Giá trị lưu dạng ISO. */
export function DateInput({ value, onChange, inputProps }: {
  value: string; onChange: (iso: string) => void; inputProps: Record<string, unknown>;
}) {
  const [text, setText] = useState(isoToText(value));
  const [seen, setSeen] = useState(value);
  // giá trị đổi từ ngoài → cập nhật chữ hiển thị
  if (value !== seen) { setSeen(value); setText(isoToText(value)); }
  const picker = useRef<HTMLInputElement>(null);

  const type = (raw: string) => {
    const d = raw.replace(/\D/g, '').slice(0, 8);
    const t = [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join('/');
    const iso = textToIso(t);
    setText(t); setSeen(iso); onChange(iso);
  };
  const pick = (iso: string) => { setText(isoToText(iso)); setSeen(iso); onChange(iso); };

  return (
    <span className="fi-date">
      <input {...inputProps} className="fi" type="text" inputMode="numeric" placeholder="dd/mm/yyyy" autoComplete="off"
        value={text} onChange={e => type(e.target.value)} />
      <button type="button" className="fi-date__btn" aria-label="Pick a date" tabIndex={-1}
        onClick={() => { const el = picker.current; if (el && 'showPicker' in el) el.showPicker(); }}>
        <Ic name="calendar" />
      </button>
      <input ref={picker} className="fi-date__native" type="date" tabIndex={-1} aria-hidden="true" value={value || ''} onChange={e => pick(e.target.value)} />
    </span>
  );
}
