# Đơn từ (frontend)

React 19 + Vite. Gọi API backend NestJS qua proxy `/api` (xem `vite.config.ts`).

```bash
npm install
npm run dev     # http://localhost:5173, cần backend ở cổng 3000
npm run build
```

## Cấu trúc (feature-based)

```
src/
  app/                  khởi động app: providers, router, layout chung
    App.tsx             QueryClientProvider + RouterProvider (+ React Query Devtools khi dev)
    router.tsx          #/tao/:processId?, #/duyet, #/duyet/:taskId (hash router, lazy load từng trang)
    query-client.ts     cấu hình React Query
    layout/             sidebar, thanh trên, breadcrumb

  features/             mỗi nghiệp vụ một thư mục, tự chứa api + hooks + components + pages
    requests/           lập đơn: chọn loại đơn, form bắt đầu, gửi đơn
    approvals/          duyệt đơn: hàng chờ, chi tiết đơn, hộp thoại Duyệt / Từ chối
    request-types/      thiết kế loại đơn (admin): danh sách, trình sửa trường + xem trước; backend sinh form + BPMN và deploy
    users/              người dùng demo
    */index.ts          public API của feature; feature khác chỉ import từ đây

  shared/               dùng chung, không biết gì về nghiệp vụ
    api/http.ts         axios instance, chuẩn hoá lỗi, header x-user-id
    config/actors.ts    người thao tác của từng màn (nhân viên / trưởng phòng)
    form/               vẽ form động từ JSON form của Flowable, ô ngày dd/mm/yyyy
    ui/                 nút, hộp thoại, thông báo, card, tab, icon
    lib/format.ts       định dạng ngày giờ, mã đơn

  styles/               tokens.css (màu, chữ, khoảng cách), base.css, index.css
```

### Quy ước

- **Dữ liệu từ server** đi qua React Query: mỗi feature có `api.ts` (hàm gọi axios) và `hooks.ts` (`useQuery` / `useMutation` cùng bộ query key). Không gọi `http` trực tiếp trong component.
- **Sau khi ghi** (gửi đơn, duyệt), mutation invalidate `approvalKeys.all` để hàng chờ và số đếm trên menu tự tải lại.
- **Import** dùng alias `@/` (vd. `@/shared/ui`). Trong cùng một feature dùng đường dẫn tương đối.
- **Màu, chữ, khoảng cách** chỉ lấy từ biến trong `styles/tokens.css`.
