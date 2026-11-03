import { useSyncExternalStore } from 'react';
import type { FormRenderer } from './types';

const STORAGE_KEY = 'formRenderer';
const listeners = new Set<() => void>();

function load(): FormRenderer {
  try { return localStorage.getItem(STORAGE_KEY) === 'flowable' ? 'flowable' : 'rjsf'; } catch { return 'rjsf'; }
}
let current = load();

function setRenderer(next: FormRenderer) {
  current = next;
  try { localStorage.setItem(STORAGE_KEY, next); } catch { /* chế độ riêng tư: chỉ nhớ trong tab */ }
  listeners.forEach(l => l());
}

/** Renderer đang chọn, dùng chung cho màn New request và Approvals; nhớ trong localStorage của trình duyệt. */
export function useFormRenderer(): [FormRenderer, (r: FormRenderer) => void] {
  const value = useSyncExternalStore(
    l => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => current,
  );
  return [value, setRenderer];
}

const OPTIONS: { id: FormRenderer; label: string; hint: string }[] = [
  { id: 'flowable', label: 'Flowable form', hint: 'Form definition from the Flowable form engine, drawn by a custom React renderer' },
  { id: 'rjsf', label: 'JSON Schema', hint: 'JSON Schema stored by form key, drawn by react-jsonschema-form' },
];

/** Nút chuyển giữa hai cách vẽ form, để demo cạnh nhau. */
export function RendererSwitch() {
  const [renderer, set] = useFormRenderer();
  return (
    <div className="rswitch" role="group" aria-label="Form renderer">
      {OPTIONS.map(o => (
        <button key={o.id} type="button" className="rswitch__item" aria-pressed={renderer === o.id} title={o.hint} onClick={() => set(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Chữ mô tả renderer, cho phần Summary / Processing. */
export const RENDERER_LABEL: Record<FormRenderer, string> = {
  flowable: 'Custom React renderer',
  rjsf: 'react-jsonschema-form',
};

/** Form lấy từ đâu (theo formKey), cho phần Summary / Processing. */
export const RENDERER_SOURCE: Record<FormRenderer, string> = {
  flowable: 'Flowable form engine (form-api)',
  rjsf: 'JSON Schema table app.form_schemas',
};
