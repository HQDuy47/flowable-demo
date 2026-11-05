import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

/**
 * Hot reload (React Fast Refresh) cho trang của app con khi đang nằm trong shell, chỉ dùng lúc dev.
 *
 * Vấn đề: mỗi Vite server có một React Refresh runtime riêng (`/@react-refresh`). Trang shell chỉ nối runtime của
 * shell (5173) với React; component của app con lại đăng ký vào runtime của app con (vd. 5175), nên sửa code thì
 * module mới đã nạp mà màn hình không vẽ lại.
 * Cách sửa: shell để runtime của mình lên `window`; `/@react-refresh` của app con thành một lớp mỏng, có runtime
 * của shell thì gọi sang đó, không có (app con chạy một mình) thì dùng runtime của chính nó.
 */
const KEY = '__shellReactRefresh';

/** Dùng trong vite.config của shell. */
export const shellReactRefresh = (): Plugin => ({
  name: 'shell-react-refresh',
  apply: 'serve',
  transformIndexHtml: () => [
    { tag: 'script', attrs: { type: 'module' }, children: `import * as R from "/@react-refresh"; window.${KEY} = R;`, injectTo: 'head' },
  ],
});

// runtime gốc của @vitejs/plugin-react (đã hoist về frontend/node_modules)
const RUNTIME = fileURLToPath(new URL('./node_modules/@vitejs/plugin-react/dist/refresh-runtime.js', import.meta.url));
const LOCAL = '\0react-refresh-local';

/** Dùng trong vite.config của app con. */
export const remoteReactRefresh = (): Plugin => ({
  name: 'remote-react-refresh',
  apply: 'serve',
  enforce: 'pre', // load trước plugin-react để thay nội dung /@react-refresh
  resolveId: id => (id === '/@react-refresh-local' ? LOCAL : undefined),
  load(id) {
    if (id === LOCAL) return readFileSync(RUNTIME, 'utf-8');
    if (id !== '/@react-refresh') return;
    return `import * as local from '/@react-refresh-local';
const R = window.${KEY} ?? local;
export const register = (...a) => R.register(...a);
export const injectIntoGlobalHook = (...a) => R.injectIntoGlobalHook(...a);
export const createSignatureFunctionForTransform = () => R.createSignatureFunctionForTransform();
export const registerExportsForReactRefresh = (...a) => R.registerExportsForReactRefresh(...a);
export const validateRefreshBoundaryAndEnqueueUpdate = (...a) => R.validateRefreshBoundaryAndEnqueueUpdate(...a);
export const __hmr_import = local.__hmr_import;
export default { injectIntoGlobalHook };`;
  },
});
