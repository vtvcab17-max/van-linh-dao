// Bản chính thức (chỉ chạy web, đăng nhập Google, server quyết định) hay bản thử nghiệm (Claude / chơi trên máy / APK).
const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;

export const OFFICIAL = env.VITE_EDITION === 'official';
