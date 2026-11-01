import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import JSZip from 'jszip';
import { FlowableService } from './flowable.service.js';
import {
  approveForm, approveFormKey, bpmn, normalize, processKeyFor, startForm, startFormKey,
  type RequestType, type RequestTypeInput,
} from './request-types.js';

/**
 * Loại đơn thiết kế từ giao diện. Mỗi bản thiết kế lưu thành một file JSON
 * (mặc định flowable/request-types/<key>.json) và được deploy lên Flowable.
 * Flowable dùng DB trong bộ nhớ, nên khi backend khởi động, loại đơn nào chưa có trên Flowable sẽ được deploy lại.
 */
@Injectable()
export class RequestTypesService implements OnModuleInit {
  private readonly log = new Logger(RequestTypesService.name);
  private readonly dir = resolve(process.env.REQUEST_TYPES_DIR ?? join(process.cwd(), '..', 'flowable', 'request-types'));

  constructor(private readonly flowable: FlowableService) {}

  async onModuleInit() {
    await mkdir(this.dir, { recursive: true });
    try {
      const versions = await this.flowable.latestVersions();
      for (const rt of await this.readAll()) {
        if (versions.has(rt.key)) continue;
        await this.deploy(rt);
        this.log.log(`Redeployed request type "${rt.name}" (${rt.key})`);
      }
    } catch (e) {
      // Flowable chưa chạy: bỏ qua, loại đơn sẽ được deploy ở lần lưu tiếp theo
      this.log.warn(`Could not redeploy request types: ${(e as Error).message}`);
    }
  }

  /** Mọi loại đơn đã thiết kế, kèm phiên bản đang chạy trên Flowable (null nếu chưa deploy). */
  async list() {
    const [types, versions] = await Promise.all([this.readAll(), this.flowable.latestVersions().catch(() => new Map<string, number>())]);
    return types
      .map((rt) => ({ ...rt, version: versions.get(rt.key) ?? null }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(key: string): Promise<RequestType> {
    const rt = (await this.readAll()).find((t) => t.key === key);
    if (!rt) throw new NotFoundException(`Request type "${key}" was not found`);
    return rt;
  }

  /** Tạo loại đơn mới: sinh khoá quy trình không trùng, lưu file, deploy. */
  async create(input: RequestTypeInput, userId: string) {
    const { name, fields } = this.check(input);
    const taken = new Set([...(await this.readAll()).map((t) => t.key), ...(await this.flowable.latestVersions()).keys()]);
    const now = new Date().toISOString();
    const rt: RequestType = { key: processKeyFor(name, taken), name, fields, createdAt: now, updatedAt: now, updatedBy: userId };
    await this.deploy(rt);
    await this.save(rt);
    return rt;
  }

  /** Sửa loại đơn: deploy phiên bản mới. Đơn đã gửi vẫn chạy theo phiên bản cũ. */
  async update(key: string, input: RequestTypeInput, userId: string) {
    const current = await this.get(key);
    const { name, fields } = this.check(input);
    const rt: RequestType = { ...current, name, fields, updatedAt: new Date().toISOString(), updatedBy: userId };
    await this.deploy(rt);
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

  /** Đóng gói BPMN + 2 form thành .bar và deploy. */
  private async deploy(rt: RequestType) {
    const zip = new JSZip();
    zip.file(`${rt.key}.bpmn20.xml`, bpmn(rt));
    zip.file(`${startFormKey(rt.key)}.form`, JSON.stringify(startForm(rt), null, 2));
    zip.file(`${approveFormKey(rt.key)}.form`, JSON.stringify(approveForm(rt), null, 2));
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    return this.flowable.deploy(`${rt.key}.bar`, bytes);
  }

  private async save(rt: RequestType) {
    await writeFile(join(this.dir, `${rt.key}.json`), JSON.stringify(rt, null, 2) + '\n', 'utf8');
  }

  private async readAll(): Promise<RequestType[]> {
    const files = (await readdir(this.dir).catch(() => [] as string[])).filter((f) => f.endsWith('.json'));
    const types = await Promise.all(files.map(async (f) => {
      try {
        return JSON.parse(await readFile(join(this.dir, f), 'utf8')) as RequestType;
      } catch {
        this.log.warn(`Skipping unreadable request type file ${f}`);
        return null;
      }
    }));
    return types.filter((t): t is RequestType => !!t);
  }
}
