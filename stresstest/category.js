import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
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

  // GET categories list
  const listRes = http.get(`${BASE_URL}/categories?page=1&limit=20`, { headers });
  check(listRes, {
    'list categories is 200': (r) => r.status === 200,
  });

  // GET search categories
  const searchRes = http.get(`${BASE_URL}/categories?searchTerm=Elektronik&filterColumn=name`, { headers });
  check(searchRes, {
    'search categories is 200': (r) => r.status === 200,
  });

  sleep(1);
}
