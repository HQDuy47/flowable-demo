import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

/**
 * adminApp: app con (remote) chứa màn Request types. Chạy riêng ở cổng 5174, build và deploy riêng.
 * Shell tải file remoteEntry.js của app này lúc chạy rồi lấy các trang được "expose" bên dưới.
 */
export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'adminApp',
      filename: 'remoteEntry.js',
      // những gì app này cho phép shell tải về
      exposes: {
        './RequestTypesPage': './src/request-types/pages/RequestTypesPage.tsx',
        './RequestTypeEditorPage': './src/request-types/pages/RequestTypeEditorPage.tsx',
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
    port: 5174,
    strictPort: true, // cổng bận thì báo lỗi, không tự nhảy sang cổng của app khác
    origin: 'http://localhost:5174', // file của app này luôn tải từ 5174, kể cả khi đang nằm trong trang của shell
    cors: true,
    proxy: { '/api': 'http://localhost:3000' },
  },
  preview: { port: 5174, strictPort: true, cors: true },
  build: { target: 'esnext' },
});
