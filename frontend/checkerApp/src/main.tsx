/**
 * Chạy checkerApp một mình ở http://localhost:5176, không cần shell (để phát triển và demo "app độc lập").
 * Khi nằm trong shell, file này không được dùng: shell chỉ tải các trang được expose trong vite.config.ts.
 */
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { getSession, setSession, type SessionUser } from '@demo/shared/auth/session';
import { MessageBar } from '@demo/shared/ui';
import '@demo/shared/styles.css';
import ApprovalQueuePage from './approvals/pages/ApprovalQueuePage';
import ApprovalDetailPage from './approvals/pages/ApprovalDetailPage';

// ponytail: chạy riêng thì không có màn đăng nhập của shell; tự đăng nhập người dùng demo checker
const CHECKER: SessionUser = { id: 'checker', name: 'Trần Minh Quân', title: 'Department manager', role: 'approver' };
// đặt phiên trước khi trang con gọi API (header x-user-id đọc từ phiên)
if (getSession()?.id !== CHECKER.id) setSession(CHECKER);

const Standalone = ({ children }: { children: ReactNode }) => (
  <main className="workspace">
    <MessageBar intent="info">
      Running standalone: <b>checkerApp</b> on port 5176, signed in as <b>{CHECKER.name}</b>.
    </MessageBar>
    {children}
  </main>
);

const router = createHashRouter([
  { path: 'approvals', element: <Standalone><ApprovalQueuePage /></Standalone> },
  { path: 'approvals/:taskId', element: <Standalone><ApprovalDetailPage /></Standalone> },
  { path: '*', element: <Navigate to="/approvals" replace /> },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
      <Toaster position="top-center" richColors closeButton />
    </QueryClientProvider>
  </StrictMode>,
);
