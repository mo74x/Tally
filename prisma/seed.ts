import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding Tally database...');

  const employer = await prisma.employer.create({
    data: {
      name: 'Tech Corp',
      payDay: 30,
      maxWithdrawalPct: 50.0,
    },
  });

  const employee = await prisma.employee.create({
    data: {
      employerId: employer.id,
      fullName: 'Alice Smith',
      monthlySalary: 3000.0,
      hireDate: new Date('2025-01-01'),
    },
  });

  // Create an open pay cycle starting at the beginning of the current month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const payCycle = await prisma.payCycle.create({
    data: {
      employerId: employer.id,
      periodStart: startOfMonth,
      periodEnd: endOfMonth,
      status: 'open',
    },
  });

  console.log(`Seed complete!`);
  console.log(`EMPLOYEE_ID: ${employee.id}`);
  console.log(`PAY_CYCLE_ID: ${payCycle.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
