const pad = (n: number) => String(n).padStart(2, '0');
/** ISO → "31/10/2026 14:55" */
export const fmtTime = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** "2026-11-03" → "03/11/2026"; giá trị khác giữ nguyên */
export const fmtValue = (v: unknown) => {
  if (v == null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Có' : 'Không';
  const s = String(v);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
};

export const shortId = (id: string) => '#' + id.slice(0, 8).toUpperCase();
