import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

/** Địa chỉ của các app con; khi deploy thật thì đặt biến môi trường lúc build. */
const MAKER_APP_URL = process.env.MAKER_APP_URL ?? 'http://localhost:5175';
const CHECKER_APP_URL = process.env.CHECKER_APP_URL ?? 'http://localhost:5176';
const ADMIN_APP_URL = process.env.ADMIN_APP_URL ?? 'http://localhost:5174';

/**
 * shell: app chủ (host). Giữ đăng nhập, layout, menu, phân quyền.
 * Các màn nghiệp vụ là app con, tải lúc chạy qua Module Federation:
 * makerApp (New request), checkerApp (Approvals) và adminApp (Request types).
 */
export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'shell',
      // các app con shell biết tới: tên → địa chỉ file remoteEntry.js
      remotes: {
        makerApp: { type: 'module', name: 'makerApp', entry: `${MAKER_APP_URL}/remoteEntry.js` },
        checkerApp: { type: 'module', name: 'checkerApp', entry: `${CHECKER_APP_URL}/remoteEntry.js` },
        adminApp: { type: 'module', name: 'adminApp', entry: `${ADMIN_APP_URL}/remoteEntry.js` },
      },
      // phải khớp với khai báo shared của app con
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true },
        'react-router-dom': { singleton: true },
        '@tanstack/react-query': { singleton: true },
        sonner: { singleton: true },
      },
      dts: false, // type của app con khai báo tay trong src/remotes.d.ts
    }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // strictPort: cổng 5173 bận thì báo lỗi thay vì tự nhảy sang cổng của app con
  server: { port: 5173, strictPort: true, proxy: { '/api': 'http://localhost:3000' } },
  preview: { port: 5173, strictPort: true },
  build: { target: 'esnext' },
});
