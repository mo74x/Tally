-- CreateTable
CREATE TABLE "employers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "payDay" INTEGER NOT NULL,
    "maxWithdrawalPct" DECIMAL(5,2) NOT NULL DEFAULT 50.00,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employerId" UUID NOT NULL,
    "fullName" VARCHAR(255) NOT NULL,
    "monthlySalary" DECIMAL(12,2) NOT NULL,
    "hireDate" DATE NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_cycles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employerId" UUID NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'open',

    CONSTRAINT "pay_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawal_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL,
    "payCycleId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "feeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "idempotencyKey" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "withdrawal_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "withdrawalRequestId" UUID NOT NULL,
    "accountType" VARCHAR(30) NOT NULL,
    "accountRefId" UUID NOT NULL,
    "entryType" VARCHAR(10) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_batches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payCycleId" UUID NOT NULL,
    "totalWithdrawn" DECIMAL(14,2) NOT NULL,
    "totalFees" DECIMAL(14,2) NOT NULL,
    "reportGeneratedAt" TIMESTAMPTZ,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',

    CONSTRAINT "settlement_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pay_cycles_employerId_periodStart_key" ON "pay_cycles"("employerId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_requests_employeeId_idempotencyKey_key" ON "withdrawal_requests"("employeeId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "settlement_batches_payCycleId_key" ON "settlement_batches"("payCycleId");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "employers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_cycles" ADD CONSTRAINT "pay_cycles_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "employers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_payCycleId_fkey" FOREIGN KEY ("payCycleId") REFERENCES "pay_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_withdrawalRequestId_fkey" FOREIGN KEY ("withdrawalRequestId") REFERENCES "withdrawal_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_batches" ADD CONSTRAINT "settlement_batches_payCycleId_fkey" FOREIGN KEY ("payCycleId") REFERENCES "pay_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
