const http = require('http');

const postData = JSON.stringify({
  email: 'superadmin@gmail.com',
  password: 'password123'
});

const req = http.request('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      const token = parsed.data.accessToken;
      
      http.get('http://localhost:3000/api/roles', {
        headers: { 'Authorization': `Bearer ${token}` }
      }, (res2) => {
        let data2 = '';
        res2.on('data', (chunk) => data2 += chunk);
        res2.on('end', () => {
          console.log(data2.substring(0, 1000));
        });
      });
    } catch(e) { console.error(e, data) }
  });
});
req.write(postData);
req.end();
