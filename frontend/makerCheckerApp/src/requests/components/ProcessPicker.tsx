import { useNavigate } from 'react-router-dom';
import type { Process } from '../api';

/** Hàng nút chọn loại đơn; đổi loại đơn thì đổi URL (#/new/<processId>). */
export function ProcessPicker({ processes, current }: { processes: Process[]; current: string }) {
  const navigate = useNavigate();
  if (processes.length < 2) return null;
  return (
    <div className="typepick" role="group" aria-label="Request type">
      {processes.map(p => (
        <button key={p.id} type="button" className="typepick__item" aria-pressed={p.id === current}
          onClick={() => navigate(`/new/${encodeURIComponent(p.id)}`, { replace: true })}>
          {p.name}
        </button>
      ))}
    </div>
  );
}
