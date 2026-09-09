'use strict';
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const root = __dirname, port = Number(process.env.PORT || 4173);
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.md':'text/plain; charset=utf-8', '.png':'image/png' };
http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400); res.end('Bad request'); return; }
  if (url.split(/[\\/]/).some(part => part.startsWith('.'))) { res.writeHead(403); res.end('Forbidden'); return; }
  const file = path.resolve(root, '.' + (url === '/' ? '/index.html' : url));
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, data) => { if (err) { res.writeHead(404); res.end('Not found'); return; } res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data); });
}).listen(port, '127.0.0.1', () => console.log(`魂斗罗 1: http://127.0.0.1:${port}`));
