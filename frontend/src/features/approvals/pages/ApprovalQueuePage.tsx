import { useState } from 'react';
import { Empty, Problem, Skeleton } from '@/shared/ui';
import { matchTask, TaskTable } from '../components/TaskTable';
import { useTasks } from '../hooks';

/** Danh sách đơn chờ trưởng phòng duyệt. */
export default function ApprovalQueuePage() {
  const tasks = useTasks();
  const [q, setQ] = useState('');

  const rows = (tasks.data ?? []).filter(t => matchTask(q, t));

  return (
    <div className="view">
      <div className="view__head">
        <h1>Pending approvals{tasks.data && <span className="view__count">{tasks.data.length}</span>}</h1>
        <label className="view__search">
          <span className="visually-hidden">Filter the list</span>
          <input className="fi" type="search" placeholder="Filter by request ID, requester, type" value={q} onChange={e => setQ(e.target.value)} />
        </label>
      </div>
      {tasks.isError ? <Problem error={tasks.error} onRetry={() => tasks.refetch()} />
        : !tasks.data ? <Skeleton rows={6} />
        : tasks.data.length === 0 ? (
          <Empty title="No requests are waiting for approval.">
            <p>New requests show up here as soon as they are submitted.</p>
          </Empty>
        )
        : rows.length === 0 ? <Empty title="No requests match the filter." />
        : <TaskTable tasks={rows} />}
    </div>
  );
}
