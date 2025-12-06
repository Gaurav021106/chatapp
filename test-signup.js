const http = require('http');

function testSignup(username, password, email) {
  const postData = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&email=${encodeURIComponent(email)}`;
  
  const options = {
    hostname: 'localhost',
    port: 2000,
    path: '/create',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data.substring(0, 500) // First 500 chars
        });
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

// Test cases
async function runTests() {
  console.log('Test 1: Valid signup');
  const test1 = await testSignup(`testuser_${Date.now()}`, 'password123', `test_${Date.now()}@example.com`);
  console.log('Status:', test1.statusCode);
  console.log('Body preview:', test1.body.substring(0, 200));
  console.log('---\n');

  console.log('Test 2: Short password (less than 6 chars)');
  const test2 = await testSignup(`shortpass_${Date.now()}`, 'pass', `shortpass_${Date.now()}@example.com`);
  console.log('Status:', test2.statusCode);
  console.log('Body preview:', test2.body.substring(0, 300));
  console.log('---\n');

  console.log('Test 3: Invalid email');
  const test3 = await testSignup(`invalidemail_${Date.now()}`, 'password123', 'notanemail');
  console.log('Status:', test3.statusCode);
  console.log('Body preview:', test3.body.substring(0, 300));
  console.log('---\n');

  console.log('Test 4: Short username (less than 3 chars)');
  const test4 = await testSignup('ab', 'password123', `shortuser_${Date.now()}@example.com`);
  console.log('Status:', test4.statusCode);
  console.log('Body preview:', test4.body.substring(0, 300));
}

runTests().catch(console.error);
