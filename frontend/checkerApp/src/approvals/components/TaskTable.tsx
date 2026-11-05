import { Link, useNavigate } from 'react-router-dom';
import { code } from '@demo/shared/lib/format';
import { When } from '@demo/shared/ui';
import type { Task } from '../types';

/** Bảng đơn chờ duyệt; bấm vào dòng để mở đơn. */
export function TaskTable({ tasks }: { tasks: Task[] }) {
  const navigate = useNavigate();
  return (
    <div className="grid-wrap">
      <table className="grid grid--rows">
        <thead><tr><th>Request ID</th><th>Type</th><th>Requester</th><th>Step</th><th>Received</th></tr></thead>
        <tbody>
          {tasks.map(t => (
            <tr key={t.id} onClick={() => navigate(`/approvals/${t.id}`)}>
              <td><Link className="link mono" to={`/approvals/${t.id}`} onClick={e => e.stopPropagation()}>{code(t.request.id)}</Link></td>
              <td>{t.request.processName}</td>
              <td>{t.request.initiator?.name ?? <span className="muted">Unknown</span>}</td>
              <td>{t.name}</td>
              <td><When at={t.time} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Lọc theo người lập, loại đơn hoặc mã đơn. */
export const matchTask = (q: string, t: Task) =>
  !q.trim() || [t.request.initiator?.name, t.request.processName, code(t.request.id)]
    .some(p => p?.toLowerCase().includes(q.trim().toLowerCase()));
