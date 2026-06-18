import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 30 }, // Naik ke 30 VU dalam 30s
    { duration: '1m', target: 30 },  // Tahan di 30 VU selama 1 menit
    { duration: '30s', target: 0 },  // Turun ke 0 VU
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api';

// Setup dijalankan sekali sebelum virtual users (VU) berjalan, 
// cocok untuk autentikasi dan mendapatkan token.
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

  // GET list warehouses dengan pagination
  const listRes = http.get(`${BASE_URL}/warehouses?page=1&limit=10`, { headers });
  check(listRes, {
    'list status is 200': (r) => r.status === 200,
  });

  // GET list warehouses dengan filter
  const filterRes = http.get(`${BASE_URL}/warehouses?searchTerm=Test&filterColumn=name`, { headers });
  check(filterRes, {
    'filter status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
