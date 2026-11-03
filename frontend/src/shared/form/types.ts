import type { RJSFSchema, UiSchema } from '@rjsf/utils';

export type FormValues = Record<string, any>;

/** Form backend trả theo formKey: JSON Schema (dữ liệu hợp lệ trông thế nào) + uiSchema (hiển thị ra sao). */
export type SchemaFormDef = { key: string; name: string; schema: RJSFSchema; uiSchema?: UiSchema };
