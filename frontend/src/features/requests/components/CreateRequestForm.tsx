import { useRef, useState } from 'react';
import { toast } from 'sonner';
import type { User } from '@/features/users';
import { SchemaForm, type FormValues, type SchemaFormDef, type SchemaFormRef } from '@/shared/form';
import { code, errorMessage } from '@/shared/lib/format';
import { Cmd, KeyValues, RecordHeader, Section } from '@/shared/ui';
import type { Process } from '../api';
import { useStartProcess } from '../hooks';
import { ProcessPicker } from './ProcessPicker';

/** Form lập đơn cho một loại đơn: tiêu đề + nút, chọn loại đơn, các trường (rjsf), thông tin giao dịch. */
export function CreateRequestForm({ process, processes, employee, form, initial, onSent }: {
  process: Process; processes: Process[]; employee?: User; form: SchemaFormDef;
  /** giá trị điền sẵn, vd. họ tên người lập đơn */
  initial: FormValues;
  onSent: () => void;
}) {
  const start = useStartProcess();
  const ref = useRef<SchemaFormRef>(null);
  const [data, setData] = useState<FormValues>(initial);
  const [round, setRound] = useState(0); // tăng khi Reset để rjsf vẽ lại từ đầu (xoá lỗi đang hiện)

  const submit = () => {
    if (!ref.current?.validateForm()) return;
    start.mutate({ processKey: process.key, values: data }, {
      onSuccess: res => {
        toast.success(`Submitted ${process.name || process.key}`, { description: `Request ID ${code(res.id)} is now waiting for the manager's approval.` });
        onSent();
      },
      onError: err => toast.error('The request was not submitted.', { description: errorMessage(err) }),
    });
  };
  const reset = () => { setData(initial); setRound(r => r + 1); };

  return (
    <>
      <RecordHeader
        actions={<>
          <Cmd icon="reset" label="Reset" disabled={start.isPending} onClick={reset} />
          <Cmd icon="send" label="Submit for approval" primary busy={start.isPending} onClick={submit} />
        </>}
        title="New request"
        fields={[{ label: 'Requester', value: employee?.name ?? '...' }]}
      />
      <ProcessPicker processes={processes} current={process.id} />
      <div className="body">
        <div className="body__main">
          <Section title={form.name || 'Request details'}>
            <SchemaForm key={round} ref={ref} def={form} data={data} onChange={setData} />
          </Section>
        </div>
        <aside className="body__side">
          <Section title="Summary">
            <KeyValues rows={[
              { label: 'Request ID', value: <span className="muted">Assigned on submit</span> },
              { label: 'Status', value: 'Draft' },
              { label: 'Type', value: process.name || process.key },
              { label: 'Form key', value: <code>{form.key}</code> },
            ]} />
          </Section>
        </aside>
      </div>
    </>
  );
}
