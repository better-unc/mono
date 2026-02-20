import { db, oauthClients } from '@gitbruv/db';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';

const app = new Hono();

app.get('/oauth/consent', async (c) => {
  try {
    const query = c.req.query();
    const clientId = query['client_id'];
    const scope = query['scope'];
    const redirectUri = query['redirect_uri'];
    const rawQueryString = new URL(c.req.url).search.slice(1);

    if (!clientId || !scope || !redirectUri) {
      return c.json({ error: 'Missing required parameters' }, 400);
    }

    // Get client information
    const client = await db.query.oauthClients.findFirst({
      where: eq(oauthClients.clientId, clientId),
    });

    if (!client) {
      return c.json({ error: 'Invalid client' }, 400);
    }

    // Return HTML consent page
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Authorize Application</title>
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            max-width: 600px;
            margin: 40px auto;
            padding: 20px;
            background: #f9fafb;
          }
          .card {
            background: white;
            padding: 32px;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }
          .client-info {
            margin-bottom: 24px;
            padding-bottom: 24px;
            border-bottom: 1px solid #e5e7eb;
          }
          .client-name {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 8px;
          }
          .scopes {
            margin-bottom: 24px;
          }
          .scope-item {
            padding: 8px 0;
            border-bottom: 1px solid #f3f4f6;
          }
          .buttons {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
          }
          button {
            padding: 12px 24px;
            border-radius: 6px;
            font-weight: 500;
            cursor: pointer;
            border: 1px solid transparent;
          }
          .btn-approve {
            background: #3b82f6;
            color: white;
          }
          .btn-approve:hover {
            background: #2563eb;
          }
          .btn-deny {
            background: white;
            color: #374151;
            border-color: #d1d5db;
          }
          .btn-deny:hover {
            background: #f9fafb;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="client-info">
            <h1>Authorize Application</h1>
            <div class="client-name">${client.name || 'Unknown Application'}</div>
            <p>would like permission to access your account</p>
            ${client.uri ? `<p><a href="${client.uri}" target="_blank">${client.uri}</a></p>` : ''}
          </div>

          <div class="scopes">
            <h3>This application will be able to:</h3>
            ${scope
              .split(' ')
              .map(
                (s) => `
              <div class="scope-item">
                <strong>${getScopeDisplayName(s)}</strong>
                <p>${getScopeDescription(s)}</p>
              </div>
            `,
              )
              .join('')}
          </div>

          <div class="buttons">
            <button type="button" class="btn-deny" onclick="submitConsent(false)">Deny</button>
            <button type="button" class="btn-approve" onclick="submitConsent(true)">Approve</button>
          </div>
        </div>
        <script>
          async function submitConsent(accept) {
            const res = await fetch('/api/auth/oauth2/consent', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                oauth_query: ${JSON.stringify(rawQueryString)},
                accept,
              }),
            });
            if (res.redirected) {
              window.location.href = res.url;
            } else {
              const data = await res.json().catch(() => null);
              if (data?.uri) window.location.href = data.uri;
              else if (data?.redirectTo) window.location.href = data.redirectTo;
              else if (!res.ok) console.error('Consent error:', data);
            }
          }
        </script>
      </body>
      </html>
    `;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error) {
    console.error('[OAuth] Consent page error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

function getScopeDisplayName(scope: string): string {
  const displayNames: Record<string, string> = {
    openid: 'OpenID Authentication',
    profile: 'Profile Information',
    email: 'Email Address',
    offline_access: 'Offline Access',
    'read:user': 'Read User Data',
    'write:user': 'Write User Data',
  };
  return displayNames[scope] || scope;
}

function getScopeDescription(scope: string): string {
  const descriptions: Record<string, string> = {
    openid: 'Authenticate using your OpenID identity',
    profile: 'Access your name, username, and profile picture',
    email: 'Access your email address and verification status',
    offline_access: 'Maintain access when you are not actively using the application',
    'read:user': 'Read your user information and data',
    'write:user': 'Modify your user information and data',
  };
  return descriptions[scope] || `Access to ${scope}`;
}

export default app;
