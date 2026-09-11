const http = require('node:http');
// Test-only, fixed loopback listener. No outbound network or credentials.
let count = 0;
const server = http.createServer((req, res) => {
  count++;
  console.log(JSON.stringify({ request: count, host: req.headers.host, path: req.url }));
  res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'public, s-maxage=300' });
  if (count === 1) {
    // Unknown-length chunked body: client must abort before the held-open EOF.
    res.write(Buffer.alloc(3 * 1024 * 1024, 97));
    const timer = setTimeout(() => res.end(), 5000);
    res.on('close', () => { clearTimeout(timer); console.log('OVERSIZE_CONNECTION_CLOSED'); });
  } else if (count === 2) {
    res.write('partial');
    const timer = setTimeout(() => res.end('late'), 5000);
    res.on('close', () => { clearTimeout(timer); console.log('STALL_CONNECTION_CLOSED'); });
  } else {
    res.end('complete');
  }
});
server.listen(47839, '127.0.0.1', () => console.log('LOOPBACK_READY 127.0.0.1:47839'));
setTimeout(() => server.close(), 60000).unref();
