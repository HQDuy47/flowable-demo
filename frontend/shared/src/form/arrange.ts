/**
 * Thứ tự hiển thị các trường form hai cột: trường đầu tiên, rồi các ô chọn (dropdown),
 * cặp Từ ngày | Đến ngày luôn nằm cùng một hàng, ô nhiều dòng xuống cuối.
 */
export function arrangeFields<T extends { id: string; type: string }>(fields: T[]): T[] {
  const wide = fields.filter(f => f.type === 'multi-line-text');
  const normal = fields.filter(f => f.type !== 'multi-line-text');
  const from = normal.find(f => f.id === 'fromDate');
  const to = normal.find(f => f.id === 'toDate');
  const others = normal.filter(f => f !== from && f !== to);
  const [first, ...more] = others;
  const picks = more.filter(f => f.type === 'dropdown' || f.type === 'radio-buttons');
  const rest = [first, ...picks, ...more.filter(f => !picks.includes(f))].filter(Boolean) as T[];
  if (!from || !to) return [...rest, ...(from ? [from] : []), ...(to ? [to] : []), ...wide];
  return [...rest.slice(0, 2), from, to, ...rest.slice(2), ...wide];
}
