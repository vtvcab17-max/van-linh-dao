// Máy chủ tĩnh tí hon để chạy thử bản build thật: node tools/serve.mjs [cổng]
import http from 'http';
import fs from 'fs';
import path from 'path';
const port = Number(process.argv[2] ?? 5174);
const root = path.resolve('dist');
http.createServer((req, res) => {
  const u = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const f = path.join(root, u === '/' ? 'index.html' : u);
  if (!f.startsWith(root) || !fs.existsSync(f)) return res.writeHead(404).end('not found');
  res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}/`));
