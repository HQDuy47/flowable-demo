import { lazy, Suspense } from 'react';
import { createHashRouter, Navigate, useParams } from 'react-router-dom';
import { MessageBar } from '@demo/shared/ui';
import { AppLayout } from './layout/AppLayout';

// Trang của shell, tải riêng khi được mở lần đầu
const LoginPage = lazy(() => import('@/features/users/pages/LoginPage'));

// Micro frontend: các trang dưới đây nằm ở app con, tải qua mạng lúc chạy
// makerCheckerApp (frontend/makerCheckerApp, cổng 5175)
const CreateRequestPage = lazy(() => import('makerCheckerApp/CreateRequestPage'));
const ApprovalQueuePage = lazy(() => import('makerCheckerApp/ApprovalQueuePage'));
const ApprovalDetailPage = lazy(() => import('makerCheckerApp/ApprovalDetailPage'));
// adminApp (frontend/adminApp, cổng 5174)
const RequestTypesPage = lazy(() => import('adminApp/RequestTypesPage'));
const RequestTypeEditorPage = lazy(() => import('adminApp/RequestTypeEditorPage'));

/** App con không tải được (chưa chạy, deploy lỗi): chỉ màn đó báo lỗi, phần còn lại của shell vẫn dùng được. */
function RemoteUnavailable({ app, port, script }: { app: string; port: number; script: string }) {
  return (
    <div className="pad">
      <MessageBar intent="error">
        <b>This screen could not be loaded.</b> It comes from {app} on port {port}. Start it with{' '}
        <code>npm run {script}</code>, then{' '}
        <button type="button" className="link" onClick={() => location.reload()}>reload</button>.
      </MessageBar>
    </div>
  );
}
const makerCheckerDown = <RemoteUnavailable app="makerCheckerApp" port={5175} script="dev:mc" />;
const adminDown = <RemoteUnavailable app="adminApp" port={5174} script="dev:admin" />;

/** Chuyển link cũ (#/tao/..., #/duyet/...) sang đường dẫn mới, giữ nguyên phần id. */
function LegacyRedirect({ to }: { to: string }) {
  const { processId, taskId } = useParams();
  const id = processId ?? taskId;
  return <Navigate to={id ? `${to}/${encodeURIComponent(id)}` : to} replace />;
}

/**
 * Định tuyến theo hash (#/new, #/approvals/<taskId>) để chạy được với vite preview / file tĩnh mà không cần cấu hình server.
 */
export const router = createHashRouter([
  { path: 'login', element: <Suspense fallback={null}><LoginPage /></Suspense> },
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/new" replace /> },
      { path: 'new/:processId?', element: <CreateRequestPage />, errorElement: makerCheckerDown },
      { path: 'approvals', element: <ApprovalQueuePage />, errorElement: makerCheckerDown },
      { path: 'approvals/:taskId', element: <ApprovalDetailPage />, errorElement: makerCheckerDown },
      { path: 'request-types', element: <RequestTypesPage />, errorElement: adminDown },
      { path: 'request-types/:key', element: <RequestTypeEditorPage />, errorElement: adminDown },
      // link cũ tiếng Việt
      { path: 'tao/:processId?', element: <LegacyRedirect to="/new" /> },
      { path: 'duyet/:taskId?', element: <LegacyRedirect to="/approvals" /> },
      { path: '*', element: <Navigate to="/new" replace /> },
    ],
  },
]);
