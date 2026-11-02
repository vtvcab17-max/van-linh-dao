// Đăng nhập bằng tài khoản Google (Gmail) cho bản chính thức.
// Nút "Đăng nhập bằng Google" (Google Identity Services) trả về ID token → server kiểm tra → cấp phiên chơi 30 ngày.
// Game chỉ nhận mã tài khoản và tên hiển thị; không đọc Gmail, không lưu email.
import { ls } from './net/base';

export interface Session {
  session: string;
  id: string;
  name: string;
  khu: string;
  exp: number;
}

interface GoogleId {
  initialize(o: Record<string, unknown>): void;
  renderButton(el: HTMLElement, o: Record<string, unknown>): void;
  prompt(): void;
  disableAutoSelect(): void;
}
type G = { accounts: { id: GoogleId } };

const KEY = 'vld-session';

export function savedSession(): Session | null {
  try {
    const s = JSON.parse(ls.get(KEY) ?? 'null') as Session | null;
    // còn ít nhất 1 giờ mới dùng lại, không thì đăng nhập lại cho chắc
    if (s?.session && s.exp > Date.now() + 3600_000) return s;
  } catch {
    /* hỏng thì bỏ */
  }
  return null;
}

export function forgetSession() {
  ls.set(KEY, '');
}

/** Đăng xuất: quên phiên trên máy này và tắt tự chọn tài khoản Google. */
export function logout() {
  forgetSession();
  try {
    (window as unknown as { google?: G }).google?.accounts.id.disableAutoSelect();
  } catch {
    /* chưa tải Google */
  }
  location.reload();
}

function loadGsi(): Promise<G> {
  const w = window as unknown as { google?: G };
  if (w.google?.accounts?.id) return Promise.resolve(w.google);
  return new Promise((ok, fail) => {
    const sc = document.createElement('script');
    sc.src = 'https://accounts.google.com/gsi/client';
    sc.async = true;
    sc.onload = () => (w.google?.accounts?.id ? ok(w.google) : fail(new Error('Không tải được nút Google')));
    sc.onerror = () => fail(new Error('Không tải được nút đăng nhập Google. Kiểm tra mạng rồi tải lại.'));
    document.head.appendChild(sc);
  });
}

async function post(server: string, path: string, body: unknown): Promise<Session> {
  const r = await fetch(`${server}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as Session & { error?: string };
  if (!r.ok || !j.session) throw new Error(j.error || `Đăng nhập lỗi (${r.status})`);
  return j;
}

/** Hiện hộp đăng nhập trên màn mở game; xong thì trả về phiên chơi. */
export async function login(server: string): Promise<Session> {
  const saved = savedSession();
  if (saved) return saved;
  const box = document.getElementById('loginBox')!;
  const btnBox = document.getElementById('gBtn')!;
  const err = document.getElementById('loginErr')!;
  const status = document.getElementById('splashStatus');
  if (status) status.textContent = '';
  document.body.dataset.login = '1';
  box.hidden = false;
  const fail = (m: string) => {
    err.textContent = m;
    err.hidden = false;
  };
  let cfg: { googleClientId: string; devLogin: boolean };
  try {
    cfg = await (await fetch(`${server}/config`)).json();
  } catch {
    fail('Không kết nối được server game. Kiểm tra mạng rồi tải lại.');
    throw new Error('Không kết nối được server');
  }
  const session = await new Promise<Session>((done) => {
    const finish = (s: Session) => {
      ls.set(KEY, JSON.stringify(s));
      done(s);
    };
    if (cfg.devLogin) {
      const dev = document.getElementById('devLogin')!;
      dev.hidden = false;
      dev.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = (document.getElementById('devName') as HTMLInputElement).value.trim() || 'Tester';
        post(server, '/auth/dev', { name }).then(finish, (e2: Error) => fail(e2.message));
      });
    }
    if (!cfg.googleClientId) {
      if (!cfg.devLogin) fail('Server chưa cấu hình GOOGLE_CLIENT_ID (xem README).');
      return;
    }
    loadGsi()
      .then((g) => {
        g.accounts.id.initialize({
          client_id: cfg.googleClientId,
          auto_select: true,
          cancel_on_tap_outside: false,
          use_fedcm_for_prompt: true,
          callback: (resp: { credential?: string }) => {
            err.hidden = true;
            btnBox.classList.add('busy');
            post(server, '/auth/google', { credential: resp.credential }).then(finish, (e: Error) => {
              btnBox.classList.remove('busy');
              fail(e.message);
            });
          },
        });
        g.accounts.id.renderButton(btnBox, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with', locale: 'vi', width: 280 });
        g.accounts.id.prompt();
      })
      .catch((e: Error) => fail(e.message));
  });
  box.hidden = true;
  delete document.body.dataset.login;
  return session;
}
