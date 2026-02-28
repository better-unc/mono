import { sendPasswordResetEmail, sendVerificationEmail } from '../email';
import { db, users, verifications, accounts } from '@gitbruv/db';
import { getAuth, verifyCredentials } from '../auth';
import { eq, and, gt } from 'drizzle-orm';
import { Hono } from 'hono';

const app = new Hono();

function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

app.post('/api/auth/verify-credentials', async (c) => {
  const response = await verifyCredentials(c.req.raw);

  return response;
});

app.post('/api/auth/forgot-password', async (c) => {
  try {
    const body = await c.req.json<{ email?: string }>();
    const email = body?.email?.toLowerCase().trim();

    if (!email || !email.includes('@')) {
      return c.json({ error: 'Valid email is required' }, 400);
    }

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      return c.json({ success: true });
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db
      .delete(verifications)
      .where(and(eq(verifications.identifier, `password-reset:${email}`)));

    await db.insert(verifications).values({
      id: crypto.randomUUID(),
      identifier: `password-reset:${email}`,
      value: token,
      expiresAt,
    });

    await sendPasswordResetEmail(email, token, user.username);

    return c.json({ success: true });
  } catch (err) {
    console.error('[Auth] Forgot password error:', err);
    return c.json({ error: 'Failed to process request' }, 500);
  }
});

app.post('/api/auth/reset-password', async (c) => {
  try {
    const body = await c.req.json<{ token?: string; password?: string }>();
    const { token, password } = body || {};

    if (!token || typeof token !== 'string') {
      return c.json({ error: 'Token is required' }, 400);
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return c.json({ error: 'Password must be at least 8 characters' }, 400);
    }

    const verification = await db.query.verifications.findFirst({
      where: and(eq(verifications.value, token), gt(verifications.expiresAt, new Date())),
    });

    if (!verification || !verification.identifier.startsWith('password-reset:')) {
      return c.json({ error: 'Invalid or expired token' }, 400);
    }

    const email = verification.identifier.replace('password-reset:', '');

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    const hashedPassword = await Bun.password.hash(password, {
      algorithm: 'bcrypt',
      cost: 10,
    });

    await db
      .update(accounts)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(accounts.userId, user.id));

    await db.delete(verifications).where(eq(verifications.id, verification.id));

    return c.json({ success: true });
  } catch (err) {
    console.error('[Auth] Reset password error:', err);
    return c.json({ error: 'Failed to reset password' }, 500);
  }
});

app.post('/api/auth/resend-verification', async (c) => {
  try {
    const body = await c.req.json<{ email?: string }>();
    const email = body?.email?.toLowerCase().trim();

    if (!email || !email.includes('@')) {
      return c.json({ error: 'Valid email is required' }, 400);
    }

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      return c.json({ success: true });
    }

    if (user.emailVerified) {
      return c.json({ success: true });
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db
      .delete(verifications)
      .where(eq(verifications.identifier, `email-verification:${email}`));

    await db.insert(verifications).values({
      id: crypto.randomUUID(),
      identifier: `email-verification:${email}`,
      value: token,
      expiresAt,
    });

    await sendVerificationEmail(email, token, user.username);

    return c.json({ success: true });
  } catch (err) {
    console.error('[Auth] Resend verification error:', err);
    return c.json({ error: 'Failed to send verification email' }, 500);
  }
});

app.get('/api/auth/verify-email', async (c) => {
  try {
    const token = c.req.query('token');

    if (!token) {
      return c.json({ error: 'Token is required' }, 400);
    }

    const verification = await db.query.verifications.findFirst({
      where: and(eq(verifications.value, token), gt(verifications.expiresAt, new Date())),
    });

    if (!verification || !verification.identifier.startsWith('email-verification:')) {
      return c.json({ error: 'Invalid or expired token' }, 400);
    }

    const email = verification.identifier.replace('email-verification:', '');

    await db
      .update(users)
      .set({ emailVerified: true, updatedAt: new Date() })
      .where(eq(users.email, email));

    await db.delete(verifications).where(eq(verifications.id, verification.id));

    return c.json({ success: true });
  } catch (err) {
    console.error('[Auth] Verify email error:', err);
    return c.json({ error: 'Failed to verify email' }, 500);
  }
});

app.all('/api/auth/*', async (c) => {
  const auth = getAuth();
  const response = await auth.handler(c.req.raw);

  return response;
});

export default app;
