import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

dotenv.config();
const prisma = new PrismaClient();

async function main() {
  const users = [];

  // Base accounts (override passwords via env in production)
  users.push({
    email: 'admin@example.com',
    password: process.env.SEED_ADMIN_PASSWORD || 'AdminPass123!'
    ,
    role: 'admin'
  });
  users.push({
    email: 'user@example.com',
    password: process.env.SEED_USER_PASSWORD || 'UserPass123!'
    ,
    role: 'user'
  });

  // Optional: create “username@control.local” accounts without hardcoding passwords.
  // Set these env vars in Render if you want these accounts enabled.
  const optionalUsers = [
    // Admin users (todos los privilegios)
    { email: 'julio.barrantes1@control.local', env: 'SEED_PASSWORD_JULIO_BARRANTES1', role: 'admin' },
    { email: 'Hector.Zapata1@control.local', env: 'SEED_PASSWORD_HECTOR_ZAPATA1', role: 'admin' },
    { email: 'Juan.granados1@control.local', env: 'SEED_PASSWORD_JUAN_GRANADOS1', role: 'admin' }
  ];

  for (const u of optionalUsers) {
    const pwd = process.env[u.env];
    if (!pwd) {
      console.log('Skipping optional user (missing env):', u.email);
      continue;
    }
    users.push({ email: u.email, password: pwd, role: u.role });
  }

  for (const u of users) {
    const normalizedEmail = u.email.toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (exists) {
      console.log('Skipping existing user', normalizedEmail);
      continue;
    }
    const hash = await bcrypt.hash(u.password, 10);
    await prisma.user.create({ data: { email: normalizedEmail, passwordHash: hash, role: u.role } });
    console.log('Created user', normalizedEmail);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
