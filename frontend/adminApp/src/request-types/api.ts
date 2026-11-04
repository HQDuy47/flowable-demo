import { http } from '@demo/shared/api/http';
import type { SchemaFormDef } from '@demo/shared/form';

/** Kiểu trường hỗ trợ (khớp backend/src/request-types.ts). */
export const FIELD_TYPES = [
  { id: 'text', name: 'Text' },
  { id: 'multi-line-text', name: 'Long text' },
  { id: 'integer', name: 'Number' },
  { id: 'date', name: 'Date' },
  { id: 'dropdown', name: 'Dropdown' },
  { id: 'boolean', name: 'Checkbox' },
] as const;
export type FieldType = (typeof FIELD_TYPES)[number]['id'];

/** Rule kiểm tra của trường = từ khoá JSON Schema (khớp FieldRules ở backend). */
export type FieldRules = {
  minimum?: number; maximum?: number; exclusiveMinimum?: number; exclusiveMaximum?: number; multipleOf?: number;
  minLength?: number; maxLength?: number; pattern?: string;
  /** câu báo lỗi khi sai pattern, hiện cho người lập đơn */
  patternHint?: string;
};

export type TypeField = { id: string; name: string; type: FieldType; required: boolean; options?: string[]; rules?: FieldRules };

/** Bản thiết kế loại đơn. `version` là phiên bản mới nhất (mỗi lần lưu tăng 1). */
export type RequestType = {
  key: string; name: string; fields: TypeField[];
  createdAt: string; updatedAt: string; updatedBy: string; version: number;
};

/** Dữ liệu gửi lên khi lưu; trường mới chưa có id. */
export type RequestTypeInput = {
  name: string;
  fields: { id?: string; name: string; type: FieldType; required: boolean; options?: string[]; rules?: FieldRules }[];
};

const enc = encodeURIComponent;

/** Các API thiết kế loại đơn; chỉ admin được gọi. */
export const requestTypesApi = {
  list: () => http.get<RequestType[]>('/request-types').then(r => r.data),
  get: (key: string) => http.get<RequestType>(`/request-types/${enc(key)}`).then(r => r.data),
  create: (input: RequestTypeInput) => http.post<RequestType>('/request-types', input).then(r => r.data),
  update: ({ key, input }: { key: string; input: RequestTypeInput }) =>
    http.put<RequestType>(`/request-types/${enc(key)}`, input).then(r => r.data),
  /** Form lập đơn (JSON Schema) dựng từ bản thiết kế chưa lưu; không ghi gì. */
  preview: (input: RequestTypeInput) => http.post<SchemaFormDef>('/request-types/preview', input).then(r => r.data),
};
