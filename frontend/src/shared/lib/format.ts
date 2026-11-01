const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-11-03" hoặc ISO đầy đủ → "03/11/2026" */
export function date(v: unknown): string {
  if (typeof v !== 'string' || !v) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(v);
  return isNaN(+d) ? v : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** ISO → "08:04" */
export function time(v: unknown): string {
  if (typeof v !== 'string' || !v) return '';
  const d = new Date(v);
  return isNaN(+d) ? '' : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Mã đơn ngắn, lấy từ id tiến trình của Flowable. */
export const code = (id: string) => id.slice(0, 8).toUpperCase();

/** Chữ viết tắt cho ô tròn: "Nguyễn Văn An" → "VA". */
export const initials = (s: string) =>
  s.split(' ').filter(Boolean).slice(-2).map(w => w[0]).join('').toUpperCase();

/** Thông điệp đọc được từ một lỗi bất kỳ (lỗi HTTP đã được http.ts chuẩn hoá). */
export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
