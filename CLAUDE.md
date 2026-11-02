# Flowable request demo

Demo quy trình đơn từ (lập đơn → trưởng phòng duyệt) chạy trên Flowable. Gồm ba phần:

| Thư mục | Vai trò | Cổng |
|---|---|---|
| `flowable/` | BPMN + form (.form) mẫu, script deploy, loại đơn thiết kế từ UI (`request-types/*.json`) | Flowable REST: 8081 |
| `backend/` | NestJS BFF, gọi Flowable REST, gộp dữ liệu cho UI | 3000 |
| `frontend/` | React 19 + Vite admin UI | 5173 (proxy `/api` → 3000) |

Người dùng nói tiếng Việt: trả lời bằng tiếng Việt. Comment trong code viết tiếng Việt; chữ trên giao diện và thông báo lỗi từ backend viết tiếng Anh.

## Chạy

```powershell
docker compose up -d                        # flowable/flowable-rest:7.1.0, DB trong bộ nhớ
powershell flowable/deploy.ps1              # deploy leaveRequest (cần chạy lại sau mỗi lần restart container)
cd backend;  npm run start:dev              # watch mode, người dùng thường đã bật sẵn
cd frontend; npm run dev
```

- `backend/.env`: `FLOWABLE_URL`, `FLOWABLE_USER=rest-admin`, `FLOWABLE_PASSWORD=test`.
- Flowable mất hết dữ liệu khi restart. Loại đơn trong `flowable/request-types/` được backend tự deploy lại lúc khởi động (`RequestTypesService.onModuleInit`). Các process mẫu khác (businessTripRequest, advanceRequest, overtimeRequest) đang có trên Flowable nhưng không có file trong repo.
- Kiểm tra: `cd frontend; npx tsc -b; npx vite build`. Backend: `npm run build`.

## Người dùng và vai trò

Đăng nhập demo ở `#/login` qua `POST /api/login`. Mật khẩu chung là `123456` (`DEMO_PASSWORD` trong `backend/src/users.ts`), chưa có token. Phiên lưu ở sessionStorage, mỗi tab một phiên (`frontend/src/shared/auth/session.ts`). Axios interceptor tự gắn header `x-user-id`. Backend vẫn tin header này.

| Id | Tên | Vai trò | Màn |
|---|---|---|---|
| `maker` | Nguyễn Văn An | employee (maker) | New request |
| `checker` | Trần Minh Quân | approver (checker) | Approvals (phải khớp `flowable:assignee` trong BPMN) |
| `admin` | Lê Thu Hà | admin | Request types |

Mỗi mục menu gắn một vai trò (`frontend/src/app/layout/nav.ts`). `AppLayout` chỉ hiện các mục của vai trò đó. Chưa đăng nhập thì chuyển về `/login`. Mở màn của vai trò khác thì bị đưa về màn đầu của vai trò mình. Topbar hiện người đăng nhập và nút **Sign out**.

## Flow của web

Router dùng hash (`createHashRouter`, `frontend/src/app/router.tsx`).

### 1. New request (`#/new/:processId?`, vai trò `maker`)
1. `GET /api/processes` trả về các loại đơn có start form. Không có `processId` thì chuyển sang loại đầu tiên.
2. Chọn loại đơn bằng các nút pill (`ProcessPicker`). `GET /api/processes/:id/start-form` tải form. `employeeName` được điền sẵn.
3. Form được vẽ động bằng `shared/form` (`useDynamicForm` + `Fields`), kiểm tra các trường bắt buộc.
4. Nút **Submit for approval** (hàng tiêu đề, bên phải) gọi `POST /api/processes/:key/start`. Thành công thì hiện toast kèm mã đơn, form được làm trống, hàng chờ duyệt được tải lại.

### 2. Approvals (`#/approvals`, `#/approvals/:taskId`, vai trò `checker`)
1. `GET /api/tasks` trả về các đơn chờ duyệt. Bảng có ô lọc; bấm vào dòng để mở đơn. Số đơn chờ hiện cạnh menu.
2. Trang chi tiết:
   - `GET /api/tasks/:id/form` tải form duyệt (các trường chỉ đọc + `managerComment`);
   - `GET /api/requests/:id` tải thông tin đơn, timeline và lịch sử.
3. **Approve** mở hộp thoại xác nhận. **Reject** mở hộp thoại bắt buộc nhập ý kiến. Cả hai gọi `POST /api/tasks/:id/complete` với `{ outcome, values }`. Backend ghi biến `decision`, gateway trong BPMN rẽ nhánh theo biến này.
4. Xong thì hiện toast rồi quay về `#/approvals`.

### 3. Request types (`#/request-types`, `#/request-types/new`, `#/request-types/:key`, vai trò `admin`)
1. Danh sách loại đơn (`GET /api/request-types`): tên, process key, số trường, phiên bản trên Flowable.
2. Trang thiết kế có các phần:
   - **Details**: tên loại đơn;
   - **Fields**: nhãn, kiểu (text, multi-line-text, integer, date, dropdown, boolean), ô bắt buộc, lựa chọn của dropdown, đổi thứ tự, xoá;
   - **Preview**: form thật, dùng lại `shared/form`;
   - **Workflow**: cố định một bước trưởng phòng duyệt.
3. Lưu bằng `POST /api/request-types` (tạo mới) hoặc `PUT /api/request-types/:key` (phiên bản mới). Backend (`backend/src/request-types*.ts`) làm các bước sau:
   - chuẩn hoá và kiểm tra dữ liệu; sinh id trường camelCase không dấu; giữ id cũ khi sửa;
   - sinh `<key>Start.form`, `<key>Approve.form` và BPMN "start → userTask Manager approval → gateway `decision`";
   - nén thành .bar bằng JSZip, deploy qua `/repository/deployments`, ghi file `flowable/request-types/<key>.json`.
4. Loại đơn mới xuất hiện ngay trong New request. Đơn đã gửi vẫn chạy theo phiên bản cũ. Chưa có chức năng xoá: muốn xoá thì gọi Flowable `DELETE /repository/deployments/:id?cascade=true` và xoá file JSON.

## Backend API (`/api`)

| Method | Path | Ghi chú |
|---|---|---|
| GET | `users` | người dùng demo |
| POST | `login` | `{ username, password }`, 401 nếu sai |
| GET | `processes` | loại đơn có start form |
| GET | `processes/:id/start-form` | form model (.form) |
| POST | `processes/:key/start` | `{ values }`, header `x-user-id` |
| GET | `requests/:id` | chi tiết đơn + timeline |
| GET | `tasks`, `tasks/done` | việc chờ / đã xử lý của người trong header |
| GET | `tasks/:id/form` | form duyệt kèm giá trị |
| POST | `tasks/:id/complete` | `{ outcome, values }` |
| GET/POST/PUT | `request-types[/:key]` | chỉ admin (403 nếu không phải admin) |

Image Flowable REST không có form engine. Backend tự đọc tài nguyên `.form` trong deployment theo `formKey` (`FlowableService.loadForm`).

## Cấu trúc frontend (feature-based)

```
src/app/         App (QueryClient, Router, Devtools), router.tsx, layout/AppLayout.tsx, layout/nav.ts
src/features/    requests/, approvals/, request-types/, users/: mỗi feature có api.ts, hooks.ts, components/, pages/, index.ts
src/shared/      api/http.ts (axios, gắn x-user-id), auth/session.ts (phiên đăng nhập), form/ (form động), lib/format.ts, ui/ (Cmd, Dialog, MessageBar, RecordHeader, Section, icons...)
src/styles/      tokens.css, base.css, index.css
```

- Feature khác chỉ được import qua `index.ts` của feature. Alias `@/` trỏ tới `src`.
- Dữ liệu lấy bằng React Query: query keys nằm trong `hooks.ts` của từng feature, mutation tự invalidate các key liên quan.
- Mỗi trang là default export, nạp lazy trong router.

## Quy ước UI

- Phong cách: sidebar navy, mục đang chọn màu vàng, nội dung nền trắng, font Inter.
- Nút thao tác nằm trên hàng tiêu đề, bên phải (`RecordHeader actions`). Không có nút làm mới.
- Thông báo thành công / thất bại của một thao tác dùng toast của `sonner` (`toast.success`, `toast.error`; `<Toaster>` trong `App.tsx`, màu gán bằng token cuối `index.css`). Lỗi tải dữ liệu vẫn hiện trên trang (`Problem`, có nút Retry).
- Màu, font, khoảng cách chỉ dùng token trong `tokens.css`, không viết màu trực tiếp. Dòng đầu `index.css` là stamp của Hallmark: giữ nguyên.
- Mọi thứ tương tác phải có `:focus-visible`. Svg icon có `aria-hidden`. Không dùng `transition: all`.
- Người dùng hay đổi ý ("để lại như cũ"): sửa đúng phạm vi được yêu cầu, không tự đổi phần khác.

## Lưu ý khi làm việc

- Không commit nếu không được yêu cầu.
- Dữ liệu thử (loại đơn, deployment) tạo trên Flowable phải được dọn đi sau khi test.
- Trên Windows, curl làm hỏng tiếng Việt trong body: dùng script node cho payload UTF-8.
- Heredoc có dấu backtick bị lỗi trong Bash: ghi file bằng Write tool.
- Chụp màn hình: dùng puppeteer-core với Chrome tại `C:/Program Files/Google/Chrome/Application/chrome.exe`.
