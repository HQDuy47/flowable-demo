import { useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  DynamicForm, RENDERER_LABEL, RENDERER_SOURCE, RendererSwitch, useFormRenderer, type DynamicFormRef, type FormValues,
} from '@demo/shared/form';
import { code, errorMessage } from '@demo/shared/lib/format';
import { Cmd, CommandBar, Empty, KeyValues, Problem, RecordHeader, Section, Skeleton, Tabs, When } from '@demo/shared/ui';
import { outcomeAction, STATUS_LABEL, StatusBadge } from '../components/badges';
import { DecisionDialog } from '../components/DecisionDialog';
import { HistoryTable, RequestFields, Timeline } from '../components/RequestInfo';
import { useCompleteTask, useRequestDetail, useTaskForm, useTasks } from '../hooks';
import type { TaskForm } from '../api';
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

function Decide({ task, request: r, form }: { task: Task; request: RequestDetail; form: TaskForm }) {
  const navigate = useNavigate();
  const complete = useCompleteTask();
  // Form ý kiến khi từ chối: chỉ các ô người duyệt được sửa (bỏ ô readOnly của đơn), và bắt buộc ghi
  const hasComment = Object.values(form.schema.properties ?? {}).some(p => typeof p === 'object' && !p.readOnly);
  const ref = useRef<DynamicFormRef>(null);
  const [renderer] = useFormRenderer();
  const [data, setData] = useState<FormValues>({});
  const [asking, setAsking] = useState<{ id: string; name: string } | null>(null);
  const outcomes = form.outcomes?.length ? form.outcomes : [{ id: '', name: 'Complete' }];
  const rejecting = asking?.id === 'reject';

  const confirm = () => {
    if (!asking) return;
    if (rejecting && !ref.current?.validate()) return;
    complete.mutate(
      { taskId: task.id, values: rejecting ? data : {}, outcome: asking.id || undefined },
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
        actions={<>
          <RendererSwitch />
          {/* nút chính (kết quả đầu tiên, thường là Duyệt) nằm ngoài cùng bên phải */}
          {outcomes.map((o, i) => ({ o, i })).reverse().map(({ o, i }) => (
            <Cmd key={o.id || 'done'} icon={o.id === 'reject' ? 'reject' : 'approve'} label={outcomeAction(o)}
              primary={i === 0} danger={o.id === 'reject'} disabled={complete.isPending} onClick={() => setAsking(o)} />
          ))}
        </>}
        title={<>{r.processName} <span className="rhead__code">{code(r.id)}</span></>}
        subtitle={<StatusBadge status={r.status} />}
        fields={[{ label: 'Submitted by', value: <>{r.initiator?.name ?? 'Unknown'}, <When at={r.startTime} /></> }]}
      />
      <RequestTabs request={r} formKey={form.key} source={RENDERER_SOURCE[renderer]} renderer={RENDERER_LABEL[renderer]} />
      <DecisionDialog
        outcome={asking}
        request={r}
        comment={hasComment &&
          <DynamicForm key={renderer} ref={ref} renderer={renderer} def={form} data={data} onChange={setData} editableOnly />}
        busy={complete.isPending}
        onConfirm={confirm}
        onClose={close}
      />
    </>
  );
}

/** Tab Tổng quan (thông tin đơn, dòng thời gian, xử lý) và Nhật ký. */
function RequestTabs({ request: r, main, formKey, source, renderer }: {
  request: RequestDetail; main?: ReactNode; formKey: string; source: string; renderer: string;
}) {
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
                  { label: 'Form key', value: <code>{formKey}</code> },
                  { label: 'Form source', value: source },
                  { label: 'Renderer', value: renderer },
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
