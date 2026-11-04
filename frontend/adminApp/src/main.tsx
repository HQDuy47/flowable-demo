/**
 * Chạy adminApp một mình ở http://localhost:5174, không cần shell (để phát triển và demo "app độc lập").
 * Khi nằm trong shell, file này không được dùng: shell chỉ tải các trang được expose trong vite.config.ts.
 */
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { getSession, setSession } from '@demo/shared/auth/session';
import { MessageBar } from '@demo/shared/ui';
import '@demo/shared/styles.css';
import RequestTypesPage from './request-types/pages/RequestTypesPage';
import RequestTypeEditorPage from './request-types/pages/RequestTypeEditorPage';

// ponytail: chạy riêng thì không có màn đăng nhập của shell, tự đăng nhập admin demo để gọi được API
if (getSession()?.role !== 'admin')
  setSession({ id: 'admin', name: 'Lê Thu Hà', title: 'Administrator', role: 'admin' });

/** Khung tối giản thay cho layout của shell. */
const Standalone = ({ children }: { children: ReactNode }) => (
  <main className="workspace">
    <MessageBar intent="info">
      Running standalone: <b>adminApp</b> on port 5174. Inside the shell (port 5173) these pages are loaded at runtime from here.
    </MessageBar>
    {children}
  </main>
);

const router = createHashRouter([
  { path: 'request-types', element: <Standalone><RequestTypesPage /></Standalone> },
  { path: 'request-types/:key', element: <Standalone><RequestTypeEditorPage /></Standalone> },
  { path: '*', element: <Navigate to="/request-types" replace /> },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
      <Toaster position="top-center" richColors closeButton />
    </QueryClientProvider>
  </StrictMode>,
);
