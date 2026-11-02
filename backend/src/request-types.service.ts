import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  approveForm, normalize, parseFormKey, startForm, typeKeyFor,
  type RequestType, type RequestTypeInput, type TypeVersion,
} from './request-types.js';

/**
 * Loại đơn thiết kế từ giao diện. Mỗi loại đơn lưu thành một file JSON
 * (mặc định flowable/request-types/<key>.json) gồm mọi phiên bản. Không deploy gì lên Flowable:
 * mọi loại đơn chạy chung quy trình requestApproval (FlowableService tự deploy lúc khởi động).
 */
@Injectable()
export class RequestTypesService implements OnModuleInit {
  private readonly log = new Logger(RequestTypesService.name);
  private readonly dir = resolve(process.env.REQUEST_TYPES_DIR ?? join(process.cwd(), '..', 'flowable', 'request-types'));

  async onModuleInit() {
    await mkdir(this.dir, { recursive: true });
  }

  /** Mọi loại đơn, mới sửa lên đầu. Không trả danh sách phiên bản cho gọn. */
  async list() {
    return (await this.readAll())
      .map(({ versions: _, ...rt }) => rt)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(key: string): Promise<RequestType> {
    const rt = (await this.readAll()).find((t) => t.key === key);
    if (!rt) throw new NotFoundException(`Request type "${key}" was not found`);
    return rt;
  }

  /** Một phiên bản cụ thể (đơn đã gửi dùng hàm này để dựng lại form lúc gửi). Không có thì trả null. */
  async version(key: unknown, version: unknown): Promise<TypeVersion | null> {
    if (typeof key !== 'string') return null;
    const rt = (await this.readAll()).find((t) => t.key === key);
    return rt?.versions.find((v) => v.version === Number(version)) ?? null;
  }

  /** Form theo formKey "<loại đơn>:<phiên bản>:<start|approve>". Không có thì trả null. */
  async formByKey(formKey: unknown) {
    const k = parseFormKey(formKey);
    const v = k && (await this.version(k.key, k.version));
    if (!k || !v) return null;
    return k.kind === 'start' ? startForm(k.key, v) : approveForm(k.key, v);
  }

  /** Tạo loại đơn mới: sinh khoá không trùng, lưu phiên bản 1. */
  async create(input: RequestTypeInput, userId: string) {
    const { name, fields } = this.check(input);
    const key = typeKeyFor(name, new Set((await this.readAll()).map((t) => t.key)));
    const now = new Date().toISOString();
    const rt: RequestType = {
      key, name, fields, version: 1,
      versions: [{ version: 1, name, fields, savedAt: now, savedBy: userId }],
      createdAt: now, updatedAt: now, updatedBy: userId,
    };
    await this.save(rt);
    return rt;
  }

  /** Sửa loại đơn: thêm phiên bản mới. Đơn đã gửi vẫn giữ số phiên bản cũ nên vẫn hiện đúng form cũ. */
  async update(key: string, input: RequestTypeInput, userId: string) {
    const current = await this.get(key);
    const { name, fields } = this.check(input);
    const now = new Date().toISOString();
    const version = current.version + 1;
    const rt: RequestType = {
      ...current, name, fields, version,
      versions: [...current.versions, { version, name, fields, savedAt: now, savedBy: userId }],
      updatedAt: now, updatedBy: userId,
    };
    await this.save(rt);
    return rt;
  }

  private check(input: RequestTypeInput) {
    try {
      return normalize(input);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  private async save(rt: RequestType) {
    await writeFile(join(this.dir, `${rt.key}.json`), JSON.stringify(rt, null, 2) + '\n', 'utf8');
  }

  private async readAll(): Promise<RequestType[]> {
    const files = (await readdir(this.dir).catch(() => [] as string[])).filter((f) => f.endsWith('.json'));
    const types = await Promise.all(
      files.map(async (f) => {
        try {
          const rt = JSON.parse(await readFile(join(this.dir, f), 'utf8')) as RequestType;
          // File viết tay thiếu phiên bản thì bỏ qua, tránh làm hỏng cả danh sách
          if (typeof rt?.key !== 'string' || !Array.isArray(rt.versions) || !rt.versions.length) {
            this.log.warn(`Skipping invalid request type file ${f} (missing key or versions)`);
            return null;
          }
          return rt;
        } catch {
          this.log.warn(`Skipping unreadable request type file ${f}`);
          return null;
        }
      }),
    );
    return types.filter((t): t is RequestType => !!t);
  }
}
