import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { getSession } from '@demo/shared/auth/session';
import { Empty, Problem, Skeleton } from '@demo/shared/ui';
import type { Process } from '../api';
import { CreateRequestForm } from '../components/CreateRequestForm';
import { useProcesses, useStartForm } from '../hooks';

/** Trang lập đơn (#/new/<processId>). Không có processId thì mở loại đơn đầu tiên. */
export default function CreateRequestPage() {
  const { processId } = useParams<{ processId?: string }>();
  const processes = useProcesses();
  // tăng sau mỗi lần gửi để form được làm trống
  const [round, setRound] = useState(0);

  if (processes.isError) return <div className="pad"><Problem error={processes.error} onRetry={() => processes.refetch()} /></div>;
  if (!processes.data) return <div className="pad"><Skeleton rows={8} /></div>;
  if (processes.data.length === 0)
    return (
      <div className="pad">
        <Empty title="No request type yet.">
          <p>Ask an administrator to create one in Request types, then reload the page.</p>
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
      onSent={() => setRound(r => r + 1)}
    />
  );
}

function StartFormLoader({ process, ...rest }: {
  process: Process; processes: Process[];
  onSent: () => void;
}) {
  const form = useStartForm(process.id);
  // người lập đơn = người đang đăng nhập (phiên đã có đủ tên, chức danh; không cần gọi API users của shell)
  const employee = getSession() ?? undefined;

  if (form.isError) return <div className="pad"><Problem error={form.error} onRetry={() => form.refetch()} /></div>;
  if (!form.data) return <div className="pad"><Skeleton rows={8} /></div>;

  return <CreateRequestForm process={process} employee={employee} form={form.data} {...rest} />;
}
