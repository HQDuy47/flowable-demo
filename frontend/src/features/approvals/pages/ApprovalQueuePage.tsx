import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Empty, MessageBar, Problem, Skeleton } from '@/shared/ui';
import { matchTask, TaskTable } from '../components/TaskTable';
import { useTasks } from '../hooks';
import type { DecisionNotice } from '../types';

/** Danh sách đơn chờ trưởng phòng duyệt. */
export default function ApprovalQueuePage() {
  const tasks = useTasks();
  const [q, setQ] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  // Quyết định vừa lưu ở trang chi tiết: hiện một lần rồi xoá khỏi lịch sử trình duyệt
  const [notice, setNotice] = useState<DecisionNotice | null>(() => (location.state as { decision?: DecisionNotice } | null)?.decision ?? null);
  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

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
      {notice && (
        <div className="view__notice">
          <MessageBar intent={notice.reject ? 'warning' : 'success'} onDismiss={() => setNotice(null)}>
            <b>Decision saved.</b> Request <span className="mono">{notice.code}</span> was {notice.outcome}.
          </MessageBar>
        </div>
      )}
      {tasks.isError ? <Problem error={tasks.error} onRetry={() => tasks.refetch()} />
        : !tasks.data ? <Skeleton rows={6} />
        : tasks.data.length === 0 ? (
          <Empty title="No requests are waiting for approval.">
            <p>New requests show up here as soon as they are submitted. <Link className="link" to="/new">New request</Link></p>
          </Empty>
        )
        : rows.length === 0 ? <Empty title="No requests match the filter." />
        : <TaskTable tasks={rows} />}
    </div>
  );
}
