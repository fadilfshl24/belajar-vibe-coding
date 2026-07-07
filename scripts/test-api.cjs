const axios = require('axios');
axios.post('http://localhost:3000/api/auth/sign-in', {
  email: 'superadmin@gmail.com',
  password: 'password123'
}).then(res => {
  const token = res.data.data.accessToken;
  return axios.get('http://localhost:3000/api/roles', {
    headers: { Authorization: `Bearer ${token}` }
  });
}).then(res => {
  console.log(JSON.stringify(res.data.data.records, null, 2).substring(0, 1000));
}).catch(err => console.error(err.response ? err.response.data : err.message));
