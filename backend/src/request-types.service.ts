import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Ajv, type ValidateFunction } from 'ajv';
import addFormatsModule from 'ajv-formats';
import pg from 'pg';
import { FlowableFormsService } from './flowable-forms.service.js';
import {
  approveForm, formKeyOf, normalize, parseFormKey, startForm, toJsonSchema, typeKeyFor,
  type RequestType, type RequestTypeInput, type TypeField, type TypeVersion,
} from './request-types.js';

// ajv-formats là CommonJS: import từ ESM nhận module.exports, hàm nằm ở .default
const addFormats = addFormatsModule.default;
// allErrors: báo mọi ô sai một lượt; coerceTypes: ô số có thể gửi dạng chuỗi
const ajv = new Ajv({ allErrors: true, coerceTypes: true });
addFormats(ajv, ['date']);
ajv.addKeyword('errorMessage'); // chỉ là chú thích (câu báo lỗi), không kiểm tra gì

/**
 * Bảng lưu loại đơn, trong schema riêng "app" để không lẫn với bảng ACT_* của Flowable.
 * Phiên bản không bao giờ sửa, chỉ thêm: đơn đã gửi đọc lại đúng phiên bản lúc gửi.
 * ponytail: tạo bảng lúc khởi động thay cho công cụ migration; đổi cấu trúc bảng thì cần migration thật.
 */
const DDL = `
  CREATE SCHEMA IF NOT EXISTS app;
  CREATE TABLE IF NOT EXISTS app.request_types (
    key            text PRIMARY KEY,
    name           text NOT NULL,
    latest_version int  NOT NULL,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    updated_by     text NOT NULL
  );
  CREATE TABLE IF NOT EXISTS app.request_type_versions (
    type_key text NOT NULL REFERENCES app.request_types(key),
    version  int  NOT NULL,
    name     text NOT NULL,
    fields   jsonb NOT NULL,
    saved_at timestamptz NOT NULL DEFAULT now(),
    saved_by text NOT NULL,
    PRIMARY KEY (type_key, version)
  );
  -- Cách 2: JSON Schema + uiSchema của từng form, lưu theo formKey (không qua form engine Flowable).
  -- Kiểu json, không phải jsonb: jsonb sắp lại key của object nên thứ tự trường trong "properties" (thứ tự rjsf vẽ) bị đảo.
  CREATE TABLE IF NOT EXISTS app.form_schemas (
    form_key   text PRIMARY KEY,
    name       text NOT NULL,
    schema     json NOT NULL,
    ui_schema  json NOT NULL,
    outcomes   json NOT NULL DEFAULT '[]',
    created_at timestamptz NOT NULL DEFAULT now()
  );
`;

/** Form ở dạng JSON Schema, lưu trong app.form_schemas (cách 2). */
export type StoredSchema = {
  key: string; name: string; schema: Record<string, any>; uiSchema: Record<string, any>; outcomes: { id: string; name: string }[];
};

type VersionRow = { version: number; name: string; fields: TypeField[]; saved_at: Date; saved_by: string };
const toVersion = (r: VersionRow): TypeVersion => ({
  version: r.version, name: r.name, fields: r.fields, savedAt: r.saved_at.toISOString(), savedBy: r.saved_by,
});

/**
 * Loại đơn thiết kế từ giao diện. Bản thiết kế (tên + trường, có phiên bản) lưu trong PostgreSQL schema "app"
 * (DATABASE_URL). Mỗi phiên bản sinh hai form "<loại>:<phiên bản>:start" và ":approve", lưu ở hai nơi để demo hai cách:
 * - cách 1: form definition deploy lên form engine của Flowable (formByKey);
 * - cách 2: JSON Schema + uiSchema lưu trong app.form_schemas theo formKey (schemaByKey).
 * Mọi loại đơn chạy chung quy trình requestApproval.
 */
@Injectable()
export class RequestTypesService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(RequestTypesService.name);
  private readonly db = new pg.Pool({
    connectionString: process.env.DATABASE_URL ?? 'postgres://flowable:flowable@localhost:5433/flowable',
  });
  // formKey có phiên bản nên schema không đổi → biên dịch một lần (ajv tự cache theo object sẽ phình bộ nhớ)
  private readonly validators = new Map<string, ValidateFunction>();
  /** JSON Schema theo formKey (bất biến) */
  private readonly schemas = new Map<string, StoredSchema>();

  constructor(private readonly forms: FlowableFormsService) {}

  async onModuleInit() {
    await this.db.query(DDL);
    await this.syncSchemas();
    // Flowable chưa chạy thì bỏ qua: form thiếu sẽ được deploy bù khi có người cần (formByKey)
    await this.syncForms().catch((e) => this.log.warn(`Could not sync forms to Flowable: ${(e as Error).message}`));
  }

  /** Lưu JSON Schema của hai form một phiên bản vào app.form_schemas (đã có thì bỏ qua). */
  private async storeSchemas(c: pg.Pool | pg.PoolClient, key: string, v: TypeVersion) {
    for (const form of [startForm(key, v), approveForm(key, v)]) {
      const { schema, uiSchema } = toJsonSchema(form);
      await c.query(
        `INSERT INTO app.form_schemas (form_key, name, schema, ui_schema, outcomes) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (form_key) DO NOTHING`,
        [form.key, form.name, JSON.stringify(schema), JSON.stringify(uiSchema), JSON.stringify(form.outcomes ?? [])],
      );
    }
  }

  /** Lưu bù JSON Schema cho các phiên bản chưa có (vd. phiên bản lưu trước khi có bảng này). */
  private async syncSchemas() {
    const { rows } = await this.db.query<VersionRow & { type_key: string }>(`
      SELECT v.* FROM app.request_type_versions v
      WHERE NOT EXISTS (SELECT 1 FROM app.form_schemas s WHERE s.form_key = v.type_key || ':' || v.version || ':start')`);
    for (const r of rows) await this.storeSchemas(this.db, r.type_key, toVersion(r));
    if (rows.length) this.log.log(`Stored JSON Schema for ${rows.length} version(s)`);
  }

  /** JSON Schema theo formKey, đọc từ app.form_schemas (cách 2, không qua Flowable). Không có thì null. */
  async schemaByKey(formKey: unknown): Promise<StoredSchema | null> {
    if (!parseFormKey(formKey)) return null;
    const hit = this.schemas.get(formKey as string);
    if (hit) return hit;
    const r = (await this.db.query('SELECT * FROM app.form_schemas WHERE form_key = $1', [formKey])).rows[0];
    if (!r) return null;
    const s: StoredSchema = { key: r.form_key, name: r.name, schema: r.schema, uiSchema: r.ui_schema, outcomes: r.outcomes };
    this.schemas.set(s.key, s);
    return s;
  }

  /** JSON Schema của form lập đơn, phiên bản mới nhất. */
  async latestStartSchema(key: string) {
    const rt = await this.get(key);
    const formKey = formKeyOf(rt.key, rt.version, 'start');
    const s = await this.schemaByKey(formKey);
    if (!s) throw new NotFoundException(`JSON Schema "${formKey}" was not found`);
    return s;
  }

  /** Deploy form của các phiên bản chưa có trên Flowable (vd. Flowable mới dựng, hoặc lúc lưu Flowable đang tắt). */
  private async syncForms() {
    const have = await this.forms.keys();
    const { rows } = await this.db.query<VersionRow & { type_key: string }>(
      'SELECT * FROM app.request_type_versions ORDER BY type_key, version',
    );
    let n = 0;
    for (const r of rows) {
      const v = toVersion(r);
      for (const form of [startForm(r.type_key, v), approveForm(r.type_key, v)]) {
        if (have.has(form.key)) continue;
        await this.forms.deploy(form);
        n++;
      }
    }
    if (n) this.log.log(`Deployed ${n} missing form(s) to Flowable`);
  }

  /** Deploy hai form của một phiên bản lên Flowable. */
  private async deployVersion(key: string, v: TypeVersion) {
    await this.forms.deploy(startForm(key, v));
    await this.forms.deploy(approveForm(key, v));
  }

  async onModuleDestroy() {
    await this.db.end();
  }

  /** Mọi loại đơn (phiên bản mới nhất), mới sửa lên đầu. Không kèm danh sách phiên bản cho gọn. */
  async list() {
    const { rows } = await this.db.query(`
      SELECT t.key, t.name, t.latest_version AS version, v.fields, t.created_at, t.updated_at, t.updated_by
      FROM app.request_types t
      JOIN app.request_type_versions v ON v.type_key = t.key AND v.version = t.latest_version
      ORDER BY t.updated_at DESC`);
    return rows.map((r) => ({
      key: r.key, name: r.name, fields: r.fields as TypeField[], version: r.version as number,
      createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(), updatedBy: r.updated_by,
    }));
  }

  async get(key: string): Promise<RequestType> {
    const head = (await this.db.query('SELECT * FROM app.request_types WHERE key = $1', [key])).rows[0];
    if (!head) throw new NotFoundException(`Request type "${key}" was not found`);
    const versions = (
      await this.db.query<VersionRow>(
        'SELECT * FROM app.request_type_versions WHERE type_key = $1 ORDER BY version', [key],
      )
    ).rows.map(toVersion);
    const latest = versions.at(-1)!;
    return {
      key: head.key, name: latest.name, fields: latest.fields, version: head.latest_version, versions,
      createdAt: head.created_at.toISOString(), updatedAt: head.updated_at.toISOString(), updatedBy: head.updated_by,
    };
  }

  /** Một phiên bản cụ thể (đơn đã gửi dùng hàm này để dựng lại form lúc gửi). Không có thì trả null. */
  async version(key: unknown, version: unknown): Promise<TypeVersion | null> {
    const n = Number(version);
    if (typeof key !== 'string' || !Number.isInteger(n)) return null;
    const { rows } = await this.db.query<VersionRow>(
      'SELECT * FROM app.request_type_versions WHERE type_key = $1 AND version = $2', [key, n],
    );
    return rows[0] ? toVersion(rows[0]) : null;
  }

  /**
   * Form definition theo formKey "<loại đơn>:<phiên bản>:<start|approve>", lấy từ form engine của Flowable.
   * Flowable chưa có (lúc lưu Flowable đang tắt) mà phiên bản còn trong DB thì deploy bù rồi lấy lại. Không có thì null.
   */
  async formByKey(formKey: unknown) {
    const k = parseFormKey(formKey);
    if (!k) return null;
    const form = await this.forms.get(formKey as string);
    if (form) return form;
    const v = await this.version(k.key, k.version);
    if (!v) return null;
    await this.deployVersion(k.key, v);
    return this.forms.get(formKey as string);
  }

  /**
   * Kiểm tra dữ liệu lập đơn theo JSON Schema của form (cùng schema rjsf dùng ở frontend), trước khi gửi sang Flowable.
   * Ô bỏ trống ('' / null) coi như không điền; "2" của ô số được đổi thành 2 (coerceTypes). Trả về dữ liệu đã chuẩn hoá.
   */
  async checkStartValues(key: string, values: unknown) {
    // cùng JSON Schema đã lưu theo formKey (app.form_schemas) mà rjsf dùng; renderer nào gửi lên cũng kiểm tra như nhau
    const { key: formKey, schema } = await this.latestStartSchema(key);
    let validate = this.validators.get(formKey);
    if (!validate) this.validators.set(formKey, (validate = ajv.compile(schema)));

    const data: Record<string, unknown> = Object.fromEntries(
      Object.entries(values && typeof values === 'object' ? values : {}).filter(([, v]) => v !== '' && v != null),
    );
    if (validate(data)) return data;
    // câu báo lỗi lấy từ `errorMessage` của trường (toJsonSchema sinh), giống câu rjsf hiện ở frontend
    const problems = (validate.errors ?? []).map((e) => {
      const id = e.keyword === 'required' ? String(e.params.missingProperty) : e.instancePath.slice(1);
      const p = schema.properties[id] as { title?: string; errorMessage?: Record<string, string> } | undefined;
      return `${p?.title ?? id}: ${p?.errorMessage?.[e.keyword] ?? e.message}`;
    });
    throw new BadRequestException(problems.join(' '));
  }

  /** Form lập đơn dựng từ bản thiết kế chưa lưu, để trang thiết kế xem trước. Dữ liệu sai → 400 kèm lý do. */
  preview(input: RequestTypeInput) {
    const { name, fields } = this.check(input);
    const form = startForm('preview', { version: 0, name, fields, savedAt: '', savedBy: '' });
    return { key: form.key, name: form.name, ...toJsonSchema(form) };
  }

  /** Tạo loại đơn mới: sinh khoá không trùng, lưu phiên bản 1. */
  async create(input: RequestTypeInput, userId: string) {
    const { name, fields } = this.check(input);
    const key = await this.tx(async (c) => {
      // khoá bảng để hai admin tạo cùng tên không sinh trùng khoá
      await c.query('LOCK TABLE app.request_types IN SHARE ROW EXCLUSIVE MODE');
      const taken = (await c.query('SELECT key FROM app.request_types')).rows.map((r) => r.key as string);
      const key = typeKeyFor(name, new Set(taken));
      await c.query('INSERT INTO app.request_types (key, name, latest_version, updated_by) VALUES ($1, $2, 1, $3)', [key, name, userId]);
      await this.insertVersion(c, key, 1, name, fields, userId);
      const v: TypeVersion = { version: 1, name, fields, savedAt: '', savedBy: userId };
      await this.storeSchemas(c, key, v); // cách 2: JSON Schema theo formKey
      // cách 1: deploy trước khi commit; Flowable lỗi thì không lưu gì (form thừa trên Flowable vô hại, key có phiên bản)
      await this.deployVersion(key, v);
      return key;
    });
    return this.get(key);
  }

  /** Sửa loại đơn: thêm phiên bản mới. Đơn đã gửi vẫn giữ số phiên bản cũ nên vẫn hiện đúng form cũ. */
  async update(key: string, input: RequestTypeInput, userId: string) {
    const { name, fields } = this.check(input);
    await this.tx(async (c) => {
      // FOR UPDATE: hai admin lưu cùng lúc thì lần lượt thành v(n+1), v(n+2), không ghi đè nhau
      const head = (await c.query('SELECT latest_version FROM app.request_types WHERE key = $1 FOR UPDATE', [key])).rows[0];
      if (!head) throw new NotFoundException(`Request type "${key}" was not found`);
      const version = head.latest_version + 1;
      await this.insertVersion(c, key, version, name, fields, userId);
      const v: TypeVersion = { version, name, fields, savedAt: '', savedBy: userId };
      await this.storeSchemas(c, key, v); // cách 2: JSON Schema theo formKey
      await this.deployVersion(key, v); // cách 1: form definition lên Flowable
      await c.query(
        'UPDATE app.request_types SET name = $2, latest_version = $3, updated_at = now(), updated_by = $4 WHERE key = $1',
        [key, name, version, userId],
      );
    });
    return this.get(key);
  }

  private insertVersion(c: pg.PoolClient, key: string, version: number, name: string, fields: TypeField[], userId: string) {
    return c.query(
      'INSERT INTO app.request_type_versions (type_key, version, name, fields, saved_by) VALUES ($1, $2, $3, $4, $5)',
      [key, version, name, JSON.stringify(fields), userId],
    );
  }

  private async tx<T>(work: (c: pg.PoolClient) => Promise<T>): Promise<T> {
    const c = await this.db.connect();
    try {
      await c.query('BEGIN');
      const result = await work(c);
      await c.query('COMMIT');
      return result;
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  }

  private check(input: RequestTypeInput) {
    try {
      return normalize(input);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }
}
