import type { FlowableField } from './types';

const isEmpty = (v: unknown) => v === undefined || v === null || v === '';
const num = (n: number) => n.toLocaleString('en-US');

/**
 * Kiểm tra một trường của form model Flowable (bắt buộc, kiểu, rule) cho renderer tự viết.
 * Cùng luật với JSON Schema mà rjsf / ajv backend kiểm tra; rule và câu báo lỗi nằm trong `params` của trường
 * (params.rules, params.messages), nên hai renderer hiện cùng một câu. Trả về câu lỗi đầu tiên, hoặc null nếu hợp lệ.
 */
export function fieldProblem(f: FlowableField, v: unknown): string | null {
  if (f.readOnly) return null;
  const m = f.params?.messages ?? {};
  const r = f.params?.rules ?? {};
  if (isEmpty(v)) return f.required ? (m.required ?? 'This field is required.') : null;

  switch (f.type) {
    case 'integer': {
      // ô số giữ nguyên chữ khi chưa phải số nguyên (vd. "1.5"), để báo lỗi kiểu
      if (typeof v !== 'number' || !Number.isInteger(v)) return m.type ?? 'Enter a whole number, without decimals or letters.';
      const n = (k: string) => (typeof r[k] === 'number' ? (r[k] as number) : undefined);
      const min = n('minimum'), xmin = n('exclusiveMinimum'), max = n('maximum'), xmax = n('exclusiveMaximum'), step = n('multipleOf');
      if (min !== undefined && v < min) return m.minimum ?? `Enter ${num(min)} or more.`;
      if (xmin !== undefined && v <= xmin) return m.exclusiveMinimum ?? `Enter a number greater than ${num(xmin)}.`;
      if (max !== undefined && v > max) return m.maximum ?? `Enter ${num(max)} or less.`;
      if (xmax !== undefined && v >= xmax) return m.exclusiveMaximum ?? `Enter a number less than ${num(xmax)}.`;
      if (step !== undefined && step > 0 && v % step !== 0) return m.multipleOf ?? `Enter a multiple of ${num(step)}.`;
      return null;
    }
    case 'date':
      return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? null : (m.format ?? 'Enter a valid date as dd/mm/yyyy.');
    case 'dropdown':
    case 'radio-buttons':
      return f.options?.some(o => o.name === v) ? null : (m.enum ?? 'Choose one of the options in the list.');
    case 'boolean':
      return null;
    default: {
      const s = String(v);
      const len = [...s].length; // JSON Schema đếm theo ký tự Unicode, không theo UTF-16
      if (typeof r.minLength === 'number' && len < r.minLength) return m.minLength ?? `Enter at least ${r.minLength} characters.`;
      if (typeof r.maxLength === 'number' && len > r.maxLength) return m.maxLength ?? `Enter no more than ${r.maxLength} characters.`;
      if (typeof r.pattern === 'string' && r.pattern) {
        let ok = true;
        try { ok = new RegExp(r.pattern, 'u').test(s); } catch { /* pattern hỏng: backend đã chặn lúc lưu */ }
        if (!ok) return m.pattern ?? 'This value is not in the expected format.';
      }
      return null;
    }
  }
}
