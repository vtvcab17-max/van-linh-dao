import { ClaudeNet } from './claude';
import { CloudflareNet } from './cloudflare';
import { OfflineNet } from './offline';
import type { Net } from './types';
import { OFFICIAL } from '../edition';
import { login } from '../login';

/**
 * Chọn chế độ mạng:
 * - mở trên Claude (có window.claude) → online qua db/room của Claude
 * - có ?server=https://... (hoặc cấu hình VLD_SERVER) → online qua Cloudflare
 * - còn lại → chơi trên máy với đảo máy
 */
export async function createNet(): Promise<Net> {
  const q = new URLSearchParams(location.search);
  const built = (import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_VLD_SERVER;
  const server = q.get('server') ?? (built === 'same-origin' || OFFICIAL ? location.origin : built);
  if (server) {
    // bản chính thức: đăng nhập Google trước, rồi vào Hải Khu được phân
    const sess = await login(server.replace(/\/$/, ''));
    const n = new CloudflareNet(server.replace(/\/$/, ''), sess);
    await n.init();
    return n;
  }
  try {
    const caps = await Promise.race([ClaudeNet.available(), new Promise<null>((r) => setTimeout(() => r(null), 7000))]);
    if (caps) {
      const n = new ClaudeNet(caps);
      await n.init();
      return n;
    }
  } catch (e) {
    console.warn('Không dùng được chế độ Claude, chuyển sang chơi trên máy.', e);
  }
  const n = new OfflineNet();
  await n.init();
  return n;
}
