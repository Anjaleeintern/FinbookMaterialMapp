const http = require('http');
const fs = require('fs');
const path = require('path');

// Auto-load environment variables from .env if present
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (key && rest.length) {
      process.env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
}

const PORT = parseInt(process.env.EXPO_PUBLIC_PROXY_PORT || process.env.PROXY_PORT || '8005', 10);
const TARGET_HOST = process.env.BACKEND_HOST || '127.0.0.1';
const TARGET_PORT = parseInt(process.env.EXPO_PUBLIC_BACKEND_PORT || process.env.BACKEND_PORT || '8001', 10);

const server = http.createServer((req, res) => {
  // Global CORS headers for mobile and web
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const options = {
    hostname: TARGET_HOST,
    port: TARGET_PORT,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: `${TARGET_HOST}:${TARGET_PORT}`,
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    // Preserve response headers with CORS
    const headers = { ...proxyRes.headers };
    headers['access-control-allow-origin'] = '*';
    headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH';
    headers['access-control-allow-headers'] = '*';
    
    res.writeHead(proxyRes.statusCode, headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    console.error('[Bridge Proxy Error]:', err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: 'Backend connection failed: ' + err.message }));
    }
  });

  req.pipe(proxyReq, { end: true });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Bridge Proxy] Mobile-to-Backend Bridge running on http://0.0.0.0:${PORT} -> ${TARGET_HOST}:${TARGET_PORT}`);
});
