import { lazy } from 'react';
import { createHashRouter, Navigate, useParams } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';

// Mỗi trang tải riêng khi được mở lần đầu
const CreateRequestPage = lazy(() => import('@/features/requests/pages/CreateRequestPage'));
const ApprovalQueuePage = lazy(() => import('@/features/approvals/pages/ApprovalQueuePage'));
const ApprovalDetailPage = lazy(() => import('@/features/approvals/pages/ApprovalDetailPage'));
const RequestTypesPage = lazy(() => import('@/features/request-types/pages/RequestTypesPage'));
const RequestTypeEditorPage = lazy(() => import('@/features/request-types/pages/RequestTypeEditorPage'));

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
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/new" replace /> },
      { path: 'new/:processId?', element: <CreateRequestPage /> },
      { path: 'approvals', element: <ApprovalQueuePage /> },
      { path: 'approvals/:taskId', element: <ApprovalDetailPage /> },
      { path: 'request-types', element: <RequestTypesPage /> },
      { path: 'request-types/:key', element: <RequestTypeEditorPage /> },
      // link cũ tiếng Việt
      { path: 'tao/:processId?', element: <LegacyRedirect to="/new" /> },
      { path: 'duyet/:taskId?', element: <LegacyRedirect to="/approvals" /> },
      { path: '*', element: <Navigate to="/new" replace /> },
    ],
  },
]);
