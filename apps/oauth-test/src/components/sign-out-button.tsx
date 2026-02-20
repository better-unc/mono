'use client';

import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';

export function SignOutButton() {
  const router = useRouter();

  return (
    <button
      onClick={async () => {
        await authClient.signOut();
        router.push('/');
      }}
      style={{
        width: '100%',
        padding: '12px',
        background: 'transparent',
        color: '#f87171',
        border: '1px solid #3f1212',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: 500,
        cursor: 'pointer',
      }}
    >
      Sign out
    </button>
  );
}
