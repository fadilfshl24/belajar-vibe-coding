import http from 'k6/http';
import { check, sleep } from 'k6';

// Konfigurasi stress test: 
// Naik secara bertahap hingga 50 Virtual Users (VU), tahan, lalu turun
export const options = {
  stages: [
    { duration: '15s', target: 20 }, // Ramp-up ke 20 VU dalam 15 detik
    { duration: '30s', target: 50 }, // Ramp-up ke 50 VU dalam 30 detik
    { duration: '30s', target: 50 }, // Tahan di 50 VU selama 30 detik
    { duration: '15s', target: 0 },  // Ramp-down ke 0 VU
  ],
  thresholds: {
    // 95% dari request harus selesai di bawah 500ms
    http_req_duration: ['p(95)<500'],
    // Tingkat error harus kurang dari 1%
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api';

export default function () {
  const payload = JSON.stringify({
    email: 'adminit@gmail.com',
    password: '12345678',
  });

  const headers = {
    'Content-Type': 'application/json',
  };

  // Skenario 1: Login
  const loginRes = http.post(`${BASE_URL}/auth/login`, payload, { headers });
  
  check(loginRes, {
    'login status is 200': (r) => r.status === 200,
    'login has access token': (r) => r.json('data.record.accessToken') !== undefined,
  });

  // Jika login berhasil, coba hit endpoint protected dengan token tersebut
  if (loginRes.status === 200) {
    const token = loginRes.json('data.record.accessToken');
    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // Kita hit endpoint list roles sebagai dummy protected route
    const roleRes = http.get(`${BASE_URL}/roles?page=1&limit=5`, { headers: authHeaders });
    check(roleRes, {
      'get roles status is 200': (r) => r.status === 200,
    });
  }

  // Istirahat sejenak antar request layaknya user nyata
  sleep(1);
}
