import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AxiosError, AxiosRequestConfig } from 'axios';
import { firstValueFrom } from 'rxjs';
import type { FormDefinition } from './request-types.js';

/** Form model Flowable trả về (form definition đã deploy, thêm id/version và các thuộc tính mặc định). */
export type FlowableFormModel = FormDefinition & { id: string; version: number };

/**
 * Form engine của Flowable (REST form-api, có từ Flowable 6; bản mã nguồn mở 7.x đã bỏ).
 * Form definition được deploy thành file .form, lấy lại theo key (= formKey của task).
 */
@Injectable()
export class FlowableFormsService {
  private readonly log = new Logger(FlowableFormsService.name);
  /** .../flowable-rest/form-api/form-repository */
  private readonly base: string;
  /** formKey có số phiên bản và phiên bản không bao giờ sửa → model đọc một lần là dùng mãi */
  private readonly cache = new Map<string, FlowableFormModel>();

  constructor(
    private readonly http: HttpService,
    config: ConfigService,
  ) {
    const service = config.get<string>('FLOWABLE_URL') ?? 'http://localhost:8081/flowable-rest/service';
    this.base = config.get<string>('FLOWABLE_FORM_URL') ?? `${service.replace(/\/service\/?$/, '')}/form-api/form-repository`;
  }

  private async call<T = any>(method: 'get' | 'post', path: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    try {
      // URL tuyệt đối nên bỏ qua baseURL (process API) của HttpModule, vẫn dùng chung tài khoản rest-admin
      const res = await firstValueFrom(this.http.request({ method, url: this.base + path, data, ...config }));
      return res.data;
    } catch (e) {
      const err = e as AxiosError<any>;
      throw new HttpException(err.response?.data ?? `Flowable form engine: ${err.message}`, err.response?.status ?? 502);
    }
  }

  /** Deploy một form definition (REST chỉ nhận một file mỗi deployment). Tên file: "reqX.2.start.form". */
  async deploy(form: FormDefinition) {
    const body = new FormData();
    body.append('file', new Blob([JSON.stringify(form)], { type: 'application/json' }), `${form.key.replace(/:/g, '.')}.form`);
    await this.call('post', '/deployments', body);
    this.cache.delete(form.key);
    this.log.log(`Deployed form ${form.key}`);
  }

  /** Form model theo formKey (bản mới nhất của key đó). Flowable chưa có thì trả null. */
  async get(formKey: string): Promise<FlowableFormModel | null> {
    const hit = this.cache.get(formKey);
    if (hit) return hit;
    const defs = await this.call<{ data: { id: string }[] }>('get', '/form-definitions', undefined, {
      params: { key: formKey, latest: true },
    });
    if (!defs.data[0]) return null;
    const model = await this.call<FlowableFormModel>('get', `/form-definitions/${encodeURIComponent(defs.data[0].id)}/model`);
    this.cache.set(formKey, model);
    return model;
  }

  /** Key của mọi form definition đã deploy (để deploy bù những form còn thiếu). */
  async keys(): Promise<Set<string>> {
    const res = await this.call<{ data: { key: string }[] }>('get', '/form-definitions', undefined, {
      params: { latest: true, size: 10000 },
    });
    return new Set(res.data.map((d) => d.key));
  }
}
