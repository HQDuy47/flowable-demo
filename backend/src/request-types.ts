/**
 * Loại đơn thiết kế từ giao diện. Mọi loại đơn chạy chung MỘT quy trình BPMN (GENERIC_PROCESS_KEY);
 * loại đơn chỉ là dữ liệu cấu hình (tên + danh sách trường, có phiên bản), form lập đơn / form duyệt
 * được dựng từ đó lúc chạy. Toàn bộ là hàm thuần, không gọi Flowable.
 */

export const FIELD_TYPES = ['text', 'multi-line-text', 'integer', 'date', 'dropdown', 'boolean'] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/** Rule kiểm tra của một trường: chính là từ khoá JSON Schema, đưa thẳng vào schema của trường. */
export interface FieldRules {
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number; // "> x"
  exclusiveMaximum?: number; // "< x"
  multipleOf?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  /** Câu báo lỗi khi sai pattern, admin tự viết (vd. "NV followed by 4 digits"). Không phải từ khoá JSON Schema. */
  patternHint?: string;
}

/** Rule dùng được cho từng kiểu trường; kiểu khác không có rule. */
const RULES_FOR: Partial<Record<FieldType, readonly (keyof FieldRules)[]>> = {
  integer: ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf'],
  text: ['minLength', 'maxLength', 'pattern', 'patternHint'],
  'multi-line-text': ['minLength', 'maxLength', 'pattern', 'patternHint'],
};

export interface TypeField {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  rules?: FieldRules;
}

/** Một phiên bản của loại đơn. Đơn đã gửi ghi lại số phiên bản nên luôn đọc đúng form lúc gửi. */
export interface TypeVersion {
  version: number;
  name: string;
  fields: TypeField[];
  savedAt: string;
  savedBy: string;
}

/** Bản thiết kế được lưu thành file JSON. name/fields/version ở ngoài là của phiên bản mới nhất. */
export interface RequestType {
  key: string;
  name: string;
  fields: TypeField[];
  version: number;
  versions: TypeVersion[];
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

/** Dữ liệu frontend gửi lên; trường mới chưa có id. */
export interface RequestTypeInput {
  name: string;
  fields: Array<{ id?: string; name: string; type: string; required?: boolean; options?: string[]; rules?: Record<string, unknown> }>;
}

/** Người duyệt của mọi loại đơn (khớp users.ts). */
export const APPROVER = 'checker';

/** Quy trình chung cho mọi loại đơn. */
export const GENERIC_PROCESS_KEY = 'requestApproval';

/** Biến của process cho biết đơn thuộc loại nào, phiên bản nào. */
export const TYPE_VARS = { key: 'requestType', version: 'requestTypeVersion', name: 'requestTypeName' } as const;

/** Tên biến đã dùng trong quy trình hoặc backend; trường của người dùng không được trùng. */
const RESERVED = new Set(['initiator', 'decision', 'managerComment', '_submission', ...Object.values(TYPE_VARS)]);

/** "Đơn mua thiết bị" → ["don", "mua", "thiet", "bi"] (bỏ dấu, chỉ giữ chữ và số). */
function words(s: string): string[] {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[đĐ]/g, (c) => (c === 'đ' ? 'd' : 'D'))
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

const capital = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

/** Thêm hậu tố 2, 3… cho đến khi không trùng. */
function unique(base: string, taken: Set<string>): string {
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}${n}`;
  taken.add(id);
  return id;
}

/** Khoá loại đơn từ tên: "Đơn mua thiết bị" → "reqDonMuaThietBi". */
export function typeKeyFor(name: string, taken: Set<string>): string {
  const body = words(name).map(capital).join('').slice(0, 40) || 'Request';
  return unique(`req${body}`, taken);
}

/** Id trường (cũng là tên biến của quy trình): "Số tiền (VNĐ)" → "soTienVnd". */
function fieldIdFor(name: string, taken: Set<string>): string {
  const [first = 'field', ...rest] = words(name);
  let base = (first + rest.map(capital).join('')).slice(0, 40);
  if (/^\d/.test(base)) base = `f${base}`;
  if (RESERVED.has(base)) base = `${base}Field`;
  return unique(base, taken);
}

/** Kiểm tra và chuẩn hoá dữ liệu gửi lên. Trường đã có id giữ nguyên id (để đơn cũ vẫn đọc được). */
export function normalize(input: RequestTypeInput): { name: string; fields: TypeField[] } {
  const name = String(input?.name ?? '').trim();
  if (!name) throw new Error('The request type needs a name.');
  if (name.length > 80) throw new Error('The name must be 80 characters or fewer.');
  const raw = Array.isArray(input?.fields) ? input.fields : [];
  if (raw.length === 0) throw new Error('Add at least one field.');
  if (raw.length > 30) throw new Error('A request type can have at most 30 fields.');

  const taken = new Set<string>(RESERVED);
  // id có sẵn được giữ trước, id mới sinh sau để không cướp id cũ
  for (const f of raw) if (f.id) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(f.id) || RESERVED.has(f.id)) throw new Error(`Invalid field id "${f.id}".`);
    if (taken.has(f.id)) throw new Error(`Duplicate field id "${f.id}".`);
    taken.add(f.id);
  }

  const fields = raw.map((f, i): TypeField => {
    const label = String(f.name ?? '').trim();
    if (!label) throw new Error(`Field ${i + 1} needs a label.`);
    if (!(FIELD_TYPES as readonly string[]).includes(f.type)) throw new Error(`Field "${label}" has an unknown type.`);
    const field: TypeField = { id: f.id || fieldIdFor(label, taken), name: label, type: f.type as FieldType, required: !!f.required };
    if (field.type === 'dropdown') {
      const options = [...new Set((f.options ?? []).map((o) => String(o).trim()).filter(Boolean))];
      if (options.length === 0) throw new Error(`Field "${label}" needs at least one option.`);
      field.options = options;
    }
    const rules = rulesOf(label, field.type, f.rules);
    if (rules) field.rules = rules;
    return field;
  });
  return { name, fields };
}

/** Kiểm tra rule của một trường: đúng từ khoá cho kiểu trường, đúng kiểu giá trị, min không lớn hơn max. */
function rulesOf(label: string, type: FieldType, raw: unknown): FieldRules | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`The rules of field "${label}" must be an object.`);
  const allowed = RULES_FOR[type] ?? [];
  const rules: FieldRules = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v == null || v === '') continue; // ô rule để trống
    if (!allowed.includes(k as keyof FieldRules)) throw new Error(`Field "${label}" (${type}) does not support the rule "${k}".`);
    if (k === 'pattern') {
      try {
        new RegExp(String(v), 'u'); // ajv dịch pattern với cờ "u"
      } catch {
        throw new Error(`Field "${label}" has an invalid pattern.`);
      }
      rules.pattern = String(v);
      continue;
    }
    if (k === 'patternHint') {
      const hint = String(v).trim();
      if (hint.length > 200) throw new Error(`The pattern hint of field "${label}" must be 200 characters or fewer.`);
      if (hint) rules.patternHint = hint;
      continue;
    }
    const n = Number(v);
    if (!Number.isFinite(n)) throw new Error(`Rule "${k}" of field "${label}" must be a number.`);
    if ((k === 'minLength' || k === 'maxLength') && (!Number.isInteger(n) || n < 0))
      throw new Error(`Rule "${k}" of field "${label}" must be a whole number of 0 or more.`);
    if (k === 'multipleOf' && n <= 0) throw new Error(`Rule "multipleOf" of field "${label}" must be greater than 0.`);
    rules[k as Exclude<keyof FieldRules, 'pattern' | 'patternHint'>] = n;
  }
  if (!rules.pattern) delete rules.patternHint; // không có pattern thì gợi ý vô nghĩa
  const lo = rules.minimum ?? rules.exclusiveMinimum;
  const hi = rules.maximum ?? rules.exclusiveMaximum;
  if (lo != null && hi != null && lo > hi) throw new Error(`Field "${label}": the minimum is greater than the maximum.`);
  if (rules.minLength != null && rules.maxLength != null && rules.minLength > rules.maxLength)
    throw new Error(`Field "${label}": the minimum length is greater than the maximum length.`);
  return Object.keys(rules).length ? rules : undefined;
}

export type FormKind = 'start' | 'approve';

/** formKey của một form: "<loại đơn>:<phiên bản>:<start|approve>", vd. "leaveRequest:1:approve". */
export const formKeyOf = (key: string, version: number, kind: FormKind) => `${key}:${version}:${kind}`;

/** Tách formKey (vd. lấy từ task Flowable). Sai định dạng thì trả null. */
export function parseFormKey(formKey: unknown): { key: string; version: number; kind: FormKind } | null {
  const m = typeof formKey === 'string' ? /^([A-Za-z0-9_]+):(\d+):(start|approve)$/.exec(formKey) : null;
  return m ? { key: m[1], version: Number(m[2]), kind: m[3] as FormKind } : null;
}

/**
 * Phần mở rộng của một trường, đặt trong `params` vì form model Flowable chỉ nhận đúng các thuộc tính
 * id, name, type, value, required, readOnly, placeholder, layout, overrideId, params (thuộc tính lạ → lỗi deploy).
 * rules = từ khoá JSON Schema (+ patternHint), messages = câu báo lỗi theo từng từ khoá.
 */
export type FieldParams = { rules?: FieldRules; messages?: Record<string, string> };

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
        params: { ...(f.rules ? { rules: f.rules } : {}), messages: errorMessages(f.type, keywords, patternHint) },
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
      ...v.fields.map((f) => ({ fieldType: 'FormField', id: f.id, name: f.name, type: 'text', readOnly: true })),
      { fieldType: 'FormField', id: 'managerComment', name: 'Manager comment', type: 'multi-line-text' },
    ],
    outcomes: [
      { id: 'approve', name: 'Approve' },
      { id: 'reject', name: 'Reject' },
    ],
  };
}

type FormLike = {
  name: string;
  fields: Array<{
    id: string; name: string; type: string; required?: boolean | null; readOnly?: boolean | null;
    options?: { name: string }[] | null; params?: FieldParams | null;
  }>;
};

const num = (n: number) => n.toLocaleString('en-US');

/**
 * Câu báo lỗi dễ hiểu cho từng từ khoá, đặt trong `errorMessage` của trường (cùng quy ước với ajv-errors).
 * rjsf (frontend) và ajv (backend) cùng đọc chỗ này nên người dùng thấy một câu ở cả hai nơi.
 */
function errorMessages(type: string, r: Omit<FieldRules, 'patternHint'>, patternHint?: string) {
  const m: Record<string, string> = { required: 'This field is required.' };
  if (type === 'integer') m.type = 'Enter a whole number, without decimals or letters.';
  if (type === 'date') m.format = 'Enter a valid date as dd/mm/yyyy.';
  if (type === 'dropdown' || type === 'radio-buttons') m.enum = 'Choose one of the options in the list.';
  if (r.minimum != null) m.minimum = `Enter ${num(r.minimum)} or more.`;
  if (r.exclusiveMinimum != null) m.exclusiveMinimum = `Enter a number greater than ${num(r.exclusiveMinimum)}.`;
  if (r.maximum != null) m.maximum = `Enter ${num(r.maximum)} or less.`;
  if (r.exclusiveMaximum != null) m.exclusiveMaximum = `Enter a number less than ${num(r.exclusiveMaximum)}.`;
  if (r.multipleOf != null) m.multipleOf = `Enter a multiple of ${num(r.multipleOf)}.`;
  if (r.minLength != null) m.minLength = `Enter at least ${r.minLength} characters.`;
  if (r.maxLength != null) m.maxLength = `Enter no more than ${r.maxLength} characters.`;
  if (r.pattern) m.pattern = patternHint || 'This value is not in the expected format.';
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
    if (f.type === 'dropdown' || f.type === 'radio-buttons') p.enum = (f.options ?? []).map((o) => o.name);
    if (f.type === 'multi-line-text') uiSchema[f.id] = { 'ui:widget': 'textarea' };
    const { patternHint, ...keywords } = f.params?.rules ?? {};
    Object.assign(p, keywords); // rule đã là từ khoá JSON Schema
    if (!f.readOnly) p.errorMessage = errorMessages(f.type, keywords, patternHint);
    properties[f.id] = p;
  }
  return {
    schema: {
      title: form.name,
      type: 'object',
      required: form.fields.filter((f) => f.required && !f.readOnly).map((f) => f.id),
      properties,
    },
    uiSchema,
  };
}

/**
 * Quy trình chung: lập đơn → trưởng phòng duyệt → rẽ nhánh theo biến "decision".
 * formKey của user task là biểu thức, Flowable tính lúc tạo task từ biến của đơn
 * → "leaveRequest:1:approve"; backend tra form theo chuỗi đó (RequestTypesService.formByKey).
 * startEvent không gắn formKey: form lập đơn hiện trước khi có biến, nên chọn theo loại đơn người dùng bấm.
 */
export const GENERIC_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xmlns:flowable="http://flowable.org/bpmn"
             targetNamespace="http://seatech.demo/request-types">
  <process id="${GENERIC_PROCESS_KEY}" name="Request approval" isExecutable="true">
    <startEvent id="start" />
    <sequenceFlow id="f1" sourceRef="start" targetRef="managerApprove" />
    <userTask id="managerApprove" name="Manager approval" flowable:assignee="${APPROVER}"
              flowable:formKey="\${${TYPE_VARS.key}}:\${${TYPE_VARS.version}}:approve" />
    <sequenceFlow id="f2" sourceRef="managerApprove" targetRef="gw" />
    <exclusiveGateway id="gw" />
    <sequenceFlow id="f3" sourceRef="gw" targetRef="approvedEnd">
      <conditionExpression xsi:type="tFormalExpression">\${decision == 'approve'}</conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="f4" sourceRef="gw" targetRef="rejectedEnd">
      <conditionExpression xsi:type="tFormalExpression">\${decision == 'reject'}</conditionExpression>
    </sequenceFlow>
    <endEvent id="approvedEnd" name="Approved" />
    <endEvent id="rejectedEnd" name="Rejected" />
  </process>
</definitions>
`;
