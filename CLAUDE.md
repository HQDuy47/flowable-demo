# Flowable request demo

Demo quy trình đơn từ (lập đơn → trưởng phòng duyệt) chạy trên Flowable. Gồm các phần:

| Thành phần | Vai trò | Cổng |
|---|---|---|
| PostgreSQL | database `flowable6`: dữ liệu Flowable (bảng `act_*`, form engine `act_fo_*`); database `flowable`: loại đơn (schema `app`) | 5433 |
| Flowable REST 6.8.0 | điều phối quy trình + form engine (lưu form definition) | 8081 |
| `backend/` | NestJS BFF, gọi Flowable REST, gộp dữ liệu cho UI | 3000 |
| `frontend/` | React 19 + Vite admin UI | 5173 (proxy `/api` → 3000) |

Người dùng nói tiếng Việt: trả lời bằng tiếng Việt. Comment trong code viết tiếng Việt; chữ trên giao diện và thông báo lỗi từ backend viết tiếng Anh.

## Chạy

```powershell
docker compose up -d                        # flowable/flowable-rest:6.8.0 + PostgreSQL 16 (volume flowable-db-data)
cd backend;  npm run start:dev              # watch mode, người dùng thường đã bật sẵn
cd backend;  npm run seed                   # tạo 2 loại đơn mẫu nếu chưa có (cần backend đang chạy)
cd frontend; npm run dev
```

- `backend/.env`: `FLOWABLE_URL` (process API `.../flowable-rest/service`; form API suy ra `.../flowable-rest/form-api/form-repository`, hoặc đặt `FLOWABLE_FORM_URL`), `FLOWABLE_USER=rest-admin`, `FLOWABLE_PASSWORD=test`, `DATABASE_URL` (mặc định `postgres://flowable:flowable@localhost:5433/flowable`).
- **Flowable 6.8.0** vì bản mã nguồn mở 7.x đã bỏ form engine (`form-api` trả 404; `flowable-form-engine` chỉ phát hành tới 6.8.1). Flowable dùng database `flowable6` (tạo bằng `docker/postgres-init/01-flowable6.sql` khi volume trống); database `flowable` giữ schema `app` và bảng `act_*` cũ của Flowable 7.1 (không dùng nữa, 6.8 không chạy ngược được trên schema 7.1). Container `flowable-demo-flowable-db-1`, user/pass đều là `flowable`, host port 5433, restart không mất. `docker compose down -v` mới xoá sạch.
- **Một quy trình chung cho mọi loại đơn**: BPMN `requestApproval` (hằng `GENERIC_BPMN` trong `backend/src/workflow/bpmn.ts`: start → userTask "Manager approval" giao `checker` → gateway `decision`). `WorkflowService.ensureProcess` deploy lúc khởi động nếu Flowable chưa có hoặc nội dung khác `GENERIC_BPMN` (sửa BPMN trong code là tự lên phiên bản mới). Không có file BPMN / `.form` trong repo.
- **Form definition nằm trên form engine của Flowable** (`FlowableFormsService`, REST `form-api`): mỗi phiên bản loại đơn được deploy thành hai form `<loại>:<phiên bản>:start` và `:approve` (`startForm` / `approveForm` sinh JSON `.form`; mỗi form một deployment vì REST chỉ nhận file đầu tiên). Deploy lúc admin lưu (trong transaction, Flowable lỗi thì không lưu); lúc backend khởi động `syncForms` deploy bù phiên bản còn thiếu; `formByKey` không thấy trên Flowable mà phiên bản còn trong DB thì cũng deploy bù. Trường form Flowable chỉ nhận `id, name, type, value, required, readOnly, placeholder, layout, overrideId, params` (thuộc tính lạ → "Error parsing form definition JSON"), nên rule và câu lỗi nằm trong `params.rules` / `params.messages`.
- **Form gắn qua `formKey` dạng biểu thức**: userTask có `flowable:formKey="${requestType}:${requestTypeVersion}:approve"`, Flowable tính lúc tạo task → vd. `reqDonXinNghiPhep:2:approve`. Backend lấy form từ Flowable bằng `RequestTypesService.formByKey` (`formKeyOf` / `parseFormKey`; cache theo formKey vì phiên bản không đổi). `startEvent` không có formKey (chưa có biến lúc hiện form lập đơn); form lập đơn có key `<loại>:<phiên bản>:start`.
- Loại đơn là dữ liệu, lưu trong PostgreSQL schema `app` (`RequestTypesService`, thư viện `pg`; bảng tạo lúc khởi động bằng `CREATE ... IF NOT EXISTS`): `app.request_types` (key, name, latest_version, created/updated) và `app.request_type_versions` (type_key, version, name, `fields` jsonb, saved_at/by; chỉ thêm, không sửa). Sửa loại đơn chạy trong transaction `FOR UPDATE` nên hai admin lưu cùng lúc thành hai phiên bản liên tiếp. Seed: `backend/scripts/seed-request-types.mjs`. 2 loại mẫu: `reqDonMuaThietBi` (Đơn mua thiết bị, đủ các kiểu ô và rule), `reqDonXinNghiPhep` (Đơn xin nghỉ phép). Id trường tiếng Anh.
- Trường có thể có `rules` = từ khoá JSON Schema (`FieldRules`: integer → `minimum`/`maximum`/`exclusiveMinimum`/`exclusiveMaximum`/`multipleOf`; text → `minLength`/`maxLength`/`pattern`). `toJsonSchema` đưa thẳng vào schema nên rjsf tự kiểm tra; `POST processes/:key/start` kiểm tra lại bằng ajv (`FormSchemasService.validate`, bỏ ô `''`, đổi "2" → 2) rồi mới gọi Flowable; phiên bản mới nhất chỉ đọc một lần (`RequestTypesService.latestStart`) nên kiểm tra và ghi cùng phiên bản. `validate` chỉ giữ ô có trong form và không `readOnly`, nên client không ghi đè được biến hệ thống (`initiator`, `requestTypeVersion`…); `POST tasks/:id/complete` cũng qua `validate` theo form duyệt và chỉ nhận `outcome` có trong form. Câu báo lỗi: `toJsonSchema` sinh `errorMessage` cho từng trường (vd. `exclusiveMinimum` → "Enter a number greater than 100,000."; `pattern` → `rules.patternHint` do admin viết, không phải từ khoá JSON Schema); rjsf (`transformErrors` trong `SchemaForm`) và ajv backend (`addKeyword('errorMessage')`) cùng đọc nên hai nơi một câu. Trang thiết kế có ô Rules dưới mỗi trường (`RuleInputs` trong `FieldEditor.tsx`) và luôn gửi `rules` (kiểu không có rule gửi `{}`).
- Mỗi đơn mang biến `requestType`, `requestTypeVersion`, `requestTypeName` (`TYPE_VARS`). Form lập đơn và form duyệt tra theo formKey của đúng phiên bản đó, nên đơn cũ luôn hiện form lúc gửi. Chỉ Preview của trang thiết kế dựng form từ bản nháp chưa lưu.
- **Hai cách lưu form, để demo cạnh nhau** (mỗi phiên bản lưu cả hai lúc admin lưu, trong cùng transaction):
  - cách 1: form definition trên form engine Flowable (`formByKey`, endpoint `forms/:formKey`), renderer tự viết vẽ;
  - cách 2: JSON Schema + uiSchema + outcomes trong bảng `app.form_schemas` (khoá `form_key`, sinh bằng `toJsonSchema`; `FormSchemasService` lưu / đọc / kiểm tra bằng ajv, endpoint `forms/:formKey/json-schema`, `processes/:key/start-form`, `tasks/:id/form`), rjsf vẽ. Cột kiểu `json` (không phải `jsonb`, vì jsonb sắp lại key làm đảo thứ tự trường). Khởi động thì `syncSchemas` lưu bù phiên bản còn thiếu. ajv backend (`FormSchemasService.validate`) kiểm tra bằng schema này cho cả hai renderer. Id trường không được trùng các biến này (`RESERVED`).
- Kiểm tra: `cd frontend; npx tsc -b; npx vite build`. Backend: `npm run build`.
- Cấu trúc backend (một `AppModule`, thư mục theo feature):
  - `common/`: `database.service.ts` (pg pool, `tx`), `flowable-http.ts` (gọi Flowable REST, đổi lỗi thành HttpException), `users.ts`;
  - `auth/`: `users`, `login`;
  - `forms/`: `form-definition.ts` (formKey, `startForm`/`approveForm`, `toJsonSchema`), `flowable-forms.service.ts` (cách 1), `form-schemas.service.ts` (cách 2 + ajv), `forms.controller.ts`;
  - `request-types/`: `request-type.model.ts` (kiểu, `normalize`, sinh key/id), service (CRUD, phiên bản, lưu form vào hai nơi, đồng bộ lúc khởi động), controller;
  - `workflow/`: `bpmn.ts` (`GENERIC_BPMN`, `TYPE_VARS`, `APPROVER`), `flowable.types.ts` (kiểu dữ liệu Flowable REST trả về), `workflow.service.ts` (process API: gửi đơn, task, duyệt, lịch sử), controller.

## Người dùng và vai trò

Đăng nhập demo ở `#/login` qua `POST /api/login`. Mật khẩu chung là `123456` (`DEMO_PASSWORD` trong `backend/src/common/users.ts`), chưa có token. Phiên lưu ở sessionStorage, mỗi tab một phiên (`frontend/src/shared/auth/session.ts`). Axios interceptor tự gắn header `x-user-id`. Backend vẫn tin header này.

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
2. Chọn loại đơn bằng các nút pill (`ProcessPicker`). `GET /api/processes/:id/start-form` tải form. Không điền sẵn ô nào.
3. Form vẽ bằng một trong hai renderer, chọn bằng nút **Flowable form / JSON Schema** (`RendererSwitch`) trên hàng tiêu đề màn New request và Approvals (nhớ trong localStorage, `useFormRenderer`). `DynamicForm` (`shared/form/DynamicForm.tsx`) bọc cả hai, nút gửi ở ngoài form gọi `ref.current.validate()`:
   - **Flowable form + renderer tự viết** (`FlowableForm.tsx`): tải form definition từ Flowable qua `GET /api/forms/:formKey` (fields: id, name, type, required, readOnly, options, `params.rules`, `params.messages`), mỗi kiểu ô một component (`CONTROLS`), kiểm tra bằng `fieldProblem` (`validate.ts`) với câu lỗi lấy từ `params.messages` (backend sinh lúc deploy, cùng `errorMessages` với JSON Schema).
   - **JSON Schema + rjsf** (`SchemaForm.tsx`): JSON Schema + uiSchema lưu theo formKey trong `app.form_schemas`, rjsf tự vẽ ô và kiểm tra. Trang Preview của Request types chỉ dùng cách này.
   - Summary (New request) / Processing (Approvals) hiện `Form key`, `Form source`, `Renderer` theo cách đang chọn.
   - Hai renderer dùng chung khung `.fl`/`.fi`, `DateInput` (dd/mm/yyyy) và cách lưu giá trị (ô trống → undefined, số → number) nên đổi renderer giữa chừng không mất dữ liệu.
4. Nút **Submit for approval** (hàng tiêu đề, bên phải) gọi `POST /api/processes/:key/start`. Thành công thì hiện toast kèm mã đơn, form được làm trống, hàng chờ duyệt được tải lại.

### 2. Approvals (`#/approvals`, `#/approvals/:taskId`, vai trò `checker`)
1. `GET /api/tasks` trả về các đơn chờ duyệt. Bảng có ô lọc; bấm vào dòng để mở đơn. Số đơn chờ hiện cạnh menu.
2. Trang chi tiết:
   - `GET /api/tasks/:id/form` tải form duyệt (JSON Schema: các trường chỉ đọc + `managerComment`, kèm `outcomes`, `formData`); hộp thoại Reject vẽ các ô không `readOnly` bằng renderer đang chọn (`DynamicForm editableOnly`), tất cả bắt buộc;
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
3. Lưu bằng `POST /api/request-types` (tạo mới) hoặc `PUT /api/request-types/:key` (phiên bản mới). Backend (`backend/src/request-types/`) làm các bước sau:
   - chuẩn hoá và kiểm tra dữ liệu; sinh id trường camelCase không dấu; giữ id cũ khi sửa;
   - thêm một dòng vào `app.request_type_versions`, cập nhật `app.request_types`, và deploy hai form definition của phiên bản đó lên form engine Flowable.
4. Loại đơn mới xuất hiện ngay trong New request. Đơn đã gửi vẫn hiện form của phiên bản lúc gửi. Chưa có chức năng xoá: form của phiên bản cũ vẫn nằm trên Flowable; xoá cả dòng trong `app.request_type_versions` lẫn form deployment thì đơn đã gửi theo phiên bản đó không mở được form duyệt nữa.

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
| GET | `forms/:formKey` | form definition lấy nguyên từ form engine Flowable theo formKey (renderer tự viết) |
| GET | `forms/:formKey/json-schema` | JSON Schema + uiSchema lưu theo formKey trong `app.form_schemas` (rjsf) |
| POST | `tasks/:id/complete` | `{ outcome, values }` |
| GET/POST/PUT | `request-types[/:key]`, POST `request-types/preview` | chỉ admin (403 nếu không phải admin) |

Flowable điều phối (task, giao việc, rẽ nhánh) và giữ form definition (form engine, cách 1). JSON Schema của cách 2 nằm trong `app.form_schemas`. Cả hai tra theo cùng formKey mà Flowable gắn trên task.

## Cấu trúc frontend (feature-based)

```
src/app/         App (QueryClient, Router, Devtools), router.tsx, layout/AppLayout.tsx, layout/nav.ts
src/features/    requests/, approvals/, request-types/, users/: mỗi feature có api.ts, hooks.ts, components/, pages/, index.ts
src/shared/      api/http.ts (axios, gắn x-user-id), auth/session.ts (phiên đăng nhập), form/ (DynamicForm, FlowableForm = renderer tự viết, SchemaForm = rjsf, RendererSwitch, DateInput, arrangeFields cho phần hiển thị đơn), lib/format.ts, ui/ (Cmd, Dialog, MessageBar, RecordHeader, Section, icons...)
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
- Dữ liệu thử phải được dọn đi sau khi test: đơn (DELETE `runtime/process-instances/:id` nếu còn chạy, rồi `history/historic-process-instances/:id` trên Flowable) và loại đơn (xoá form deployment trên Flowable: `form-api/form-repository/form-definitions?keyLike=<loại>:%` → DELETE `form-api/form-repository/deployments/:deploymentId`; rồi xoá dòng trong `app.form_schemas` (`form_key LIKE '<loại>:%'`), `app.request_type_versions`, `app.request_types`).
- Trên Windows, curl làm hỏng tiếng Việt trong body: dùng script node cho payload UTF-8.
- Heredoc trong Bash làm hỏng dấu backtick và nuốt dấu `\` (pattern `^NV\d{4}$` thành `^NVd{4}$`): script / file có ký tự này thì ghi bằng Write tool.
- Chụp màn hình: dùng puppeteer-core với Chrome tại `C:/Program Files/Google/Chrome/Application/chrome.exe`.
