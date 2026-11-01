import { asUser, http } from '@/shared/api/http';
import { ADMIN } from '@/shared/config/actors';

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

export type TypeField = { id: string; name: string; type: FieldType; required: boolean; options?: string[] };

/** Bản thiết kế loại đơn. `version` là phiên bản đang chạy trên Flowable (null nếu chưa deploy). */
export type RequestType = {
  key: string; name: string; fields: TypeField[];
  createdAt: string; updatedAt: string; updatedBy: string; version?: number | null;
};

/** Dữ liệu gửi lên khi lưu; trường mới chưa có id. */
export type RequestTypeInput = {
  name: string;
  fields: { id?: string; name: string; type: FieldType; required: boolean; options?: string[] }[];
};

const enc = encodeURIComponent;
const admin = asUser(ADMIN);

/** Các API thiết kế loại đơn; chỉ admin được gọi. */
export const requestTypesApi = {
  list: () => http.get<RequestType[]>('/request-types', admin).then(r => r.data),
  get: (key: string) => http.get<RequestType>(`/request-types/${enc(key)}`, admin).then(r => r.data),
  create: (input: RequestTypeInput) => http.post<RequestType>('/request-types', input, admin).then(r => r.data),
  update: ({ key, input }: { key: string; input: RequestTypeInput }) =>
    http.put<RequestType>(`/request-types/${enc(key)}`, input, admin).then(r => r.data),
};
