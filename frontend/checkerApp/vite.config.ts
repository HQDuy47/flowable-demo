import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
import { remoteReactRefresh } from '../federation-refresh.mts';

/**
 * checkerApp: app con (remote) chứa màn duyệt đơn (checker). Chạy riêng ở cổng 5176.
 * Shell tải file remoteEntry.js của app này lúc chạy rồi lấy các trang được "expose" bên dưới.
 */
export default defineConfig({
  plugins: [
    remoteReactRefresh(), // hot reload cả khi trang nằm trong shell; phải đứng trước react()
    react(),
    federation({
      name: 'checkerApp',
      filename: 'remoteEntry.js',
      // những gì app này cho phép shell tải về
      exposes: {
        './ApprovalQueuePage': './src/approvals/pages/ApprovalQueuePage.tsx',
        './ApprovalDetailPage': './src/approvals/pages/ApprovalDetailPage.tsx',
      },
      // thư viện dùng chung một bản với shell: app con dùng được router, cache và toast của shell
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true },
        'react-router-dom': { singleton: true },
        '@tanstack/react-query': { singleton: true },
        sonner: { singleton: true },
      },
      dts: false, // không tự sinh file type; shell khai báo tay trong src/remotes.d.ts
    }),
  ],
  server: {
    port: 5176,
    strictPort: true, // cổng bận thì báo lỗi, không tự nhảy sang cổng của app khác
    origin: 'http://localhost:5176', // file của app này luôn tải từ 5176, kể cả khi đang nằm trong trang của shell
    cors: true,
    proxy: { '/api': 'http://localhost:3000' },
  },
  preview: { port: 5176, strictPort: true, cors: true },
  build: { target: 'esnext' },
});
