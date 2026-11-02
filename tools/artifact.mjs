// Chuyển bản build (dist/index.html) thành nội dung trang Artifact trên Claude:
// bỏ các thẻ <!doctype>, <html>, <head>, <body> vì Claude tự bọc khung trang khi đăng.
import fs from 'fs';
const src = fs.readFileSync('dist/index.html', 'utf8');
const head = src.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = src.match(/<body>([\s\S]*?)<\/body>/)[1];
const keep = head
  .replace(/<meta charset="utf-8">\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '');
const title = keep.match(/<title>[\s\S]*?<\/title>/)[0];
const rest = keep.replace(title, '');
const out = `${title}\n${rest.trim()}\n${body.trim()}\n`;
fs.writeFileSync('dist/van-linh-dao.html', out);
console.log(`dist/van-linh-dao.html ${(out.length / 1024).toFixed(0)} KB`);
