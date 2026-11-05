/**
 * Chạy makerApp một mình ở http://localhost:5175, không cần shell (để phát triển và demo "app độc lập").
 * Khi nằm trong shell, file này không được dùng: shell chỉ tải các trang được expose trong vite.config.ts.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { getSession, setSession, type SessionUser } from '@demo/shared/auth/session';
import { MessageBar } from '@demo/shared/ui';
import '@demo/shared/styles.css';
import CreateRequestPage from './requests/pages/CreateRequestPage';

// ponytail: chạy riêng thì không có màn đăng nhập của shell; tự đăng nhập người dùng demo maker
const MAKER: SessionUser = { id: 'maker', name: 'Nguyễn Văn An', title: 'Employee', role: 'employee' };
// đặt phiên trước khi trang con gọi API (header x-user-id đọc từ phiên)
if (getSession()?.id !== MAKER.id) setSession(MAKER);

const page = (
  <main className="workspace">
    <MessageBar intent="info">
      Running standalone: <b>makerApp</b> on port 5175, signed in as <b>{MAKER.name}</b>.
    </MessageBar>
    <CreateRequestPage />
  </main>
);

const router = createHashRouter([
  { path: 'new/:processId?', element: page },
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
