import { db, oauthClients } from '@gitbruv/db';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';

const app = new Hono();

app.get('/consent', async (c) => {
  try {
    const clientId = c.req.query('client_id');
    const scope = c.req.query('scope');
    const redirectUri = c.req.query('redirect_uri');
    const state = c.req.query('state');
    const response_type = c.req.query('response_type');
    const code_challenge = c.req.query('code_challenge');
    const code_challenge_method = c.req.query('code_challenge_method');

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
            <form method="POST" action="/api/auth/oauth2/consent" style="display: inline;">
              <input type="hidden" name="accept" value="false">
              <input type="hidden" name="client_id" value="${clientId}">
              <input type="hidden" name="scope" value="${scope}">
              <input type="hidden" name="redirect_uri" value="${redirectUri}">
              <input type="hidden" name="state" value="${state || ''}">
              <input type="hidden" name="response_type" value="${response_type || ''}">
              <input type="hidden" name="code_challenge" value="${code_challenge || ''}">
              <input type="hidden" name="code_challenge_method" value="${code_challenge_method || ''}">
              <button type="submit" class="btn-deny">Deny</button>
            </form>
            <form method="POST" action="/api/auth/oauth2/consent" style="display: inline;">
              <input type="hidden" name="accept" value="true">
              <input type="hidden" name="client_id" value="${clientId}">
              <input type="hidden" name="scope" value="${scope}">
              <input type="hidden" name="redirect_uri" value="${redirectUri}">
              <input type="hidden" name="state" value="${state || ''}">
              <input type="hidden" name="response_type" value="${response_type || ''}">
              <input type="hidden" name="code_challenge" value="${code_challenge || ''}">
              <input type="hidden" name="code_challenge_method" value="${code_challenge_method || ''}">
              <button type="submit" class="btn-approve">Approve</button>
            </form>
          </div>
        </div>
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
