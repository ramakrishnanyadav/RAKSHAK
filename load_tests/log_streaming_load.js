import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 20 }, // Ramp-up to 20 users
    { duration: '30s', target: 50 }, // Sustain 50 concurrent streaming viewers
    { duration: '10s', target: 0 },  // Ramp-down
  ],
  thresholds: {
    // 95% of chunked log streaming requests must respond within 200ms
    http_req_duration: ['p(95)<200'],
    // HTTP error rate must remain under 1%
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:8000';
const RUN_ID = 'run_shipped_sample';
const CHUNK_SIZE = 65536; // 64 KB

export default function () {
  // Random chunk offset simulating scrubbing across frames
  const offsets = [0, 65536, 131072, 196608];
  const startByte = offsets[Math.floor(Math.random() * offsets.length)];
  const endByte = startByte + CHUNK_SIZE - 1;

  const params = {
    headers: {
      'Range': `bytes=${startByte}-${endByte}`,
      'Accept': 'application/json',
    },
  };

  // 1. Request chunked telemetry log
  const resLog = http.get(`${BASE_URL}/api/runs/${RUN_ID}/log`, params);
  check(resLog, {
    'status is 200 or 206': (r) => r.status === 200 || r.status === 206,
    'has content': (r) => r.body && r.body.length > 0,
  });

  // 2. Poll metadata
  const resMeta = http.get(`${BASE_URL}/api/runs/${RUN_ID}`);
  check(resMeta, {
    'meta status is 200': (r) => r.status === 200,
  });

  sleep(0.1);
}
