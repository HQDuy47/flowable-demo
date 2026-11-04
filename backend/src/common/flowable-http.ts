import { HttpException } from '@nestjs/common';
import type { HttpService } from '@nestjs/axios';
import type { AxiosError, AxiosRequestConfig } from 'axios';
import { firstValueFrom } from 'rxjs';

/**
 * Gọi Flowable REST qua HttpService (đã gắn baseURL process API + tài khoản rest-admin trong AppModule).
 * Flowable trả lỗi → HttpException cùng mã và nội dung; không phản hồi → mã `unreachable`, câu lỗi có tiền tố `label`.
 */
export async function flowableRequest<T = any>(
  http: HttpService,
  config: AxiosRequestConfig,
  unreachable = 500,
  label?: string,
): Promise<T> {
  try {
    const res = await firstValueFrom(http.request(config));
    return res.data;
  } catch (e) {
    const err = e as AxiosError<any>;
    throw new HttpException(
      err.response?.data ?? (label ? `${label}: ${err.message}` : err.message),
      err.response?.status ?? unreachable,
    );
  }
}
