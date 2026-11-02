import { toast } from 'sonner';
import type { User } from '@/features/users';
import { Fields, useDynamicForm, type FormModel } from '@/shared/form';
import { code, errorMessage } from '@/shared/lib/format';
import { Cmd, KeyValues, RecordHeader, Section } from '@/shared/ui';
import type { Process } from '../api';
import { useStartProcess } from '../hooks';
import { ProcessPicker } from './ProcessPicker';

/** Form lập đơn cho một loại đơn: tiêu đề + nút, chọn loại đơn, các trường, thông tin giao dịch. */
export function CreateRequestForm({ process, processes, employee, model, onSent }: {
  process: Process; processes: Process[]; employee?: User; model: FormModel;
  onSent: () => void;
}) {
  const ctl = useDynamicForm(model);
  const start = useStartProcess();

  const submit = () => {
    if (!ctl.validate()) return;
    start.mutate({ processKey: process.key, values: ctl.payload() }, {
      onSuccess: res => {
        toast.success(`Submitted ${process.name || process.key}`, { description: `Request ID ${code(res.id)} is now waiting for the manager's approval.` });
        onSent();
      },
      onError: err => toast.error('The request was not submitted.', { description: errorMessage(err) }),
    });
  };

  return (
    <>
      <RecordHeader
        actions={<>
          <Cmd icon="reset" label="Reset" disabled={start.isPending} onClick={ctl.reset} />
          <Cmd icon="send" label="Submit for approval" primary busy={start.isPending} onClick={submit} />
        </>}
        title="New request"
        fields={[{ label: 'Requester', value: employee?.name ?? '...' }]}
      />
      <ProcessPicker processes={processes} current={process.id} />
      <div className="body">
        <div className="body__main">
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
