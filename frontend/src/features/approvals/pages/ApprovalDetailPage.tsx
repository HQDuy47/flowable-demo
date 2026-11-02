import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useDynamicForm, type FormModel } from '@/shared/form';
import { code, errorMessage } from '@/shared/lib/format';
import { Cmd, CommandBar, Empty, KeyValues, Problem, RecordHeader, Section, Skeleton, Tabs, When } from '@/shared/ui';
import { outcomeAction, STATUS_LABEL, StatusBadge } from '../components/badges';
import { DecisionDialog } from '../components/DecisionDialog';
import { HistoryTable, RequestFields, Timeline } from '../components/RequestInfo';
import { useCompleteTask, useRequestDetail, useTaskForm, useTasks } from '../hooks';
import type { RequestDetail, Task } from '../types';

/** Trang duyệt một đơn: thông tin đơn, dòng thời gian, nút Duyệt / Từ chối. */
export default function ApprovalDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const tasks = useTasks();
  const task = tasks.data?.find(t => t.id === taskId);
  const request = useRequestDetail(task?.request.id);
  const form = useTaskForm(task ? taskId : undefined);

  const back = <CommandBar><Cmd icon="back" label="Back to list" to="/approvals" /></CommandBar>;
  const failed = tasks.error ?? request.error ?? form.error;
  if (failed) {
    const retry = () => { tasks.refetch(); request.refetch(); form.refetch(); };
    return <>{back}<div className="pad"><Problem error={failed} onRetry={retry} /></div></>;
  }
  if (tasks.data && !task)
    return (
      <>
        {back}
        <div className="pad"><Empty title="This task is no longer in the queue.">
          <p>It may have been handled already. <Link className="link" to="/approvals">Back to approvals</Link></p>
        </Empty></div>
      </>
    );
  if (!task || !request.data || !form.data) return <>{back}<div className="pad"><Skeleton rows={8} /></div></>;
  return <Decide key={task.id} task={task} request={request.data} form={form.data} />;
}

function Decide({ task, request: r, form }: { task: Task; request: RequestDetail; form: FormModel }) {
  const navigate = useNavigate();
  const complete = useCompleteTask();
  // Từ chối thì bắt buộc ghi ý kiến: các ô người duyệt được sửa trở thành bắt buộc
  const rejectForm = useMemo(
    () => ({ ...form, fields: form.fields.map(f => (f.readOnly ? f : { ...f, required: true })) }),
    [form],
  );
  const ctl = useDynamicForm(rejectForm);
  const [asking, setAsking] = useState<{ id: string; name: string } | null>(null);
  const outcomes = form.outcomes?.length ? form.outcomes : [{ id: '', name: 'Complete' }];
  const rejecting = asking?.id === 'reject';

  const confirm = () => {
    if (!asking) return;
    if (rejecting && !ctl.validate()) return;
    complete.mutate(
      { taskId: task.id, values: rejecting ? ctl.payload() : {}, outcome: asking.id || undefined },
      {
        onSuccess: () => {
          const text = `Request ${code(r.id)} was ${rejecting ? 'rejected' : 'approved'}.`;
          if (rejecting) toast.warning('Decision saved', { description: text });
          else toast.success('Decision saved', { description: text });
          navigate('/approvals');
        },
        onError: err => toast.error('The decision was not saved.', { description: errorMessage(err) }),
      },
    );
  };
  const close = () => setAsking(null);

  return (
    <>
      <RecordHeader
        actions={
          // nút chính (kết quả đầu tiên, thường là Duyệt) nằm ngoài cùng bên phải
          outcomes.map((o, i) => ({ o, i })).reverse().map(({ o, i }) => (
            <Cmd key={o.id || 'done'} icon={o.id === 'reject' ? 'reject' : 'approve'} label={outcomeAction(o)}
              primary={i === 0} danger={o.id === 'reject'} disabled={complete.isPending} onClick={() => setAsking(o)} />
          ))
        }
        title={<>{r.processName} <span className="rhead__code">{code(r.id)}</span></>}
        subtitle={<StatusBadge status={r.status} />}
        fields={[{ label: 'Submitted by', value: <>{r.initiator?.name ?? 'Unknown'}, <When at={r.startTime} /></> }]}
      />
      <RequestTabs request={r} />
      <DecisionDialog
        outcome={asking}
        request={r}
        ctl={ctl}
        commentFields={rejectForm.fields.filter(f => !f.readOnly)}
        busy={complete.isPending}
        onConfirm={confirm}
        onClose={close}
      />
    </>
  );
}

/** Tab Tổng quan (thông tin đơn, dòng thời gian, xử lý) và Nhật ký. */
function RequestTabs({ request: r, main }: { request: RequestDetail; main?: ReactNode }) {
  return (
    <Tabs tabs={[
      {
        id: 'overview', label: 'Overview',
        body: (
          <div className="body">
            <div className="body__main">
              <Section title="Request details"><RequestFields request={r} /></Section>
              {main}
            </div>
            <aside className="body__side">
              <Section title="Timeline"><Timeline request={r} /></Section>
              <Section title="Processing">
                <KeyValues rows={[
                  { label: 'Current step', value: r.currentTask?.name ?? STATUS_LABEL[r.status] },
                  { label: 'Assignee', value: r.currentTask?.assignee?.name ?? 'None' },
                  { label: 'Finished', value: <When at={r.endTime} /> },
                ]} />
              </Section>
            </aside>
          </div>
        ),
      },
      { id: 'log', label: 'History', body: <div className="body body--single"><Section title="Processing history"><HistoryTable request={r} /></Section></div> },
    ]} />
  );
}
