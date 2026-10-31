import { useEffect, useState } from 'react';
import { api, type RequestDetail as Detail, type User } from './api';
import { DynamicForm, type FormModel } from './DynamicForm';
import { Avatar, OutcomeBadge, StatusBadge } from './ui';
import { fmtTime, fmtValue, shortId } from './format';

const END_TEXT = { approved: 'Đơn đã được duyệt', rejected: 'Đơn bị từ chối', cancelled: 'Người tạo đã rút đơn', done: 'Quy trình hoàn tất' };

export function RequestDetail({ id, me, onChanged, onError, notify }: {
  id: string;
  me: User;
  /** Gọi sau khi duyệt/rút đơn để App làm mới số đếm */
  onChanged: () => void;
  onError: (e: unknown) => void;
  notify: (msg: string) => void;
}) {
  const [req, setReq] = useState<Detail | null>(null);
  const [taskForm, setTaskForm] = useState<FormModel | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    setTaskForm(null);
    api.request(id).then(async r => {
      if (!alive) return;
      setReq(r);
      // Chỉ người được giao bước hiện tại mới thấy khung xử lý
      if (r.currentTask?.assignee?.id === me.id) {
        const f = await api.taskForm(r.currentTask.id);
        if (alive) setTaskForm(f);
      }
    }).catch(onError);
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, me.id, version]);

  if (!req) return <p className="muted">Đang tải…</p>;

  const refresh = () => { setVersion(v => v + 1); onChanged(); };

  const complete = async (values: Record<string, any>, outcome?: string) => {
    try {
      await api.complete(req.currentTask!.id, values, outcome);
      notify(outcome === 'reject' ? 'Đã từ chối đơn' : 'Đã duyệt đơn');
      refresh();
    } catch (e) { onError(e); }
  };

  const cancel = async () => {
    if (!confirm('Rút lại đơn này? Đơn sẽ dừng xử lý và không thể khôi phục.')) return;
    try {
      await api.cancel(req.id);
      notify('Đã rút đơn');
      refresh();
    } catch (e) { onError(e); }
  };

  const mine = req.initiator?.id === me.id;

  return (
    <div className="detail">
      <header className="page-head">
        <div>
          <div className="eyebrow">{shortId(req.id)}</div>
          <h1>{req.processName} <StatusBadge status={req.status} /></h1>
          <p className="muted">
            Tạo bởi <b className="ink">{req.initiator?.name ?? 'không rõ'}</b>
            {req.initiator?.title && ` · ${req.initiator.title}`} · {fmtTime(req.startTime)}
          </p>
        </div>
        {mine && req.status === 'pending' && <button className="btn btn-ghost" onClick={cancel}>Rút đơn</button>}
      </header>

      <div className="detail-grid">
        <div className="stack">
          {taskForm && req.currentTask && (
            <section className="card card-action">
              <h2>Cần bạn xử lý</h2>
              <p className="muted">Bước “{req.currentTask.name}”. Xem thông tin đơn bên dưới rồi chọn duyệt hoặc từ chối.</p>
              <DynamicForm key={req.currentTask.id} form={taskForm} hideReadOnly onSubmit={complete} onError={onError} />
            </section>
          )}

          <section className="card">
            <h2>Thông tin đơn</h2>
            <dl className="info">
              {req.fields.map(f => (
                <div key={f.id} className={f.type === 'multi-line-text' ? 'info-wide' : ''}>
                  <dt>{f.label}</dt>
                  <dd>{fmtValue(f.value)}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <section className="card">
          <h2>Tiến trình duyệt</h2>
          <ol className="timeline">
            <li className="tl-done">
              <Avatar user={req.initiator} />
              <div>
                <div className="tl-title">Tạo đơn</div>
                <div className="tl-meta">{req.initiator?.name ?? 'không rõ'} · {fmtTime(req.startTime)}</div>
              </div>
            </li>

            {req.steps.map(s => {
              const state = s.cancelled ? 'tl-skip' : !s.endTime ? 'tl-current' : s.outcome?.id === 'reject' ? 'tl-reject' : 'tl-done';
              return (
                <li key={s.id} className={state}>
                  <Avatar user={s.assignee} />
                  <div>
                    <div className="tl-title">
                      {s.name} {s.outcome && <OutcomeBadge outcome={s.outcome} />}
                    </div>
                    <div className="tl-meta">
                      {s.assignee?.name ?? 'Chưa giao'}
                      {s.assignee?.title && ` · ${s.assignee.title}`}
                      {' · '}
                      {s.cancelled ? 'Đã huỷ' : s.endTime ? fmtTime(s.endTime) : `Đang chờ từ ${fmtTime(s.startTime)}`}
                    </div>
                    {s.notes.map(n => (
                      <blockquote key={n.label} className="tl-note" title={n.label}>{fmtValue(n.value)}</blockquote>
                    ))}
                  </div>
                </li>
              );
            })}

            {req.status !== 'pending' && (
              <li className={req.status === 'approved' ? 'tl-done' : req.status === 'rejected' ? 'tl-reject' : 'tl-skip'}>
                <span className="tl-dot" />
                <div>
                  <div className="tl-title">{END_TEXT[req.status]}</div>
                  <div className="tl-meta">{fmtTime(req.endTime)}</div>
                </div>
              </li>
            )}
          </ol>
        </section>
      </div>
    </div>
  );
}
