# Backend

NestJS BFF của demo đơn từ trên Flowable: gọi Flowable REST, lưu loại đơn và JSON Schema trong PostgreSQL (schema `app`), gộp dữ liệu cho frontend.

```bash
npm install
npm run start:dev   # watch mode, cổng 3000
npm run seed        # tạo 2 loại đơn mẫu (cần backend đang chạy)
npm run build
```

Cấu hình trong `.env` (xem `.env.example`). Kiến trúc, API, cấu trúc thư mục và quy ước: xem [`../CLAUDE.md`](../CLAUDE.md).
