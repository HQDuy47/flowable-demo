/** Icon nét mảnh kiểu Fluent, vẽ bằng SVG, cỡ theo font chữ. */
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const Icon = {
  add: () => <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" {...P}><path d="M12 5v14M5 12h14" /></svg>,
  approve: () => <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" {...P} strokeWidth={2}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>,
  reject: () => <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="8" /><path d="m9 9 6 6M15 9l-6 6" /></svg>,
  refresh: () => <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" {...P}><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4.5H15" /></svg>,
  send: () => <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" {...P}><path d="M4.5 12 19.5 5l-4 14-3.5-6z" /><path d="M12 13 19.5 5" /></svg>,
  reset: () => <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" {...P}><path d="M5 12a7 7 0 1 0 2-4.9M5 4.5V9h4.5" /></svg>,
  back: () => <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" {...P}><path d="M15 6l-6 6 6 6" /></svg>,
  task: () => <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" {...P}><rect x="4.5" y="4.5" width="15" height="15" rx="2" /><path d="m8.5 12 2.5 2.5 4.5-5" /></svg>,
  doc: () => <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" {...P}><path d="M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z" /><path d="M14 3.5V8h4.5M9 13h6M9 16.5h4" /></svg>,
  lock: () => <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" {...P} strokeWidth={2}><rect x="5.5" y="11" width="13" height="9" rx="1.5" /><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" /></svg>,
  check: () => <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" {...P} strokeWidth={2.2}><path d="m6 12.5 4 4L18 8" /></svg>,
  info: () => <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></svg>,
  error: () => <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5.5M12 16.5h.01" /></svg>,
  success: () => <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12 2.5 2.5 4.5-5" /></svg>,
  menu: () => <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" {...P}><path d="M4 7h16M4 12h16M4 17h16" /></svg>,
  calendar: () => <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" {...P}><rect x="4" y="5.5" width="16" height="14.5" rx="2.5" /><path d="M8 3.5v4M16 3.5v4M4 10h16" /></svg>,
  up: () => <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" {...P}><path d="m6 15 6-6 6 6" /></svg>,
  down: () => <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" {...P}><path d="m6 9 6 6 6-6" /></svg>,
  trash: () => <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" {...P}><path d="M5 7h14M10 7V4.5h4V7M7 7l.8 12.5h8.4L17 7M10.5 11v5M13.5 11v5" /></svg>,
  save: () => <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" {...P}><path d="M5.5 4.5h10l3 3v12h-13z" /><path d="M8.5 4.5v4h6v-4M8.5 19.5v-5h7v5" /></svg>,
  user: () => <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" {...P}><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>,
};

export type IconName = keyof typeof Icon;

export function Ic({ name }: { name: IconName }) {
  const C = Icon[name];
  return <span className="ic" aria-hidden="true"><C /></span>;
}
