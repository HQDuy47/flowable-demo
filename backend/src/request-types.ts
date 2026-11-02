/**
 * Loại đơn thiết kế từ giao diện. Mọi loại đơn chạy chung MỘT quy trình BPMN (GENERIC_PROCESS_KEY);
 * loại đơn chỉ là dữ liệu cấu hình (tên + danh sách trường, có phiên bản), form lập đơn / form duyệt
 * được dựng từ đó lúc chạy. Toàn bộ là hàm thuần, không gọi Flowable.
 */

export const FIELD_TYPES = ['text', 'multi-line-text', 'integer', 'date', 'dropdown', 'boolean'] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export interface TypeField {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  options?: string[];
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
  fields: Array<{ id?: string; name: string; type: string; required?: boolean; options?: string[] }>;
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
    return field;
  });
  return { name, fields };
}

export type FormKind = 'start' | 'approve';

/** formKey của một form: "<loại đơn>:<phiên bản>:<start|approve>", vd. "leaveRequest:1:approve". */
export const formKeyOf = (key: string, version: number, kind: FormKind) => `${key}:${version}:${kind}`;

/** Tách formKey (vd. lấy từ task Flowable). Sai định dạng thì trả null. */
export function parseFormKey(formKey: unknown): { key: string; version: number; kind: FormKind } | null {
  const m = typeof formKey === 'string' ? /^([A-Za-z0-9_]+):(\d+):(start|approve)$/.exec(formKey) : null;
  return m ? { key: m[1], version: Number(m[2]), kind: m[3] as FormKind } : null;
}

/** Form lập đơn (cùng hình dạng form model của Flowable mà frontend đang vẽ). */
export function startForm(key: string, v: TypeVersion) {
  return {
    key: formKeyOf(key, v.version, 'start'),
    name: v.name,
    fields: v.fields.map((f) => ({
      fieldType: f.type === 'dropdown' ? 'OptionFormField' : 'FormField',
      id: f.id,
      name: f.name,
      type: f.type,
      required: f.required,
      ...(f.options ? { options: f.options.map((o) => ({ name: o })) } : {}),
    })),
  };
}

/** Form duyệt: nhắc lại các trường ở dạng chỉ đọc, thêm ô ý kiến và hai kết quả. */
export function approveForm(key: string, v: TypeVersion) {
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
