import http from 'k6/http';
import { check, sleep } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

export const options = {
  scenarios: {
    sudden_burst: {
      executor: 'per-vu-iterations',
      vus: 10,
      iterations: 1,
      maxDuration: '5s',
    },
  },
};

const URL = 'http://localhost:3000/v1/withdrawal-requests';

const EMPLOYEE_ID = '8b2309b3-d5f0-4e8e-b8c1-9a6869306aa5'; 
const PAY_CYCLE_ID = '684954ff-7173-4680-9d47-79d4c4be2d12';

export default function () {
  const payload = JSON.stringify({
    employeeId: EMPLOYEE_ID,
    payCycleId: PAY_CYCLE_ID,
    amount: 400.00,
    idempotencyKey: uuidv4(), 
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(URL, payload, params);

  // DEBUGGING: Log the response body if it's a 400 or 500 error
  if (res.status >= 400 && res.status !== 409 && res.status !== 422) {
      console.log(`Unexpected Failure! Status: ${res.status}, Body: ${res.body}`);
  }

  check(res, {
    'Is Success (201)': (r) => r.status === 201,
    'Is Concurrency Blocked (409)': (r) => r.status === 409,
    'Is Insufficient Balance (422)': (r) => r.status === 422,
  });
}