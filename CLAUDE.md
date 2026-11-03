# Flowable request demo

Demo quy trình đơn từ (lập đơn → trưởng phòng duyệt) chạy trên Flowable. Gồm các phần:

| Thành phần | Vai trò | Cổng |
|---|---|---|
| PostgreSQL | dữ liệu Flowable (bảng `act_*`) + loại đơn (schema `app`) | 5433 |
| Flowable REST | điều phối quy trình | 8081 |
| `backend/` | NestJS BFF, gọi Flowable REST, gộp dữ liệu cho UI | 3000 |
| `frontend/` | React 19 + Vite admin UI | 5173 (proxy `/api` → 3000) |

Người dùng nói tiếng Việt: trả lời bằng tiếng Việt. Comment trong code viết tiếng Việt; chữ trên giao diện và thông báo lỗi từ backend viết tiếng Anh.

## Chạy

```powershell
docker compose up -d                        # flowable/flowable-rest:7.1.0 + PostgreSQL 16 (volume flowable-db-data)
cd backend;  npm run start:dev              # watch mode, người dùng thường đã bật sẵn
cd backend;  npm run seed                   # tạo 2 loại đơn mẫu nếu chưa có (cần backend đang chạy)
cd frontend; npm run dev
```

- `backend/.env`: `FLOWABLE_URL`, `FLOWABLE_USER=rest-admin`, `FLOWABLE_PASSWORD=test`, `DATABASE_URL` (mặc định `postgres://flowable:flowable@localhost:5433/flowable`).
- Dữ liệu Flowable nằm trong PostgreSQL (container `flowable-demo-flowable-db-1`, user/pass/db đều là `flowable`, host port 5433), restart không mất. `docker compose down -v` mới xoá sạch.
- **Một quy trình chung cho mọi loại đơn**: BPMN `requestApproval` (hằng `GENERIC_BPMN` trong `backend/src/request-types.ts`: start → userTask "Manager approval" giao `checker` → gateway `decision`). `FlowableService.ensureProcess` deploy lúc khởi động nếu Flowable chưa có hoặc nội dung khác `GENERIC_BPMN` (sửa BPMN trong code là tự lên phiên bản mới). Không có file BPMN / `.form` nào, không deploy theo loại đơn.
- **Form gắn qua `formKey` dạng biểu thức**: userTask có `flowable:formKey="${requestType}:${requestTypeVersion}:approve"`, Flowable tính lúc tạo task → vd. `reqDonXinNghiPhep:2:approve`. Backend tra form bằng `RequestTypesService.formByKey` (`formKeyOf` / `parseFormKey`). `startEvent` không có formKey (chưa có biến lúc hiện form lập đơn); form lập đơn có key `<loại>:<phiên bản>:start`.
- Loại đơn là dữ liệu, lưu trong PostgreSQL schema `app` (`RequestTypesService`, thư viện `pg`; bảng tạo lúc khởi động bằng `CREATE ... IF NOT EXISTS`): `app.request_types` (key, name, latest_version, created/updated) và `app.request_type_versions` (type_key, version, name, `fields` jsonb, saved_at/by; chỉ thêm, không sửa). Sửa loại đơn chạy trong transaction `FOR UPDATE` nên hai admin lưu cùng lúc thành hai phiên bản liên tiếp. Seed: `backend/scripts/seed-request-types.mjs`. 2 loại mẫu: `reqDonMuaThietBi` (Đơn mua thiết bị, đủ các kiểu ô và rule), `reqDonXinNghiPhep` (Đơn xin nghỉ phép). Id trường tiếng Anh, có `employeeName` để điền sẵn họ tên.
- Trường có thể có `rules` = từ khoá JSON Schema (`FieldRules`: integer → `minimum`/`maximum`/`exclusiveMinimum`/`exclusiveMaximum`/`multipleOf`; text → `minLength`/`maxLength`/`pattern`). `toJsonSchema` đưa thẳng vào schema nên rjsf tự kiểm tra; `POST processes/:key/start` kiểm tra lại bằng ajv (`checkStartValues`, bỏ ô `''`, đổi "2" → 2) rồi mới gọi Flowable. Câu báo lỗi: `toJsonSchema` sinh `errorMessage` cho từng trường (vd. `exclusiveMinimum` → "Enter a number greater than 100,000."; `pattern` → `rules.patternHint` do admin viết, không phải từ khoá JSON Schema); rjsf (`transformErrors` trong `SchemaForm`) và ajv backend (`addKeyword('errorMessage')`) cùng đọc nên hai nơi một câu. Trang thiết kế có ô Rules dưới mỗi trường (`RuleInputs` trong `FieldEditor.tsx`) và luôn gửi `rules` (kiểu không có rule gửi `{}`).
- Mỗi đơn mang biến `requestType`, `requestTypeVersion`, `requestTypeName` (`TYPE_VARS`). Form lập đơn và form duyệt được dựng lúc chạy từ đúng phiên bản đó (`startForm`, `approveForm`), nên đơn cũ luôn hiện form lúc gửi. Id trường không được trùng các biến này (`RESERVED`).
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
1. `GET /api/processes` trả về các loại đơn (id = key loại đơn), xếp theo tên. Không có `processId` thì chuyển sang loại đầu tiên.
2. Chọn loại đơn bằng các nút pill (`ProcessPicker`). `GET /api/processes/:id/start-form` tải form. `employeeName` được điền sẵn.
3. Form được vẽ bằng **react-jsonschema-form** (`shared/form/SchemaForm.tsx`, renderer duy nhất): backend trả JSON Schema + uiSchema (`toJsonSchema`), rjsf tự vẽ ô và kiểm tra (bắt buộc, kiểu, rule). `SchemaForm` dùng lại khung `.fl`/`.fi` và `DateInput` (dd/mm/yyyy). Nút gửi ở ngoài form nên gọi `ref.current.validateForm()`.
4. Nút **Submit for approval** (hàng tiêu đề, bên phải) gọi `POST /api/processes/:key/start`. Thành công thì hiện toast kèm mã đơn, form được làm trống, hàng chờ duyệt được tải lại.

### 2. Approvals (`#/approvals`, `#/approvals/:taskId`, vai trò `checker`)
1. `GET /api/tasks` trả về các đơn chờ duyệt. Bảng có ô lọc; bấm vào dòng để mở đơn. Số đơn chờ hiện cạnh menu.
2. Trang chi tiết:
   - `GET /api/tasks/:id/form` tải form duyệt (JSON Schema: các trường chỉ đọc + `managerComment`, kèm `outcomes`, `formData`); hộp thoại Reject vẽ các ô không `readOnly` bằng `SchemaForm`, tất cả bắt buộc;
   - `GET /api/requests/:id` tải thông tin đơn, timeline và lịch sử.
3. **Approve** mở hộp thoại xác nhận. **Reject** mở hộp thoại bắt buộc nhập ý kiến. Cả hai gọi `POST /api/tasks/:id/complete` với `{ outcome, values }`. Backend ghi biến `decision`, gateway trong BPMN rẽ nhánh theo biến này.
4. Xong thì hiện toast rồi quay về `#/approvals`.

### 3. Request types (`#/request-types`, `#/request-types/new`, `#/request-types/:key`, vai trò `admin`)
1. Danh sách loại đơn (`GET /api/request-types`): tên, key, số trường, phiên bản.
2. Trang thiết kế có các phần:
   - **Details**: tên loại đơn;
   - **Fields**: nhãn, kiểu (text, multi-line-text, integer, date, dropdown, boolean), ô bắt buộc, lựa chọn của dropdown, rule (số: min ≥/> và max ≤/<; chữ: độ dài, pattern), đổi thứ tự, xoá;
   - **Preview**: `POST /api/request-types/preview` dựng JSON Schema từ bản chưa lưu (cùng `normalize` + `toJsonSchema`), vẽ bằng `SchemaForm` nên rule chạy ngay; rule sai thì hiện lý do;
   - **Workflow**: cố định một bước trưởng phòng duyệt.
3. Lưu bằng `POST /api/request-types` (tạo mới) hoặc `PUT /api/request-types/:key` (phiên bản mới). Backend (`backend/src/request-types*.ts`) làm các bước sau:
   - chuẩn hoá và kiểm tra dữ liệu; sinh id trường camelCase không dấu; giữ id cũ khi sửa;
   - thêm một dòng vào `app.request_type_versions` và cập nhật `app.request_types`. Không gọi Flowable.
4. Loại đơn mới xuất hiện ngay trong New request. Đơn đã gửi vẫn hiện form của phiên bản lúc gửi. Chưa có chức năng xoá: xoá dòng trong `app.request_type_versions` thì đơn đã gửi theo phiên bản đó không mở được form duyệt nữa.

## Backend API (`/api`)

| Method | Path | Ghi chú |
|---|---|---|
| GET | `users` | người dùng demo |
| POST | `login` | `{ username, password }`, 401 nếu sai |
| GET | `processes` | loại đơn (id = key) |
| GET | `processes/:key/start-form` | form lập đơn của phiên bản mới nhất: `{ key, name, schema, uiSchema }` |
| POST | `processes/:key/start` | `{ values }`, header `x-user-id`; start `requestApproval` kèm loại đơn + phiên bản |
| GET | `requests/:id` | chi tiết đơn + timeline |
| GET | `tasks`, `tasks/done` | việc chờ / đã xử lý của người trong header |
| GET | `tasks/:id/form` | form duyệt: `{ key, name, schema, uiSchema, outcomes, formData }` |
| GET | `forms/:formKey/json-schema` | form theo formKey ở dạng JSON Schema + uiSchema (rjsf) |
| POST | `tasks/:id/complete` | `{ outcome, values }` |
| GET/POST/PUT | `request-types[/:key]`, POST `request-types/preview` | chỉ admin (403 nếu không phải admin) |

Flowable chỉ điều phối (task, giao việc, rẽ nhánh), không biết gì về form. Form do backend dựng từ loại đơn (form model kiểu Flowable, tra theo formKey) rồi chuyển sang JSON Schema trước khi trả cho frontend.

## Cấu trúc frontend (feature-based)

```
src/app/         App (QueryClient, Router, Devtools), router.tsx, layout/AppLayout.tsx, layout/nav.ts
src/features/    requests/, approvals/, request-types/, users/: mỗi feature có api.ts, hooks.ts, components/, pages/, index.ts
src/shared/      api/http.ts (axios, gắn x-user-id), auth/session.ts (phiên đăng nhập), form/ (SchemaForm = rjsf, DateInput, arrangeFields cho phần hiển thị đơn), lib/format.ts, ui/ (Cmd, Dialog, MessageBar, RecordHeader, Section, icons...)
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
- Dữ liệu thử phải được dọn đi sau khi test: đơn (DELETE `runtime/` + `history/process-instances` trên Flowable) và loại đơn (xoá dòng trong `app.request_type_versions` rồi `app.request_types`).
- Trên Windows, curl làm hỏng tiếng Việt trong body: dùng script node cho payload UTF-8.
- Heredoc trong Bash làm hỏng dấu backtick và nuốt dấu `\` (pattern `^NV\d{4}$` thành `^NVd{4}$`): script / file có ký tự này thì ghi bằng Write tool.
- Chụp màn hình: dùng puppeteer-core với Chrome tại `C:/Program Files/Google/Chrome/Application/chrome.exe`.
