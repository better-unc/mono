import { SignOutButton } from '@/components/sign-out-button';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/');

  const user = session.user as typeof session.user & { username?: string };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '560px' }}>
        <div
          style={{
            background: '#111',
            border: '1px solid #222',
            borderRadius: '12px',
            padding: '32px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            {user.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt={user.name ?? ''}
                width={56}
                height={56}
                style={{ borderRadius: '50%', border: '2px solid #333' }}
              />
            )}
            <div>
              <h1 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700 }}>{user.name}</h1>
              {user.username && (
                <p style={{ margin: 0, color: '#888', fontSize: '14px' }}>@{user.username}</p>
              )}
            </div>
            <span
              style={{
                marginLeft: 'auto',
                background: '#0d2d0d',
                color: '#4ade80',
                border: '1px solid #166534',
                borderRadius: '20px',
                padding: '4px 12px',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              authenticated
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <Field label="Email" value={user.email} />
            {user.username && <Field label="Username" value={user.username} />}
            <Field label="User ID" value={user.id} mono />
            <Field label="Provider" value="gitbruv" />
          </div>
        </div>

        <div
          style={{
            background: '#111',
            border: '1px solid #222',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '16px',
          }}
        >
          <h2
            style={{
              margin: '0 0 12px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#888',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Raw Session
          </h2>
          <pre
            style={{
              background: '#0a0a0a',
              border: '1px solid #1a1a1a',
              borderRadius: '6px',
              padding: '12px',
              fontSize: '11px',
              color: '#ededed',
              overflow: 'auto',
              margin: 0,
              lineHeight: '1.6',
            }}
          >
            {JSON.stringify(session, null, 2)}
          </pre>
        </div>

        <SignOutButton />
      </div>
    </main>
  );
}

function Field({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: '12px',
        padding: '8px 0',
        borderBottom: '1px solid #1a1a1a',
      }}
    >
      <span style={{ color: '#888', fontSize: '13px', minWidth: '80px', flexShrink: 0 }}>
        {label}
      </span>
      <span
        style={{
          fontSize: '13px',
          fontFamily: mono ? 'monospace' : 'inherit',
          color: '#ededed',
          wordBreak: 'break-all',
        }}
      >
        {value}
      </span>
    </div>
  );
}
