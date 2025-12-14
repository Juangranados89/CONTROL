import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

dotenv.config();
const prisma = new PrismaClient();

async function main() {
  const users = [
    { email: 'admin@example.com', password: 'AdminPass123!', role: 'admin' },
    { email: 'user@example.com', password: 'UserPass123!', role: 'user' }
  ];

  for (const u of users) {
    const exists = await prisma.user.findUnique({ where: { email: u.email } });
    if (exists) {
      console.log('Skipping existing user', u.email);
      continue;
    }
    const hash = await bcrypt.hash(u.password, 10);
    await prisma.user.create({ data: { email: u.email, passwordHash: hash, role: u.role } });
    console.log('Created user', u.email);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
