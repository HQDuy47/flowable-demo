import Form from '@rjsf/core';
import type { FieldTemplateProps, ObjectFieldTemplateProps, RJSFSchema, RJSFValidationError, UiSchema, WidgetProps } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { useState, type Ref } from 'react';
import { DateInput } from './DateInput';
import type { FormValues } from './types';

export type SchemaFormRef = Form<FormValues>;

/** Một dòng nhãn trái, dùng lại khung .fl của renderer tự viết để hai cách trông giống nhau. */
function FieldTemplate({ id, label, required, rawErrors, children, hidden, schema, uiSchema }: FieldTemplateProps) {
  if (schema.type === 'object') return children; // object gốc: chỉ bọc các trường
  if (hidden) return <div hidden>{children}</div>;
  const err = rawErrors?.[0];
  const wide = uiSchema?.['ui:widget'] === 'textarea';
  return (
    <div className={`fl${wide ? ' fl--wide' : ''}${err ? ' is-invalid' : ''}`}>
      <label className="fl__label" htmlFor={id}>
        {label}{required && <span className="req" aria-hidden="true"> *</span>}
      </label>
      <div className="fl__ctl">
        {children}
        {/* id khớp aria-describedby mà widget của rjsf tự gắn */}
        <span className="fl__msg" id={`${id}__error`}>{err}</span>
      </div>
    </div>
  );
}

/** Ô ngày dùng lại DateInput (luôn dd/mm/yyyy) thay cho input type="date" theo ngôn ngữ trình duyệt. */
function DateWidget({ id, value, required, onChange, onBlur }: WidgetProps) {
  return (
    <DateInput value={value ?? ''} onChange={iso => onChange(iso || undefined)}
      inputProps={{ id, onBlur: () => onBlur(id, value), 'aria-required': required || undefined, 'aria-describedby': `${id}__error` }} />
  );
}

function ObjectFieldTemplate({ properties }: ObjectFieldTemplateProps) {
  return <div className="fgrid">{properties.map(p => p.content)}</div>;
}

/**
 * Câu báo lỗi dễ hiểu: backend đặt sẵn trong `errorMessage` của từng trường (vd. "Enter a number greater than 100,000.")
 * thay cho câu kỹ thuật của ajv ("must match pattern ..."). Không có thì giữ câu của ajv.
 */
const messagesFrom = (schema: RJSFSchema) => (errors: RJSFValidationError[]) =>
  errors.map(e => {
    const id = e.property?.replace(/^\./, '') ?? '';
    const field = schema.properties?.[id];
    const custom = typeof field === 'object' ? (field as { errorMessage?: Record<string, string> }).errorMessage : undefined;
    const text = custom?.[e.name ?? ''];
    return { ...e, message: text ?? (e.name === 'required' ? 'This field is required.' : e.message) };
  });

/**
 * Vẽ form bằng react-jsonschema-form: thư viện tự chọn ô nhập theo kiểu dữ liệu và tự kiểm tra theo schema (ajv).
 * Nút gửi nằm ngoài form (hàng tiêu đề), nên gọi ref.current.validateForm() trước khi gửi.
 */
export function SchemaForm({ def, data, onChange, ref }: {
  def: { schema: RJSFSchema; uiSchema?: UiSchema }; data: FormValues; onChange: (data: FormValues) => void; ref?: Ref<SchemaFormRef>;
}) {
  // bấm gửi lần đầu xong mới kiểm tra theo từng phím, để form mới mở không đỏ cả lượt
  const [live, setLive] = useState(false);
  return (
    <Form<FormValues>
      ref={ref}
      schema={def.schema}
      uiSchema={{
        ...def.uiSchema,
        'ui:globalOptions': { label: false }, // nhãn do FieldTemplate vẽ, widget (checkbox) không vẽ thêm
        'ui:submitButtonOptions': { norender: true },
      }}
      validator={validator}
      templates={{ FieldTemplate, ObjectFieldTemplate }}
      widgets={{ DateWidget }}
      formData={data}
      onChange={e => onChange(e.formData ?? {})}
      onError={() => setLive(true)}
      liveValidate={live}
      showErrorList={false}
      noHtml5Validate
      transformErrors={messagesFrom(def.schema)}
    />
  );
}
