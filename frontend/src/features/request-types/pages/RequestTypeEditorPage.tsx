import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Fields, useDynamicForm, type FormModel } from '@/shared/form';
import { errorMessage } from '@/shared/lib/format';
import { Cmd, KeyValues, Problem, RecordHeader, Section, Skeleton, When } from '@/shared/ui';
import type { RequestType, RequestTypeInput } from '../api';
import { FieldEditor, newField, type DraftField } from '../components/FieldEditor';
import { useRequestType, useRequestTypes, useSaveRequestType } from '../hooks';

/** Trang thiết kế loại đơn: #/request-types/new hoặc #/request-types/<key>. */
export default function RequestTypeEditorPage() {
  const { key } = useParams<{ key: string }>();
  const isNew = !key || key === 'new';
  const existing = useRequestType(isNew ? undefined : key);

  if (isNew) return <Editor key="new" />;
  if (existing.isError) return <div className="pad"><Problem error={existing.error} onRetry={() => existing.refetch()} /></div>;
  if (!existing.data) return <div className="pad"><Skeleton rows={8} /></div>;
  return <Editor key={`${existing.data.key}-${existing.data.updatedAt}`} saved={existing.data} />;
}

const toDraft = (t: RequestType): DraftField[] =>
  t.fields.map(f => ({ uid: f.id, id: f.id, name: f.name, type: f.type, required: f.required, options: (f.options ?? []).join('\n') }));

const toInput = (name: string, fields: DraftField[]): RequestTypeInput => ({
  name: name.trim(),
  fields: fields.map(f => ({
    ...(f.id ? { id: f.id } : {}),
    name: f.name.trim(), type: f.type, required: f.required,
    ...(f.type === 'dropdown' ? { options: f.options.split('\n').map(o => o.trim()).filter(Boolean) } : {}),
  })),
});

function Editor({ saved }: { saved?: RequestType }) {
  const navigate = useNavigate();
  const [name, setName] = useState(saved?.name ?? '');
  const [fields, setFields] = useState<DraftField[]>(() => (saved ? toDraft(saved) : [newField()]));
  const [showErrors, setShowErrors] = useState(false);
  const save = useSaveRequestType();
  // phiên bản chỉ có trong API danh sách; màn tạo mới không cần nên không gọi
  const version = useRequestTypes(!!saved).data?.find(t => t.key === saved?.key)?.version;

  const input = toInput(name, fields);
  const invalid = !input.name || input.fields.some(f => !f.name || (f.type === 'dropdown' && !f.options?.length));
  const dirty = !saved || JSON.stringify(input) !== JSON.stringify(toInput(saved.name, toDraft(saved)));

  const submit = () => {
    if (invalid) {
      setShowErrors(true);
      toast.error('Some details are missing.', { description: 'Name the request type, label every field, and give each dropdown at least one option.' });
      return;
    }
    save.mutate({ key: saved?.key, input }, {
      // lưu xong về danh sách
      onSuccess: rt => {
        toast.success(`Saved ${rt.name} (v${rt.version})`, { description: 'Employees can now pick it in New request. Requests already submitted keep the form they were sent with.' });
        navigate('/request-types', { replace: true });
      },
      onError: err => toast.error('The request type was not saved.', { description: errorMessage(err) }),
    });
  };

  return (
    <>
      <RecordHeader
        title={saved ? saved.name : 'New request type'}
        fields={saved
          ? [{ label: 'Key', value: <span className="mono">{saved.key}</span> }, { label: 'Version', value: version ? `v${version}` : '...' }]
          : [{ label: 'Approver', value: 'Department manager' }]}
        actions={<>
          <Cmd icon="back" label="Back" to="/request-types" />
          <Cmd icon="save" label={saved ? 'Save new version' : 'Create'} primary busy={save.isPending} disabled={!dirty} onClick={submit} />
        </>}
      />
      <div className="body">
        <div className="body__main">
          <Section title="Details">
            <div className="fgrid">
              <div className={`fl fl--wide${showErrors && !input.name ? ' is-invalid' : ''}`}>
                <label className="fl__label" htmlFor="rt-name">Name<span className="req" aria-hidden="true"> *</span></label>
                <div className="fl__ctl">
                  <input id="rt-name" className="fi" value={name} maxLength={80} placeholder="e.g. Equipment purchase request"
                    aria-invalid={(showErrors && !input.name) || undefined} onChange={e => setName(e.target.value)} />
                </div>
              </div>
            </div>
          </Section>
          <Section title="Fields">
            <FieldEditor fields={fields} onChange={setFields} showErrors={showErrors} />
          </Section>
          <Preview input={input} />
        </div>
        <aside className="body__side">
          <Section title="Workflow">
            <ol className="flow">
              <li><b>Employee submits</b><small>Fills in the form you design here</small></li>
              <li><b>Manager approval</b><small>Approves, or rejects with a comment</small></li>
              <li><b>Approved or rejected</b><small>The request is closed</small></li>
            </ol>
          </Section>
          {saved && (
            <Section title="Versions">
              <KeyValues rows={[
                { label: 'Current version', value: version ? `v${version}` : '...' },
                { label: 'Fields', value: saved.fields.length },
                { label: 'Created', value: <When at={saved.createdAt} /> },
                { label: 'Updated', value: <When at={saved.updatedAt} /> },
              ]} />
            </Section>
          )}
        </aside>
      </div>
    </>
  );
}

/** Xem trước form lập đơn. Form được tạo lại mỗi khi cấu trúc trường thay đổi. */
function Preview({ input }: { input: RequestTypeInput }) {
  const model: FormModel = {
    name: input.name || 'Untitled request type',
    fields: input.fields.map((f, i) => ({
      id: f.id ?? `preview${i}`, name: f.name || `Field ${i + 1}`, type: f.type, required: f.required,
      options: f.options?.map(o => ({ name: o })),
    })),
  };
  return (
    <Section title="Preview">
      <PreviewForm key={JSON.stringify(model.fields)} model={model} />
      <p className="sec__hint">This is how {input.name || 'the form'} looks in New request. You can try it here; nothing is submitted.</p>
    </Section>
  );
}

function PreviewForm({ model }: { model: FormModel }) {
  const ctl = useDynamicForm(model);
  return <Fields ctl={ctl} />;
}
