// Tạo các loại đơn mẫu qua API (backend phải đang chạy). Loại nào đã có (trùng tên) thì bỏ qua.
// Chạy: cd backend; npm run seed      (API khác: API_URL=http://host:3000/api npm run seed)
const API = process.env.API_URL ?? 'http://localhost:3000/api';
const headers = { 'content-type': 'application/json', 'x-user-id': 'admin' };

const CODE_HINT = 'Use NV followed by 4 digits, for example NV0123.';

const SAMPLES = [
  {
    name: 'Đơn mua thiết bị',
    fields: [
      { id: 'employeeName', name: 'Họ tên', type: 'text', required: true, rules: { maxLength: 100 } },
      { id: 'employeeCode', name: 'Mã nhân viên', type: 'text', required: true, rules: { pattern: '^NV\\d{4}$', patternHint: CODE_HINT } },
      { id: 'equipmentName', name: 'Tên thiết bị', type: 'text', required: true, rules: { minLength: 3, maxLength: 100 } },
      { id: 'category', name: 'Loại thiết bị', type: 'dropdown', required: true, options: ['Laptop', 'Màn hình', 'Bàn phím', 'Chuột', 'Khác'] },
      { id: 'quantity', name: 'Số lượng', type: 'integer', required: true, rules: { minimum: 1, maximum: 50 } },
      { id: 'unitPrice', name: 'Đơn giá (VNĐ)', type: 'integer', required: true, rules: { exclusiveMinimum: 100000, maximum: 500000000 } },
      { id: 'neededBy', name: 'Ngày cần', type: 'date', required: true },
      { id: 'urgent', name: 'Cần gấp', type: 'boolean', required: false },
      { id: 'reason', name: 'Lý do mua', type: 'multi-line-text', required: true, rules: { minLength: 10, maxLength: 1000 } },
    ],
  },
  {
    name: 'Đơn xin nghỉ phép',
    fields: [
      { id: 'employeeName', name: 'Họ tên', type: 'text', required: true, rules: { maxLength: 100 } },
      { id: 'employeeCode', name: 'Mã nhân viên', type: 'text', required: true, rules: { pattern: '^NV\\d{4}$', patternHint: CODE_HINT } },
      { id: 'leaveType', name: 'Loại nghỉ', type: 'dropdown', required: true, options: ['Phép năm', 'Nghỉ ốm', 'Việc riêng', 'Nghỉ không lương'] },
      { id: 'fromDate', name: 'Từ ngày', type: 'date', required: true },
      { id: 'toDate', name: 'Đến ngày', type: 'date', required: true },
      { id: 'handoverTo', name: 'Người bàn giao', type: 'text', required: true, rules: { minLength: 2, maxLength: 100 } },
      { id: 'reason', name: 'Lý do', type: 'multi-line-text', required: true, rules: { minLength: 10, maxLength: 500 } },
    ],
  },
];

const existing = await fetch(`${API}/request-types`, { headers }).then((r) => {
  if (!r.ok) throw new Error(`GET request-types: HTTP ${r.status}`);
  return r.json();
});
for (const sample of SAMPLES) {
  if (existing.some((t) => t.name === sample.name)) {
    console.log(`skip    ${sample.name} (already exists)`);
    continue;
  }
  const r = await fetch(`${API}/request-types`, { method: 'POST', headers, body: JSON.stringify(sample) });
  const body = await r.json();
  if (!r.ok) throw new Error(`${sample.name}: HTTP ${r.status} ${body.message}`);
  console.log(`created ${sample.name} → ${body.key}`);
}
