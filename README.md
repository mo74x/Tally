<div align="center">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&size=30&pause=1000&color=3B82F6&center=true&vCenter=true&width=600&lines=Tally+Platform;Earned+Wage+Access+Simulation;High+Concurrency+Protection;Immutable+Ledger+Auditing" alt="Tally Platform Title" />
</div>

<br />

Tally is a high-performance Earned Wage Access (EWA) simulation platform built on NestJS. It models transactional core functions allowing employees to withdraw their accrued wages before the standard monthly payroll run. The platform guarantees strict multi-tenant data isolation, idempotency protection, atomic transaction handling, and distributed concurrency controls.

---

## Architectural Principles and Design Patterns

The system is constructed around five strict structural rules to guarantee absolute ledger consistency and data security:

### 1. Atomic Transaction Serialization (Redis Lock)
To prevent race conditions and double-spending of accrued balances under highly concurrent requests, a distributed Redis-based locking pattern is enforced.
*   **Key Design**: `tally:lock:employee:{employeeId}:withdrawal`
*   **Lock TTL**: 5 seconds (self-expires to prevent deadlocks in case of process failure).
*   **Locking Flow**:
    *   Lock is acquired atomically before database retrieval.
    *   Calculations are computed using fresh, live database records.
    *   State updates are written.
    *   The lock is released in a `finally` block to ensure safety.

### 2. Live On-Demand Balance Calculations
The platform avoids caching or snapshotting daily balances, which could lead to outdated or exploited calculations. The current available balance is computed fresh inside the transaction:
*   Formula: `Daily Rate = Monthly Salary / Total Working Days in Cycle (standard: 22)`
*   Formula: `Earned to Date = Daily Rate * Working Days Elapsed`
*   Formula: `Accessible Ceiling = Earned to Date * Max Withdrawal Percentage (e.g., 50%)`
*   Formula: `Available Balance = Accessible Ceiling - Approved Withdrawals in Current Cycle`

### 3. Immutable Append-Only Ledgering
The financial ledger table (`ledger_entries`) is strictly append-only.
*   No `UPDATE` or `DELETE` statements are ever executed on this model.
*   Reversals, chargebacks, or manual adjustments are implemented exclusively by appending offsetting credit or debit records.
*   Every withdrawal generates two matching double-entry lines:
    *   A debit to the employee's accrued balance ledger.
    *   A credit to the employer's payable ledger.

### 4. Multi-Tenant Isolation
Tenants (Employers and Employees) are isolated via passport JWT strategies and customized NestJS guards.
*   All endpoints scoped to an employer require JWT validation.
*   The token claims inject the `employerId` context.
*   An isolation guard (`EmployerIsolationGuard`) intercepts requests to verify that the requesting user's identity is authorized to access the specific employer resource.

### 5. Idempotent Queue-Driven Month-End Settlements
Settlements close the active pay cycle, aggregate final wages, compute service fees, generate reports, and spawn the next month's cycle.
*   Driven asynchronously by BullMQ.
*   Unique job identifiers (`settlement-{employerId}-{payCycleId}`) prevent multiple runs for the same cycle.
*   Job failure recovery runs are design-safe and do not result in duplicate cycles or double-calculated fees.

---

## System Workflows

### Withdrawal Request Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant Controller as WithdrawalController
    participant Service as WithdrawalService
    participant Redis as RedisLockService
    participant DB as Postgres (Prisma)

    Client->>Controller: POST /v1/withdrawal-requests (Payload + Idempotency Key)
    Controller->>Service: processWithdrawal()
    Service->>Redis: acquireLock(employee:id:withdrawal, 5000ms)
    
    alt Lock Acquisition Fails
        Redis-->>Service: Null (Lock Busy)
        Service-->>Client: HTTP 409 Conflict (Concurrency Blocked)
    else Lock Acquired
        Redis-->>Service: Lock Token
        Service->>DB: Check Idempotency Key
        alt Key Exists (Duplicate Request)
            DB-->>Service: Existing Record
            Service-->>Client: HTTP 201 Created (Return cached transaction outcome)
        else Key is New
            Service->>DB: Fetch Employee, Employer, and Active PayCycle
            DB-->>Service: Entities
            Service->>Service: Compute Accrued Balance & Validate Deduction Limit
            alt Insufficient Balance
                Service-->>Client: HTTP 422 Unprocessable Entity
            else Balance Validated
                Service->>DB: Prisma Transaction (Insert Request + Ledger Debit + Ledger Credit)
                DB-->>Service: Transaction Success
                Service->>Redis: releaseLock(lockKey, Lock Token)
                Service-->>Client: HTTP 201 Created (Withdrawal Request Details)
            end
        end
    end
```

---

## Database Schema

```
  +------------------+         +-------------------+         +----------------------+
  |     Employer     | 1     * |     Employee      | 1     * |  WithdrawalRequest   |
  |------------------|---------|-------------------|---------|----------------------|
  | id (UUID) [PK]   |         | id (UUID) [PK]    |         | id (UUID) [PK]       |
  | name             |         | employerId [FK]   |         | employeeId [FK]      |
  | payDay           |         | fullName          |         | payCycleId [FK]      |
  | maxWithdrawalPct |         | monthlySalary     |         | amount               |
  +------------------+         | hireDate          |         | feeAmount            |
         | 1                   | status            |         | status               |
         |                     +-------------------+         | idempotencyKey       |
         | *                                                 +----------------------+
  +------------------+                                                  | 1
  |     PayCycle     |                                                  |
  |------------------|                                                  | *
  | id (UUID) [PK]   |                                       +----------------------+
  | employerId [FK]  |                                       |     LedgerEntry      |
  | periodStart      |                                       |----------------------|
  | periodEnd        |                                       | id (UUID) [PK]       |
  | status           | 1                                   1 | withdrawalReqId [FK] |
  +------------------+---------------------------------------| accountType          |
         | 1                                                 | accountRefId         |
         |                                                   | entryType            |
         | 1 (Optional)                                      | amount               |
  +-------------------+                                      +----------------------+
  |  SettlementBatch  |
  |-------------------|
  | id (UUID) [PK]    |
  | payCycleId [FK]   |
  | totalWithdrawn    |
  | totalFees         |
  | reportGeneratedAt |
  | status            |
  +-------------------+
```

---

## API Documentation

### 1. Process Accrued Wage Withdrawal
Initiates a secure earned wage withdrawal check. Requires verification of the active pay cycle and available balance constraints.

*   **HTTP Method**: `POST`
*   **Path**: `/v1/withdrawal-requests`
*   **Request Headers**:
    *   `Content-Type: application/json`

*   **Request Body**:
```json
{
  "employeeId": "8b2309b3-d5f0-4e8e-b8c1-9a6869306aa5",
  "payCycleId": "684954ff-7173-4680-9d47-79d4c4be2d12",
  "amount": 400.00,
  "idempotencyKey": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
}
```

*   **Success Response** (HTTP 201):
```json
{
  "success": true,
  "data": {
    "id": "c62a8cb5-11ba-401a-905c-b718e8b42dcf",
    "employeeId": "8b2309b3-d5f0-4e8e-b8c1-9a6869306aa5",
    "payCycleId": "684954ff-7173-4680-9d47-79d4c4be2d12",
    "amount": "400.00",
    "feeAmount": "2.50",
    "status": "approved",
    "idempotencyKey": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "createdAt": "2026-07-15T12:22:42.000Z"
  }
}
```

*   **Concurrency Collision Response** (HTTP 409):
```json
{
  "statusCode": 409,
  "message": "A withdrawal is already processing. Please try again in a moment.",
  "error": "Conflict"
}
```

*   **Insufficient Balance Response** (HTTP 422):
```json
{
  "statusCode": 422,
  "message": "Insufficient balance. Available: 350.00",
  "error": "Unprocessable Entity"
}
```

---

### 2. Trigger Month-End Settlement Batch
Triggers the month-end closure sequence. Access is restricted to accounts with administrative privileges matching the target employer.

*   **HTTP Method**: `POST`
*   **Path**: `/v1/employers/:id/settlements/cycles/:cycleId/run`
*   **Request Headers**:
    *   `Authorization: Bearer <JWT_TOKEN>`

*   **Success Response** (HTTP 202):
```json
{
  "success": true,
  "message": "Settlement batch job successfully dispatched to the processing queue.",
  "employerId": "ea6b5a35-878f-4bec-80c2-c71120b78f14",
  "payCycleId": "684954ff-7173-4680-9d47-79d4c4be2d12"
}
```

---

## Detailed Local Setup

### Installation Environment
Make sure Node.js v18+, PostgreSQL 14+, and a running instance of Redis are available.

1.  **Clone and Clean install**:
    ```bash
    npm ci
    ```

2.  **Environment Setup**:
    Configure your `.env` file at the project root:
    ```env
    PORT=3000
    DATABASE_URL="postgresql://postgres:secret@localhost:5432/tally?schema=public"
    REDIS_HOST="127.0.0.1"
    REDIS_PORT=6379
    ```

3.  **Execute Database Generation & Seeding**:
    Apply database schema configurations via Prisma and seed structural entries:
    ```bash
    npx prisma generate
    npx prisma db push
    npx --yes tsx prisma/seed.ts
    ```
    *Note: The seed script outputs valid `EMPLOYEE_ID` and `PAY_CYCLE_ID` variables which are used during testing configurations.*

4.  **Start Services**:
    ```bash
    # Development hot-reload watch
    npm run start:dev

    # Production compilation and run
    npm run build
    npm run start:prod
    ```

---

## Containerized Deployment (Docker)

Tally leverages a secure multi-stage build structure defined in its Dockerfile to compile, test, and ship clean lightweight final production files:

```bash
# Build the production container image
docker build -t tally-platform:latest .

# Run application utilizing a local environment profile
docker run -d --name tally-app -p 3000:3000 --env-file .env tally-platform:latest
```

---

## Concurrency Performance Verification

To verify that the system correctly serializes parallel requests under heavy loads, you can use the integrated `k6` load test setup:

1.  Compile and execute the database seed script to acquire valid identifiers.
2.  Open `concurrency-test.js` and set the target IDs:
    ```javascript
    const EMPLOYEE_ID = 'YOUR-REAL-EMPLOYEE-UUID-HERE';
    const PAY_CYCLE_ID = 'YOUR-REAL-PAY-CYCLE-UUID-HERE';
    ```
3.  Execute the load test command:
    ```bash
    k6 run concurrency-test.js
    ```
4.  Observe the performance outputs. A successful test verifies serialization where exactly 1 transaction succeeds (HTTP 201), and the remaining concurrent attempts are properly restricted with Conflict codes (HTTP 409).
