/**
 * Form của một phiên bản loại đơn: formKey, form definition kiểu Flowable (cách 1) và JSON Schema (cách 2).
 * Toàn bộ là hàm thuần.
 */
import type { FieldRules, TypeVersion } from '../request-types/request-type.model.js';

export type FormKind = 'start' | 'approve';

/** formKey của một form: "<loại đơn>:<phiên bản>:<start|approve>", vd. "leaveRequest:1:approve". */
export const formKeyOf = (key: string, version: number, kind: FormKind) =>
  `${key}:${version}:${kind}`;

/** Tách formKey (vd. lấy từ task Flowable). Sai định dạng thì trả null. */
export function parseFormKey(
  formKey: unknown,
): { key: string; version: number; kind: FormKind } | null {
  const m =
    typeof formKey === 'string'
      ? /^([A-Za-z0-9_]+):(\d+):(start|approve)$/.exec(formKey)
      : null;
  return m
    ? { key: m[1], version: Number(m[2]), kind: m[3] as FormKind }
    : null;
}

/**
 * Phần mở rộng của một trường, đặt trong `params` vì form model Flowable chỉ nhận đúng các thuộc tính
 * id, name, type, value, required, readOnly, placeholder, layout, overrideId, params (thuộc tính lạ → lỗi deploy).
 * rules = từ khoá JSON Schema (+ patternHint), messages = câu báo lỗi theo từng từ khoá.
 */
export type FieldParams = {
  rules?: FieldRules;
  messages?: Record<string, string>;
};

/** Form definition kiểu Flowable (file .form): deploy lên form engine, renderer tự viết vẽ thẳng từ đây. */
export interface FormDefinition {
  key: string;
  name: string;
  fields: Array<{
    /** "FormField" | "OptionFormField" (dropdown) */
    fieldType: string;
    id: string;
    name: string;
    type: string;
    required?: boolean;
    readOnly?: boolean;
    options?: { name: string }[];
    params?: FieldParams;
  }>;
  outcomes?: { id: string; name: string }[];
}

/** Form lập đơn của một phiên bản loại đơn, ở định dạng form definition của Flowable. */
export function startForm(key: string, v: TypeVersion): FormDefinition {
  return {
    key: formKeyOf(key, v.version, 'start'),
    name: v.name,
    fields: v.fields.map((f) => {
      const { patternHint, ...keywords } = f.rules ?? {};
      return {
        fieldType: f.type === 'dropdown' ? 'OptionFormField' : 'FormField',
        id: f.id,
        name: f.name,
        type: f.type,
        required: f.required,
        ...(f.options ? { options: f.options.map((o) => ({ name: o })) } : {}),
        params: {
          ...(f.rules ? { rules: f.rules } : {}),
          messages: errorMessages(f.type, keywords, patternHint),
        },
      };
    }),
    outcomes: [],
  };
}

/** Form duyệt: nhắc lại các trường ở dạng chỉ đọc, thêm ô ý kiến và hai kết quả. */
export function approveForm(key: string, v: TypeVersion): FormDefinition {
  return {
    key: formKeyOf(key, v.version, 'approve'),
    name: `Approve: ${v.name}`,
    fields: [
      ...v.fields.map((f) => ({
        fieldType: 'FormField',
        id: f.id,
        name: f.name,
        type: 'text',
        readOnly: true,
      })),
      {
        fieldType: 'FormField',
        id: 'managerComment',
        name: 'Manager comment',
        type: 'multi-line-text',
      },
    ],
    outcomes: [
      { id: 'approve', name: 'Approve' },
      { id: 'reject', name: 'Reject' },
    ],
  };
}

/** Hai form (lập đơn, duyệt) của một phiên bản. */
export const formsOf = (key: string, v: TypeVersion) => [
  startForm(key, v),
  approveForm(key, v),
];

type FormLike = {
  name: string;
  fields: Array<{
    id: string;
    name: string;
    type: string;
    required?: boolean | null;
    readOnly?: boolean | null;
    options?: { name: string }[] | null;
    params?: FieldParams | null;
  }>;
};

const num = (n: number) => n.toLocaleString('en-US');

/**
 * Câu báo lỗi dễ hiểu cho từng từ khoá, đặt trong `errorMessage` của trường (cùng quy ước với ajv-errors).
 * rjsf (frontend) và ajv (backend) cùng đọc chỗ này nên người dùng thấy một câu ở cả hai nơi.
 */
function errorMessages(
  type: string,
  r: Omit<FieldRules, 'patternHint'>,
  patternHint?: string,
) {
  const m: Record<string, string> = { required: 'This field is required.' };
  if (type === 'integer')
    m.type = 'Enter a whole number, without decimals or letters.';
  if (type === 'date') m.format = 'Enter a valid date as dd/mm/yyyy.';
  if (type === 'dropdown' || type === 'radio-buttons')
    m.enum = 'Choose one of the options in the list.';
  if (r.minimum != null) m.minimum = `Enter ${num(r.minimum)} or more.`;
  if (r.exclusiveMinimum != null)
    m.exclusiveMinimum = `Enter a number greater than ${num(r.exclusiveMinimum)}.`;
  if (r.maximum != null) m.maximum = `Enter ${num(r.maximum)} or less.`;
  if (r.exclusiveMaximum != null)
    m.exclusiveMaximum = `Enter a number less than ${num(r.exclusiveMaximum)}.`;
  if (r.multipleOf != null)
    m.multipleOf = `Enter a multiple of ${num(r.multipleOf)}.`;
  if (r.minLength != null)
    m.minLength = `Enter at least ${r.minLength} characters.`;
  if (r.maxLength != null)
    m.maxLength = `Enter no more than ${r.maxLength} characters.`;
  if (r.pattern)
    m.pattern = patternHint || 'This value is not in the expected format.';
  return m;
}

/**
 * Form definition (lấy từ Flowable theo formKey, hoặc bản nháp của trang Preview) → JSON Schema
 * (dữ liệu hợp lệ trông thế nào) + uiSchema (hiển thị ra sao),
 * cho react-jsonschema-form. Vẫn tra theo formKey nên đúng phiên bản loại đơn của từng đơn.
 */
export function toJsonSchema(form: FormLike) {
  const properties: Record<string, Record<string, unknown>> = {};
  const uiSchema: Record<string, Record<string, unknown>> = {};
  for (const f of form.fields) {
    const p: Record<string, unknown> = { title: f.name, type: 'string' };
    if (f.readOnly) p.readOnly = true;
    if (f.type === 'integer') p.type = 'integer';
    if (f.type === 'boolean') p.type = 'boolean';
    if (f.type === 'date') p.format = 'date';
    if (f.type === 'dropdown' || f.type === 'radio-buttons')
      p.enum = (f.options ?? []).map((o) => o.name);
    if (f.type === 'multi-line-text')
      uiSchema[f.id] = { 'ui:widget': 'textarea' };
    const { patternHint, ...keywords } = f.params?.rules ?? {};
    Object.assign(p, keywords); // rule đã là từ khoá JSON Schema
    if (!f.readOnly)
      p.errorMessage = errorMessages(f.type, keywords, patternHint);
    properties[f.id] = p;
  }
  return {
    schema: {
      title: form.name,
      type: 'object',
      required: form.fields
        .filter((f) => f.required && !f.readOnly)
        .map((f) => f.id),
      properties,
    },
    uiSchema,
  };
}
