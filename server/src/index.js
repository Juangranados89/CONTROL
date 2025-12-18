import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import apiRouter from './api.js';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

app.post('/api/login', async (req, res) => {
  const identifierRaw = String(req.body?.username ?? req.body?.email ?? '').trim();
  const password = String(req.body?.password || '');
  if (!identifierRaw || !password) return res.status(400).json({ error: 'Username/email and password required' });

  // Allow login with just a username (no domain) to match the UX requirement.
  const email = identifierRaw.includes('@') ? identifierRaw : `${identifierRaw}@control.local`;

  // Case-insensitive lookup to avoid surprises with capitalization in UI/seed.
  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: email,
        mode: 'insensitive'
      }
    }
  });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET || 'dev', { expiresIn: '8h' });
  res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
});

// Auth middleware for protected API routes
const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev');
    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Mount API routes (protected)
app.use('/api', requireAuth, apiRouter);

const ensureOptionalAdminUsers = async () => {
  // Create optional admin accounts only when their passwords are provided via env.
  // This avoids hardcoded credentials in production and fixes “login incorrect” when seed isn't run.
  const optionalUsers = [
    { email: 'julio.barrantes1@control.local', env: 'SEED_PASSWORD_JULIO_BARRANTES1', role: 'admin' },
    { email: 'Hector.Zapata1@control.local', env: 'SEED_PASSWORD_HECTOR_ZAPATA1', role: 'admin' },
    { email: 'Juan.granados1@control.local', env: 'SEED_PASSWORD_JUAN_GRANADOS1', role: 'admin' }
  ];

  for (const u of optionalUsers) {
    const pwd = process.env[u.env];
    if (!pwd) continue;

    const existing = await prisma.user.findFirst({
      where: { email: { equals: u.email, mode: 'insensitive' } }
    });
    if (existing) continue;

    const hash = await bcrypt.hash(pwd, 10);
    await prisma.user.create({ data: { email: u.email, passwordHash: hash, role: u.role } });
    console.log('Created optional user', u.email);
  }
};

(async () => {
  try {
    await ensureOptionalAdminUsers();
  } catch (e) {
    console.error('Optional user seed failed:', e?.message || e);
  }

  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
})();
