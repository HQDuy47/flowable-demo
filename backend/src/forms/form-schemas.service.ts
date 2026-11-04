import { BadRequestException, Injectable } from '@nestjs/common';
import { Ajv, type ValidateFunction } from 'ajv';
import addFormatsModule from 'ajv-formats';
import { DatabaseService, type Db } from '../common/database.service.js';
import {
  parseFormKey,
  toJsonSchema,
  type FormDefinition,
} from './form-definition.js';

// ajv-formats là CommonJS: import từ ESM nhận module.exports, hàm nằm ở .default
const addFormats = addFormatsModule.default;
// allErrors: báo mọi ô sai một lượt; coerceTypes: ô số có thể gửi dạng chuỗi
const ajv = new Ajv({ allErrors: true, coerceTypes: true });
addFormats(ajv, ['date']);
ajv.addKeyword('errorMessage'); // chỉ là chú thích (câu báo lỗi), không kiểm tra gì

/**
 * Cách 2: JSON Schema + uiSchema của từng form, lưu theo formKey (không qua form engine Flowable).
 * Kiểu json, không phải jsonb: jsonb sắp lại key của object nên thứ tự trường trong "properties" (thứ tự rjsf vẽ) bị đảo.
 */
const DDL = `
  CREATE SCHEMA IF NOT EXISTS app;
  CREATE TABLE IF NOT EXISTS app.form_schemas (
    form_key   text PRIMARY KEY,
    name       text NOT NULL,
    schema     json NOT NULL,
    ui_schema  json NOT NULL,
    outcomes   json NOT NULL DEFAULT '[]',
    created_at timestamptz NOT NULL DEFAULT now()
  );
`;

/** Form ở dạng JSON Schema, lưu trong app.form_schemas. */
export type StoredSchema = {
  key: string;
  name: string;
  schema: Record<string, any>;
  uiSchema: Record<string, any>;
  outcomes: { id: string; name: string }[];
};

/** Cách 2: bảng app.form_schemas, rjsf (frontend) vẽ và ajv (backend) kiểm tra theo cùng schema. */
@Injectable()
export class FormSchemasService {
  /** JSON Schema theo formKey (bất biến) */
  private readonly cache = new Map<string, StoredSchema>();
  // formKey có phiên bản nên schema không đổi → biên dịch một lần (ajv tự cache theo object sẽ phình bộ nhớ)
  private readonly validators = new Map<string, ValidateFunction>();

  constructor(private readonly db: DatabaseService) {}

  /** Tạo bảng (gọi lúc khởi động, trước khi lưu bù). */
  createTable() {
    return this.db.query(DDL);
  }

  /** Lưu JSON Schema của một form (đã có thì bỏ qua). Truyền `c` để chạy trong transaction đang mở. */
  async store(form: FormDefinition, c: Db = this.db.pool) {
    const { schema, uiSchema } = toJsonSchema(form);
    await c.query(
      `INSERT INTO app.form_schemas (form_key, name, schema, ui_schema, outcomes) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (form_key) DO NOTHING`,
      [
        form.key,
        form.name,
        JSON.stringify(schema),
        JSON.stringify(uiSchema),
        JSON.stringify(form.outcomes ?? []),
      ],
    );
  }

  /** JSON Schema theo formKey. Không có thì null. */
  async get(formKey: unknown): Promise<StoredSchema | null> {
    if (!parseFormKey(formKey)) return null;
    const hit = this.cache.get(formKey as string);
    if (hit) return hit;
    const r = (
      await this.db.query(
        'SELECT * FROM app.form_schemas WHERE form_key = $1',
        [formKey],
      )
    ).rows[0];
    if (!r) return null;
    const s: StoredSchema = {
      key: r.form_key,
      name: r.name,
      schema: r.schema,
      uiSchema: r.ui_schema,
      outcomes: r.outcomes,
    };
    this.cache.set(s.key, s);
    return s;
  }

  /**
   * Kiểm tra dữ liệu theo JSON Schema của form (cùng schema rjsf dùng ở frontend). Chỉ giữ các ô người dùng được nhập
   * (có trong form, không readOnly): key lạ như requestTypeVersion, initiator bị bỏ nên không ghi đè được biến của quy trình.
   * Ô bỏ trống ('' / null) coi như không điền; "2" của ô số được đổi thành 2 (coerceTypes).
   * Trả về dữ liệu đã chuẩn hoá; sai thì 400 kèm câu lỗi.
   */
  validate(form: StoredSchema, values: unknown) {
    const { key: formKey, schema } = form;
    let validate = this.validators.get(formKey);
    if (!validate)
      this.validators.set(formKey, (validate = ajv.compile(schema)));

    const editable = new Set(
      Object.entries(schema.properties ?? {})
        .filter(([, p]) => !(p as { readOnly?: boolean }).readOnly)
        .map(([id]) => id),
    );
    const data: Record<string, unknown> = Object.fromEntries(
      Object.entries(values && typeof values === 'object' ? values : {}).filter(
        ([id, v]) => editable.has(id) && v !== '' && v != null,
      ),
    );
    if (validate(data)) return data;
    // câu báo lỗi lấy từ `errorMessage` của trường (toJsonSchema sinh), giống câu rjsf hiện ở frontend
    const problems = (validate.errors ?? []).map((e) => {
      const id =
        e.keyword === 'required'
          ? String(e.params.missingProperty)
          : e.instancePath.slice(1);
      const p = schema.properties[id] as
        { title?: string; errorMessage?: Record<string, string> } | undefined;
      return `${p?.title ?? id}: ${p?.errorMessage?.[e.keyword] ?? e.message}`;
    });
    throw new BadRequestException(problems.join(' '));
  }
}
