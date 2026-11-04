/**
 * Loại đơn thiết kế từ giao diện. Mọi loại đơn chạy chung MỘT quy trình BPMN (GENERIC_PROCESS_KEY);
 * loại đơn chỉ là dữ liệu cấu hình (tên + danh sách trường, có phiên bản), form lập đơn / form duyệt
 * được dựng từ đó lúc chạy. Toàn bộ là hàm thuần, không gọi Flowable.
 */
import { TYPE_VARS } from '../workflow/bpmn.js';

export const FIELD_TYPES = [
  'text',
  'multi-line-text',
  'integer',
  'date',
  'dropdown',
  'boolean',
] as const;
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
  integer: [
    'minimum',
    'maximum',
    'exclusiveMinimum',
    'exclusiveMaximum',
    'multipleOf',
  ],
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
  fields: Array<{
    id?: string;
    name: string;
    type: string;
    required?: boolean;
    options?: string[];
    rules?: Record<string, unknown>;
  }>;
}

/** Tên biến đã dùng trong quy trình hoặc backend; trường của người dùng không được trùng. */
const RESERVED = new Set([
  'initiator',
  'decision',
  'managerComment',
  '_submission',
  ...Object.values(TYPE_VARS),
]);

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
export function normalize(input: RequestTypeInput): {
  name: string;
  fields: TypeField[];
} {
  const name = String(input?.name ?? '').trim();
  if (!name) throw new Error('The request type needs a name.');
  if (name.length > 80)
    throw new Error('The name must be 80 characters or fewer.');
  const raw = Array.isArray(input?.fields) ? input.fields : [];
  if (raw.length === 0) throw new Error('Add at least one field.');
  if (raw.length > 30)
    throw new Error('A request type can have at most 30 fields.');

  const taken = new Set<string>(RESERVED);
  // id có sẵn được giữ trước, id mới sinh sau để không cướp id cũ
  for (const f of raw)
    if (f.id) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(f.id) || RESERVED.has(f.id))
        throw new Error(`Invalid field id "${f.id}".`);
      if (taken.has(f.id)) throw new Error(`Duplicate field id "${f.id}".`);
      taken.add(f.id);
    }

  const fields = raw.map((f, i): TypeField => {
    const label = String(f.name ?? '').trim();
    if (!label) throw new Error(`Field ${i + 1} needs a label.`);
    if (!(FIELD_TYPES as readonly string[]).includes(f.type))
      throw new Error(`Field "${label}" has an unknown type.`);
    const field: TypeField = {
      id: f.id || fieldIdFor(label, taken),
      name: label,
      type: f.type as FieldType,
      required: !!f.required,
    };
    if (field.type === 'dropdown') {
      const options = [
        ...new Set(
          (f.options ?? []).map((o) => String(o).trim()).filter(Boolean),
        ),
      ];
      if (options.length === 0)
        throw new Error(`Field "${label}" needs at least one option.`);
      field.options = options;
    }
    const rules = rulesOf(label, field.type, f.rules);
    if (rules) field.rules = rules;
    return field;
  });
  return { name, fields };
}

/** Kiểm tra rule của một trường: đúng từ khoá cho kiểu trường, đúng kiểu giá trị, min không lớn hơn max. */
function rulesOf(
  label: string,
  type: FieldType,
  raw: unknown,
): FieldRules | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw))
    throw new Error(`The rules of field "${label}" must be an object.`);
  const allowed = RULES_FOR[type] ?? [];
  const rules: FieldRules = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v == null || v === '') continue; // ô rule để trống
    if (!allowed.includes(k as keyof FieldRules))
      throw new Error(
        `Field "${label}" (${type}) does not support the rule "${k}".`,
      );
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
      if (hint.length > 200)
        throw new Error(
          `The pattern hint of field "${label}" must be 200 characters or fewer.`,
        );
      if (hint) rules.patternHint = hint;
      continue;
    }
    const n = Number(v);
    if (!Number.isFinite(n))
      throw new Error(`Rule "${k}" of field "${label}" must be a number.`);
    if (
      (k === 'minLength' || k === 'maxLength') &&
      (!Number.isInteger(n) || n < 0)
    )
      throw new Error(
        `Rule "${k}" of field "${label}" must be a whole number of 0 or more.`,
      );
    if (k === 'multipleOf' && n <= 0)
      throw new Error(
        `Rule "multipleOf" of field "${label}" must be greater than 0.`,
      );
    rules[k as Exclude<keyof FieldRules, 'pattern' | 'patternHint'>] = n;
  }
  if (!rules.pattern) delete rules.patternHint; // không có pattern thì gợi ý vô nghĩa
  const lo = rules.minimum ?? rules.exclusiveMinimum;
  const hi = rules.maximum ?? rules.exclusiveMaximum;
  if (lo != null && hi != null && lo > hi)
    throw new Error(
      `Field "${label}": the minimum is greater than the maximum.`,
    );
  if (
    rules.minLength != null &&
    rules.maxLength != null &&
    rules.minLength > rules.maxLength
  )
    throw new Error(
      `Field "${label}": the minimum length is greater than the maximum length.`,
    );
  return Object.keys(rules).length ? rules : undefined;
}
