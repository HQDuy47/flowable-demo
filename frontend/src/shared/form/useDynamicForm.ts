import { useId, useState } from 'react';
import type { Field, FormModel, FormValues } from './types';

const empty = (v: unknown) => v === undefined || v === null || v === '' || v === false;
const initial = (form: FormModel): FormValues =>
  Object.fromEntries(form.fields.map(f => [f.id, f.value ?? (f.type === 'boolean' ? false : '')]));

/**
 * Trạng thái của một form Flowable: giá trị, lỗi, kiểm tra. Tách khỏi phần vẽ để nút nằm ngoài form
 * (hàng nút trên cùng, hộp thoại) cũng gửi được. Đổi form thì đặt `key` cho component dùng hook này.
 */
export function useDynamicForm(form: FormModel) {
  const uid = useId();
  const [values, setValues] = useState<FormValues>(() => initial(form));
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  // tăng mỗi lần Nhập lại, để các ô nhập (kể cả chữ đang gõ dở) được tạo lại từ đầu
  const [version, setVersion] = useState(0);

  const problem = (f: Field): string | null => {
    if (f.readOnly) return null;
    if (f.required && empty(values[f.id])) return f.type === 'date' ? 'Enter a date as dd/mm/yyyy.' : 'This field is required.';
    if (f.id === 'toDate' && values.fromDate && values.toDate && values.toDate < values.fromDate)
      return 'The end date must be on or after the start date.';
    return null;
  };
  const editable = form.fields.filter(f => !f.readOnly);

  return {
    form,
    values,
    version,
    idOf: (f: Field) => `${uid}-${f.id}`,
    set: (id: string, v: unknown) => setValues(p => ({ ...p, [id]: v })),
    touch: (id: string) => setTouched(t => ({ ...t, [id]: true })),
    error: (f: Field) => (touched[f.id] ? problem(f) : null),
    /** Đánh dấu tất cả đã chạm, focus ô lỗi đầu tiên. Trả về true nếu hợp lệ. */
    validate() {
      setTouched(Object.fromEntries(form.fields.map(f => [f.id, true])));
      const bad = form.fields.find(f => problem(f));
      if (bad) document.getElementById(`${uid}-${bad.id}`)?.focus();
      return !bad;
    },
    /** Chỉ gửi các ô người dùng được sửa. */
    payload: (): FormValues => Object.fromEntries(editable.map(f => [f.id, values[f.id]])),
    reset() { setValues(initial(form)); setTouched({}); setVersion(v => v + 1); },
  };
}

export type FormCtl = ReturnType<typeof useDynamicForm>;
