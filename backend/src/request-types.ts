/**
 * Loại đơn thiết kế từ giao diện: từ một bản thiết kế (tên + danh sách trường) sinh ra
 * form lập đơn, form duyệt và quy trình BPMN "lập đơn → trưởng phòng duyệt → kết thúc".
 * Toàn bộ là hàm thuần, không gọi Flowable.
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

/** Bản thiết kế được lưu thành file JSON. */
export interface RequestType {
  key: string;
  name: string;
  fields: TypeField[];
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

/** Dữ liệu frontend gửi lên; trường mới chưa có id. */
export interface RequestTypeInput {
  name: string;
  fields: Array<{ id?: string; name: string; type: string; required?: boolean; options?: string[] }>;
}

/** Người duyệt của mọi loại đơn thiết kế từ giao diện (khớp users.ts). */
export const APPROVER = 'checker';

/** Tên biến đã dùng trong quy trình hoặc backend; trường của người dùng không được trùng. */
const RESERVED = new Set(['initiator', 'decision', 'managerComment', '_submission']);

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

/** Khoá quy trình từ tên loại đơn: "Đơn mua thiết bị" → "reqDonMuaThietBi". */
export function processKeyFor(name: string, taken: Set<string>): string {
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

export const startFormKey = (key: string) => `${key}Start`;
export const approveFormKey = (key: string) => `${key}Approve`;

/** Form lập đơn (định dạng .form của Flowable). */
export function startForm(rt: RequestType) {
  return {
    key: startFormKey(rt.key),
    name: rt.name,
    fields: rt.fields.map((f) => ({
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
export function approveForm(rt: RequestType) {
  return {
    key: approveFormKey(rt.key),
    name: `Approve: ${rt.name}`,
    fields: [
      ...rt.fields.map((f) => ({ fieldType: 'FormField', id: f.id, name: f.name, type: 'text', readOnly: true })),
      { fieldType: 'FormField', id: 'managerComment', name: 'Manager comment', type: 'multi-line-text' },
    ],
    outcomes: [
      { id: 'approve', name: 'Approve' },
      { id: 'reject', name: 'Reject' },
    ],
  };
}

const xml = (s: string) => s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);

/** Quy trình: lập đơn → trưởng phòng duyệt → rẽ nhánh theo biến "decision". */
export function bpmn(rt: RequestType): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xmlns:flowable="http://flowable.org/bpmn"
             targetNamespace="http://seatech.demo/request-types">
  <process id="${rt.key}" name="${xml(rt.name)}" isExecutable="true">
    <startEvent id="start" flowable:formKey="${startFormKey(rt.key)}" />
    <sequenceFlow id="f1" sourceRef="start" targetRef="managerApprove" />
    <userTask id="managerApprove" name="Manager approval"
              flowable:assignee="${APPROVER}" flowable:formKey="${approveFormKey(rt.key)}" />
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
}
