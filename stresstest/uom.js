import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '20s', target: 40 }, 
    { duration: '40s', target: 40 },  
    { duration: '20s', target: 0 },  
  ],
  thresholds: {
    http_req_duration: ['p(95)<400'], // target latency lebih ketat (400ms) untuk UOM karena data kecil
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api';

export function setup() {
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: 'adminit@gmail.com',
    password: '12345678',
  }), { headers: { 'Content-Type': 'application/json' } });

  return { token: loginRes.json('data.record.accessToken') };
}

export default function (data) {
  const headers = {
    'Authorization': `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  // GET uoms list
  const listRes = http.get(`${BASE_URL}/uoms?page=1&limit=20`, { headers });
  check(listRes, {
    'list uoms is 200': (r) => r.status === 200,
  });

  // GET uoms dengan sorting
  const sortRes = http.get(`${BASE_URL}/uoms?orderBy=${encodeURIComponent("{'Name':'ASC'}")}`, { headers });
  check(sortRes, {
    'sort uoms is 200': (r) => r.status === 200,
  });

  sleep(1);
}
