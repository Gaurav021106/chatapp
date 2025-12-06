const http = require('http');
const fs = require('fs');
const path = require('path');

const token = process.argv[2];
const filePath = process.argv[3] || 'test_doc.txt';
if (!token) {
  console.error('Usage: node e2e_post_document_manual.js <TOKEN> [filePath]');
  process.exit(1);
}

const fileName = path.basename(filePath);
const fileBuf = fs.readFileSync(filePath);

const boundary = '--------------------------' + Date.now().toString(16);
const CRLF = '\r\n';

let body = '';
body += `--${boundary}${CRLF}`;
body += `Content-Disposition: form-data; name="file"; filename="${fileName}"${CRLF}`;
body += `Content-Type: application/octet-stream${CRLF}${CRLF}`;

const pre = Buffer.from(body, 'utf8');
const post = Buffer.from(`${CRLF}--${boundary}--${CRLF}`, 'utf8');

const options = {
  hostname: 'localhost',
  port: 2000,
  path: '/api/summarize/document',
  method: 'POST',
  headers: {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': pre.length + fileBuf.length + post.length,
    'Cookie': `token=${token}`,
    'Accept': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.setEncoding('utf8');
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    try {
      const json = JSON.parse(data);
      console.log('RESPONSE:', JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('RAW RESPONSE:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e);
});

req.write(pre);
req.write(fileBuf);
req.write(post);
req.end();
