const http = require('http');
const https = require('https');

const DEEPSEEK_HOST = 'api.deepseek.com';
const DEEPSEEK_BASE = '/anthropic';
const LISTEN_PORT = 18765;

// 防止未捕获异常导致进程退出
process.on('uncaughtException', err => {
  console.error(new Date().toISOString(), '[proxy] 未捕获异常:', err.message);
});
process.on('unhandledRejection', reason => {
  console.error(new Date().toISOString(), '[proxy] 未处理的 Promise 拒绝:', reason);
});

function extractText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n\n');
  }
  return String(content);
}

function fixBody(raw) {
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return raw;
  }
  if (!body.messages || !Array.isArray(body.messages)) return raw;

  const systemBlocks = [];
  const normal = [];

  for (const msg of body.messages) {
    if (msg.role === 'system') {
      systemBlocks.push(extractText(msg.content));
    } else {
      normal.push(msg);
    }
  }

  if (systemBlocks.length === 0) return raw;

  const extracted = systemBlocks.join('\n\n');
  body.system = body.system ? body.system + '\n\n' + extracted : extracted;
  body.messages = normal;

  console.log(new Date().toISOString(), `[proxy] 修复 system ×${systemBlocks.length} → 顶层字段`);
  return JSON.stringify(body);
}

const server = http.createServer((req, res) => {
  // 健康检查
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200);
    res.end('ok');
    return;
  }

  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    try {
      const rawBody = Buffer.concat(chunks).toString();
      const fixed = fixBody(rawBody);

      const options = {
        hostname: DEEPSEEK_HOST,
        port: 443,
        path: DEEPSEEK_BASE + req.url,
        method: req.method,
        headers: {
          ...req.headers,
          host: DEEPSEEK_HOST,
          'content-length': Buffer.byteLength(fixed),
        },
      };

      const upstream = https.request(options, upstreamRes => {
        res.writeHead(upstreamRes.statusCode, upstreamRes.headers);
        upstreamRes.pipe(res);
      });

      upstream.on('error', err => {
        console.error(new Date().toISOString(), '[proxy] 上游失败:', err.message);
        res.writeHead(502);
        res.end('Proxy error');
      });

      upstream.write(fixed);
      upstream.end();
    } catch (err) {
      console.error(new Date().toISOString(), '[proxy] 请求处理异常:', err.message);
      res.writeHead(500);
      res.end('Internal proxy error');
    }
  });
});

server.on('error', err => {
  console.error(new Date().toISOString(), '[proxy] 服务器错误:', err.message);
  process.exit(1);
});

server.listen(LISTEN_PORT, '127.0.0.1', () => {
  console.log(new Date().toISOString(), `[proxy] 启动成功: http://127.0.0.1:${LISTEN_PORT} → https://${DEEPSEEK_HOST}${DEEPSEEK_BASE}`);
});
