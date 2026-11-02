# So sánh react-jsonschema-form và Form.io

> Bối cảnh: chọn cách làm **form động trên React** cho demo quy trình đơn từ chạy trên Flowable
> (yêu cầu: "Dùng JSON Schema kết hợp react-jsonschema-form hoặc Form.io, lưu schema theo formKey").

## 1. Tóm tắt

| | **react-jsonschema-form (RJSF)** | **Form.io** |
|---|---|---|
| Bản chất | *Thư viện vẽ form* theo chuẩn JSON Schema | *Bộ nền tảng form*: renderer + trình kéo thả (+ server tuỳ chọn) |
| Hợp với | Dev hoặc admin dùng builder riêng của app; cần giữ design system riêng | BA/nghiệp vụ tự kéo thả form phức tạp mà không cần dev |
| Khuyến nghị cho repo này | **Nên dùng** | Cân nhắc nếu yêu cầu đổi thành "BA tự kéo thả form" |

## 2. Bảng so sánh chi tiết

| Tiêu chí | **RJSF** (`@rjsf/core`) | **Form.io** (`@formio/js` + `@formio/react`) |
|---|---|---|
| **Định dạng schema** | **JSON Schema chuẩn** + `uiSchema` cho hiển thị | Định dạng **riêng** của Form.io (mảng `components`) |
| **Trình kéo thả cho admin** | **Không có** (chỉ có vài dự án cộng đồng, ít được bảo trì) | **Có sẵn**, đầy đủ |
| **Cách render** | Component React thật | Thư viện JS thuần render DOM, React chỉ là lớp bọc ngoài |
| **Giao diện** | Theme cho MUI, Ant Design, Chakra, Bootstrap...; dễ **tự viết theme** bằng component của mình | Mặc định theo Bootstrap; đổi cho giống design system riêng khá vất vả |
| **Bảng nhiều dòng** | Có (`type: array`), giao diện cơ bản | Có (Data Grid, Edit Grid), giao diện tốt sẵn |
| **Trường phụ thuộc nhau** | `if/then`, `dependencies` của JSON Schema; viết hơi dài | Conditional logic ngay trong builder: đơn giản, JSONLogic, hoặc JavaScript |
| **Trường tính toán** | Phải tự code | Có sẵn (calculated value) |
| **Wizard nhiều bước** | Tự làm | Có sẵn |
| **Upload file** | Widget cơ bản (base64); lưu trữ tự xử lý | Component có sẵn, cần cấu hình nơi lưu (S3, server riêng...) |
| **Validate ở backend** | Dùng **`ajv`** với **cùng schema**: chuẩn, nhẹ, dễ làm | Cần thư viện của Form.io chạy ở server; logic dạng JavaScript khó kiểm tra lại |
| **Độ nặng** | Nhẹ hơn (core + validator ajv) | Nặng hơn đáng kể (renderer + builder) |
| **Bản quyền** | MIT, miễn phí toàn bộ | Phần renderer và builder là MIT. **Nền tảng Enterprise trả phí** (PDF form, một số component nâng cao, quản lý form trên server) |
| **Phụ thuộc server** | Không | Không bắt buộc. Có API server riêng (Node + MongoDB) nếu muốn dùng trọn bộ |
| **Bảo mật** | Schema chỉ là dữ liệu, không chạy code | Form có thể chứa **JavaScript tuỳ ý** (điều kiện, tính toán). Cần kiểm soát ai được sửa form |
| **Chuẩn mở, dễ đổi sau này** | Cao. JSON Schema dùng được với nhiều công cụ khác (ajv, OpenAPI, sinh type TypeScript...) | Thấp. Gắn chặt với hệ sinh thái Form.io |

## 3. Ví dụ: trường "Số tài khoản" chỉ hiện khi chọn chuyển khoản

### RJSF (JSON Schema)

```json
{
  "type": "object",
  "properties": {
    "paymentMethod": { "title": "Hình thức nhận", "enum": ["Tiền mặt", "Chuyển khoản"] }
  },
  "if":   { "properties": { "paymentMethod": { "const": "Chuyển khoản" } } },
  "then": {
    "required": ["accountNo"],
    "properties": {
      "accountNo": { "title": "Số tài khoản", "type": "string", "pattern": "^[0-9]{9,14}$" }
    }
  }
}
```

### Form.io (thường do builder sinh ra, người dùng không phải viết tay)

```json
{
  "components": [
    { "type": "select", "key": "paymentMethod", "label": "Hình thức nhận",
      "data": { "values": [
        { "label": "Tiền mặt", "value": "cash" },
        { "label": "Chuyển khoản", "value": "transfer" }
      ] } },
    { "type": "textfield", "key": "accountNo", "label": "Số tài khoản",
      "validate": { "required": true, "pattern": "^[0-9]{9,14}$" },
      "conditional": { "show": true, "when": "paymentMethod", "eq": "transfer" } }
  ]
}
```

Form.io dễ đọc hơn với người không phải dev. JSON Schema chuẩn hơn và dùng lại được ở backend.

## 4. Ví dụ: bảng nhiều dòng (các khoản chi)

### RJSF

```json
{
  "type": "object",
  "properties": {
    "items": {
      "title": "Các khoản chi",
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["content", "amount"],
        "properties": {
          "content": { "title": "Nội dung", "type": "string" },
          "amount":  { "title": "Số tiền", "type": "integer", "minimum": 1, "maximum": 100000000 }
        }
      }
    }
  }
}
```

### Form.io

```json
{
  "components": [
    { "type": "datagrid", "key": "items", "label": "Các khoản chi",
      "validate": { "minLength": 1 },
      "components": [
        { "type": "textfield", "key": "content", "label": "Nội dung", "validate": { "required": true } },
        { "type": "number", "key": "amount", "label": "Số tiền",
          "validate": { "required": true, "min": 1, "max": 100000000 } }
      ] }
  ]
}
```

## 5. Tích hợp với Flowable

Cả hai **như nhau** ở phía Flowable:

```
Admin thiết kế ──► Schema form (lưu theo loại đơn / formKey)   ◄── RJSF hoặc Form.io
                         │
React vẽ form  ◄─────────┘                                      ◄── RJSF hoặc Form.io
     │ người dùng điền
     ▼
Backend nhận { values } ──► Flowable: lưu biến, tạo task, rẽ nhánh   ◄── giữ nguyên
```

- Flowable chỉ nhận **giá trị** người dùng điền, dưới dạng biến. Nó không biết form được vẽ bằng gì.
- **Dữ liệu lồng nhau** (bảng nhiều dòng) lưu thành biến kiểu `json` của Flowable, hoặc chuỗi JSON.
- **Gateway chỉ nên đọc trường phẳng.** Ví dụ muốn rẽ nhánh theo tổng tiền thì backend tính `totalAmount` rồi ghi thành biến riêng.
- Schema được tra theo `formKey` của task (ví dụ `leaveRequest:1:approve`), đúng với yêu cầu "lưu schema theo formKey". Repo đã làm phần này: BPMN chung có `flowable:formKey="${requestType}:${requestTypeVersion}:approve"`, đổi thư viện form không phải sửa gì ở đây.

## 6. Nên chọn khi nào

**Chọn RJSF khi:**
- Người thiết kế form là **dev**, hoặc admin chỉ cần builder đơn giản do app tự làm.
- Cần **giữ style riêng** của app (token, font, component có sẵn).
- Muốn **validate giống nhau ở frontend và backend** (`ajv`), và không muốn form chứa code chạy được.

**Chọn Form.io khi:**
- **BA hoặc nghiệp vụ tự kéo thả** form phức tạp (wizard, bảng, trường tính toán) mà không cần dev.
- Chấp nhận giao diện form theo kiểu Form.io, và chấp nhận phụ thuộc vào hệ sinh thái của họ.
- Có thể cần đến tính năng trả phí sau này (PDF form, quản lý form tập trung).

## 7. Khuyến nghị cho repo flowable-demo

Dùng **RJSF**, vì:

1. Repo đã có **trình thiết kế riêng** (màn Request types). Chỉ cần đổi đầu ra từ `fields[]` sang JSON Schema, không cần builder kéo thả.
2. Giao diện đang theo token riêng (`tokens.css`). RJSF cho tự viết theme bằng component trong `shared/ui`, còn Form.io sẽ khó cho giống.
3. Backend NestJS dùng `ajv` validate lại đúng schema đó, đơn giản và an toàn.

Các phần cần đổi nếu chuyển sang RJSF:

| Phần | Thay đổi |
|---|---|
| Lưu loại đơn | `fields[]` thành `schema` + `uiSchema` (vẫn theo phiên bản) |
| Frontend lập đơn và duyệt | `shared/form` được thay bằng RJSF + theme tự viết. Form duyệt = cùng schema ở chế độ `readonly`, thêm ô ý kiến |
| Màn thiết kế của admin | Sinh JSON Schema từ các trường admin nhập (giữ giao diện hiện tại) |
| Backend | Validate bằng `ajv`; lưu biến lồng nhau dạng `json` |

Nếu sau này yêu cầu đổi thành "BA tự kéo thả form phức tạp, không cần dev", lúc đó mới cân nhắc Form.io.
