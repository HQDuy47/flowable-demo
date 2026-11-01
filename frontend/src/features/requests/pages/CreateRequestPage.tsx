import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useUser } from '@/features/users';
import { EMPLOYEE } from '@/shared/config/actors';
import type { FormModel } from '@/shared/form';
import { Empty, Problem, Skeleton } from '@/shared/ui';
import type { Process } from '../api';
import { CreateRequestForm, type SentNotice } from '../components/CreateRequestForm';
import { useProcesses, useStartForm } from '../hooks';

/** Trang lập đơn (#/new/<processId>). Không có processId thì mở loại đơn đầu tiên. */
export default function CreateRequestPage() {
  const { processId } = useParams<{ processId?: string }>();
  const processes = useProcesses();
  const [sent, setSent] = useState<SentNotice | null>(null);
  // tăng sau mỗi lần gửi để form được làm trống
  const [round, setRound] = useState(0);

  if (processes.isError) return <div className="pad"><Problem error={processes.error} onRetry={() => processes.refetch()} /></div>;
  if (!processes.data) return <div className="pad"><Skeleton rows={8} /></div>;
  if (processes.data.length === 0)
    return (
      <div className="pad">
        <Empty title="No process with a start form is deployed yet.">
          <p>Run <code>flowable/deploy.ps1</code> to deploy the processes, then reload the page.</p>
        </Empty>
      </div>
    );

  const chosen = processes.data.find(p => p.id === processId);
  if (!chosen) return <Navigate to={`/new/${encodeURIComponent(processes.data[0].id)}`} replace />;

  return (
    <StartFormLoader
      key={`${chosen.id}-${round}`}
      process={chosen}
      processes={processes.data}
      sent={sent}
      onDismissSent={() => setSent(null)}
      onSent={id => { setSent({ id, name: chosen.name }); setRound(r => r + 1); }}
    />
  );
}

function StartFormLoader({ process, ...rest }: {
  process: Process; processes: Process[];
  sent: SentNotice | null; onDismissSent: () => void; onSent: (requestId: string) => void;
}) {
  const form = useStartForm(process.id);
  const employee = useUser(EMPLOYEE).data;

  if (form.isError) return <div className="pad"><Problem error={form.error} onRetry={() => form.refetch()} /></div>;
  if (!form.data) return <div className="pad"><Skeleton rows={8} /></div>;

  const model: FormModel = {
    ...form.data,
    // điền sẵn họ tên nhân viên đang lập đơn
    fields: form.data.fields.map(f => (f.id === 'employeeName' && !f.value && employee ? { ...f, value: employee.name } : f)),
  };
  return <CreateRequestForm key={employee ? 'with-name' : 'no-name'} process={process} employee={employee} model={model} {...rest} />;
}
