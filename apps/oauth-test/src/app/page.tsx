import { LoginButton } from '@/components/login-button';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

export default async function LoginPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect('/dashboard');

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: '#111',
          border: '1px solid #222',
          borderRadius: '12px',
          padding: '48px',
          width: '100%',
          maxWidth: '400px',
          textAlign: 'center',
        }}
      >
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 8px' }}>
            OAuth Test Client
          </h1>
          <p style={{ color: '#888', margin: 0, fontSize: '14px' }}>
            Testing gitbruv as an OAuth provider
          </p>
        </div>
        <LoginButton />
      </div>
    </main>
  );
}
