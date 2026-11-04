import { useQuery } from '@tanstack/react-query';
import { useImperativeHandle, useMemo, useRef, type Ref } from 'react';
import { http } from '../api/http';
import { Problem, Skeleton } from '../ui';
import { FlowableForm, type FlowableFormRef } from './FlowableForm';
import { SchemaForm, type SchemaFormRef } from './SchemaForm';
import type { FlowableFormModel, FormRenderer, FormValues, SchemaFormDef } from './types';

export type DynamicFormRef = { validate: () => boolean };

/** Form model gốc kiểu Flowable theo formKey. formKey gắn với một phiên bản không bao giờ sửa nên giữ mãi trong cache. */
export function useFlowableForm(formKey: string, enabled = true) {
  return useQuery({
    queryKey: ['forms', formKey],
    queryFn: () => http.get<FlowableFormModel>(`/forms/${encodeURIComponent(formKey)}`).then(r => r.data),
    enabled,
    staleTime: Infinity,
  });
}

/** Chỉ giữ các ô được sửa (bỏ ô readOnly của đơn) và bắt buộc tất cả, vd. ô ý kiến khi từ chối. */
const editableModel = (m: FlowableFormModel): FlowableFormModel =>
  ({ ...m, fields: m.fields.filter(f => !f.readOnly).map(f => ({ ...f, required: true })) });

function editableSchema(def: SchemaFormDef): SchemaFormDef {
  const properties = Object.fromEntries(
    Object.entries(def.schema.properties ?? {}).filter(([, p]) => typeof p === 'object' && !p.readOnly),
  );
  return { ...def, schema: { ...def.schema, properties, required: Object.keys(properties) } };
}

/**
 * Một form theo formKey, vẽ bằng renderer được chọn:
 * - "flowable": tải form model gốc (GET /api/forms/:formKey) rồi vẽ bằng FlowableForm (tự viết);
 * - "rjsf": dùng JSON Schema có sẵn trong `def` và vẽ bằng react-jsonschema-form.
 * Gọi ref.current.validate() trước khi gửi, renderer nào cũng vậy.
 */
export function DynamicForm({ renderer, def, data, onChange, editableOnly, ref }: {
  renderer: FormRenderer; def: SchemaFormDef; data: FormValues; onChange: (data: FormValues) => void;
  /** chỉ vẽ các ô không readOnly và bắt buộc tất cả */
  editableOnly?: boolean;
  ref?: Ref<DynamicFormRef>;
}) {
  const model = useFlowableForm(def.key, renderer === 'flowable');
  const rjsf = useRef<SchemaFormRef>(null);
  const flow = useRef<FlowableFormRef>(null);
  useImperativeHandle(ref, () => ({
    validate: () => (renderer === 'rjsf' ? !!rjsf.current?.validateForm() : !!flow.current?.validate()),
  }), [renderer]);

  const schemaDef = useMemo(() => (editableOnly ? editableSchema(def) : def), [def, editableOnly]);
  const flowDef = useMemo(() => (model.data && editableOnly ? editableModel(model.data) : model.data), [model.data, editableOnly]);

  if (renderer === 'rjsf') return <SchemaForm ref={rjsf} def={schemaDef} data={data} onChange={onChange} />;
  if (model.isError) return <Problem error={model.error} onRetry={() => model.refetch()} />;
  if (!flowDef) return <Skeleton rows={4} />;
  return <FlowableForm ref={flow} form={flowDef} data={data} onChange={onChange} />;
}
