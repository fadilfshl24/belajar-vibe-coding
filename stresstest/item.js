import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 }, // Ramp-up
    { duration: '1m', target: 50 },  // Sustained load
    { duration: '30s', target: 0 },  // Ramp-down
  ],
  thresholds: {
    // Toleransi latency item lebih besar karena query join package details
    http_req_duration: ['p(95)<600'], 
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

  // 1. GET ALL items
  const listAll = http.get(`${BASE_URL}/items?page=1&limit=10`, { headers });
  check(listAll, {
    'list all items is 200': (r) => r.status === 200,
  });

  // 2. GET SINGLE items
  const listSingle = http.get(`${BASE_URL}/items?itemType=single&page=1&limit=10`, { headers });
  check(listSingle, {
    'list single items is 200': (r) => r.status === 200,
  });

  // 3. GET PACKAGE items
  const listPackage = http.get(`${BASE_URL}/items?itemType=package&page=1&limit=10`, { headers });
  check(listPackage, {
    'list package items is 200': (r) => r.status === 200,
  });

  sleep(1);
}
