/**
 * Chạy makerCheckerApp một mình ở http://localhost:5175, không cần shell (để phát triển và demo "app độc lập").
 * Khi nằm trong shell, file này không được dùng: shell chỉ tải các trang được expose trong vite.config.ts.
 */
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createHashRouter, Navigate, NavLink, RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { getSession, setSession, type SessionUser } from '@demo/shared/auth/session';
import { MessageBar } from '@demo/shared/ui';
import '@demo/shared/styles.css';
import CreateRequestPage from './requests/pages/CreateRequestPage';
import ApprovalQueuePage from './approvals/pages/ApprovalQueuePage';
import ApprovalDetailPage from './approvals/pages/ApprovalDetailPage';

// ponytail: chạy riêng thì không có màn đăng nhập của shell; mỗi màn tự đăng nhập người dùng demo tương ứng
const MAKER: SessionUser = { id: 'maker', name: 'Nguyễn Văn An', title: 'Employee', role: 'employee' };
const CHECKER: SessionUser = { id: 'checker', name: 'Trần Minh Quân', title: 'Department manager', role: 'approver' };

/** Khung tối giản thay cho layout của shell, có link đổi qua lại giữa maker và checker. */
function Standalone({ as, children }: { as: SessionUser; children: ReactNode }) {
  // đặt phiên trước khi trang con gọi API (header x-user-id đọc từ phiên)
  if (getSession()?.id !== as.id) setSession(as);
  return (
    <main className="workspace">
      <MessageBar intent="info">
        Running standalone: <b>makerCheckerApp</b> on port 5175, signed in as <b>{as.name}</b>.{' '}
        <NavLink to="/new">Maker: New request</NavLink> · <NavLink to="/approvals">Checker: Approvals</NavLink>
      </MessageBar>
      {children}
    </main>
  );
}

const router = createHashRouter([
  { path: 'new/:processId?', element: <Standalone as={MAKER}><CreateRequestPage /></Standalone> },
  { path: 'approvals', element: <Standalone as={CHECKER}><ApprovalQueuePage /></Standalone> },
  { path: 'approvals/:taskId', element: <Standalone as={CHECKER}><ApprovalDetailPage /></Standalone> },
  { path: '*', element: <Navigate to="/new" replace /> },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
      <Toaster position="top-center" richColors closeButton />
    </QueryClientProvider>
  </StrictMode>,
);
