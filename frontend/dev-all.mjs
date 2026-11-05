// Chạy cả 4 app frontend trong một terminal: npm run dev:all. Ctrl+C tắt hết.
// ponytail: không dùng concurrently; mỗi dòng log có tiền tố tên app là đủ cho demo
import { spawn } from 'node:child_process';

const APPS = { maker: 'maker-app', checker: 'checker-app', admin: 'admin-app', shell: 'shell' };

for (const [name, ws] of Object.entries(APPS)) {
  const p = spawn(`npm run dev -w ${ws}`, { shell: true });
  const log = (out) => (buf) =>
    buf.toString().split(/\r?\n/).filter(Boolean).forEach((line) => out.write(`[${name.padEnd(7)}] ${line}\n`));
  p.stdout.on('data', log(process.stdout));
  p.stderr.on('data', log(process.stderr));
  p.on('exit', (code) => console.log(`[${name.padEnd(7)}] stopped (code ${code})`));
}
