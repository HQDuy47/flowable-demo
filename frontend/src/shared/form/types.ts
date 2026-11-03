import type { RJSFSchema, UiSchema } from '@rjsf/utils';

export type FormValues = Record<string, any>;

/** Form backend trả theo formKey: JSON Schema (dữ liệu hợp lệ trông thế nào) + uiSchema (hiển thị ra sao). */
export type SchemaFormDef = { key: string; name: string; schema: RJSFSchema; uiSchema?: UiSchema };

/** Một trường trong form model của Flowable (form engine, qua GET /api/forms/:formKey). */
export type FlowableField = {
  id: string;
  name: string;
  /** text, multi-line-text, integer, date, dropdown, boolean */
  type: string;
  /** FormField | OptionFormField */
  fieldType?: string;
  required?: boolean | null;
  readOnly?: boolean | null;
  options?: { id?: string | null; name: string }[] | null;
  /** phần mở rộng (Flowable chỉ cho thêm thuộc tính riêng vào params) */
  params?: {
    /** từ khoá JSON Schema: minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf, minLength, maxLength, pattern */
    rules?: Record<string, number | string | undefined>;
    /** câu báo lỗi theo từ khoá (required, type, minimum...), backend sinh, giống câu của rjsf */
    messages?: Record<string, string>;
  } | null;
};

/** Form model của Flowable: id, version (trên Flowable), key (= formKey), tên, các trường, các kết quả (form duyệt). */
export type FlowableFormModel = {
  id?: string;
  version?: number;
  key: string;
  name: string;
  fields: FlowableField[];
  outcomes?: { id: string; name: string }[];
};

/** Cách vẽ form: renderer tự viết từ form model Flowable, hoặc JSON Schema + react-jsonschema-form. */
export type FormRenderer = 'flowable' | 'rjsf';
