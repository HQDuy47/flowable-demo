import { Link } from 'react-router-dom';
import type { User } from '@/features/users';
import { Fields, useDynamicForm, type FormModel } from '@/shared/form';
import { code, errorMessage } from '@/shared/lib/format';
import { Cmd, KeyValues, MessageBar, RecordHeader, Section } from '@/shared/ui';
import type { Process } from '../api';
import { useStartProcess } from '../hooks';
import { ProcessPicker } from './ProcessPicker';

export type SentNotice = { id: string; name: string };

/** Form lập đơn cho một loại đơn: tiêu đề + nút, chọn loại đơn, các trường, thông tin giao dịch. */
export function CreateRequestForm({ process, processes, employee, model, sent, onDismissSent, onSent }: {
  process: Process; processes: Process[]; employee?: User; model: FormModel;
  sent: SentNotice | null; onDismissSent: () => void; onSent: (requestId: string) => void;
}) {
  const ctl = useDynamicForm(model);
  const start = useStartProcess();

  const submit = () => {
    start.reset();
    if (!ctl.validate()) return;
    start.mutate({ processKey: process.key, values: ctl.payload() }, { onSuccess: res => onSent(res.id) });
  };

  return (
    <>
      <RecordHeader
        actions={<>
          <Cmd icon="reset" label="Reset" disabled={start.isPending} onClick={() => { ctl.reset(); start.reset(); }} />
          <Cmd icon="send" label="Submit for approval" primary busy={start.isPending} onClick={submit} />
        </>}
        title="New request"
        fields={[{ label: 'Requester', value: employee?.name ?? '...' }]}
      />
      <ProcessPicker processes={processes} current={process.id} />
      <div className="body">
        <div className="body__main">
          {sent && (
            <MessageBar intent="success" onDismiss={onDismissSent}>
              <b>Submitted {sent.name}</b>, request ID <span className="mono">{code(sent.id)}</span>. It is now waiting for the manager's approval.{' '}
              <Link className="link" to="/approvals">Open approvals</Link>
            </MessageBar>
          )}
          {start.isError && (
            <MessageBar intent="error" onDismiss={() => start.reset()}><b>The request was not submitted.</b> {errorMessage(start.error)}</MessageBar>
          )}
          <Section title={model.name ?? 'Request details'}>
            <Fields ctl={ctl} />
          </Section>
        </div>
        <aside className="body__side">
          <Section title="Summary">
            <KeyValues rows={[
              { label: 'Request ID', value: <span className="muted">Assigned on submit</span> },
              { label: 'Status', value: 'Draft' },
              { label: 'Type', value: process.name || process.key },
            ]} />
          </Section>
        </aside>
      </div>
    </>
  );
}
