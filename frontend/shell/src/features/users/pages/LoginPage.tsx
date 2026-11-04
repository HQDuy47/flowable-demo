import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getSession } from '@demo/shared/auth/session';
import { useLogin } from '../hooks';

/** Trang đăng nhập (#/login). Đăng nhập xong về trang chủ, layout tự chuyển tới màn đúng vai trò. */
export default function LoginPage() {
  const navigate = useNavigate();
  const login = useLogin();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  if (getSession()) return <Navigate to="/" replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate({ username, password }, {
      onSuccess: () => navigate('/', { replace: true }),
      onError: err => toast.error(err.message),
    });
  };

  return (
    <main className="login">
      <form className="login__card" onSubmit={submit}>
        <div className="login__brand"><span className="snav__mark" aria-hidden="true">RQ</span>Requests</div>
        <h1 className="login__title">Sign in</h1>
        <label className="login__field">
          <span>Username</span>
          <input className="fi" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoFocus required />
        </label>
        <label className="login__field">
          <span>Password</span>
          <input className="fi" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        <button type="submit" className="cmd cmd--primary login__submit" disabled={login.isPending} aria-busy={login.isPending || undefined}>
          {login.isPending && <span className="spinner keep-motion" aria-hidden="true" />}
          <span>Sign in</span>
        </button>
        <p className="login__hint">
          Demo accounts (password <code>123456</code>): <code>maker</code>, <code>checker</code>, <code>admin</code>.
        </p>
      </form>
    </main>
  );
}
