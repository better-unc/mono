import { config, getWebUrl } from '../config';
import { Resend } from 'resend';

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (!config.email.resendApiKey) {
    console.warn('[Email] RESEND_API_KEY not configured, emails will not be sent');
    return null;
  }

  if (!resendClient) {
    resendClient = new Resend(config.email.resendApiKey);
  }

  return resendClient;
}

export type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const resend = getResend();

  if (!resend) {
    console.warn('[Email] Skipping email send - Resend not configured');
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: config.email.fromAddress,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    if (error) {
      console.error('[Email] Failed to send email:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Email] Error sending email:', err);
    return false;
  }
}

export async function sendPasswordResetEmail(
  to: string,
  token: string,
  username: string,
): Promise<boolean> {
  const webUrl = getWebUrl();
  const resetUrl = `${webUrl}/reset-password?token=${token}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px;">
    <h1 style="color: white; margin: 0; font-size: 28px;">GitBruv</h1>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
    <h2 style="margin-top: 0;">Reset your password</h2>
    <p>Hey @${username},</p>
    <p>We received a request to reset your password. Click the button below to create a new password:</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; font-weight: 600; display: inline-block;">Reset Password</a>
    </div>
    <p style="color: #6b7280; font-size: 14px;">This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    <p style="color: #9ca3af; font-size: 12px;">If the button doesn't work, copy and paste this URL into your browser:</p>
    <p style="color: #6b7280; font-size: 12px; word-break: break-all;">${resetUrl}</p>
  </div>
</body>
</html>`;

  const text = `
Reset your password

Hey @${username},

We received a request to reset your password. Visit the link below to create a new password:

${resetUrl}

This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
`;

  return sendEmail({
    to,
    subject: 'Reset your GitBruv password',
    html,
    text,
  });
}

export async function sendVerificationEmail(
  to: string,
  token: string,
  username: string,
): Promise<boolean> {
  const webUrl = getWebUrl();
  const verifyUrl = `${webUrl}/verify-email?token=${token}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px;">
    <h1 style="color: white; margin: 0; font-size: 28px;">GitBruv</h1>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
    <h2 style="margin-top: 0;">Verify your email address</h2>
    <p>Hey @${username},</p>
    <p>Welcome to GitBruv! Please verify your email address by clicking the button below:</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${verifyUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; font-weight: 600; display: inline-block;">Verify Email</a>
    </div>
    <p style="color: #6b7280; font-size: 14px;">This link will expire in 24 hours.</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    <p style="color: #9ca3af; font-size: 12px;">If the button doesn't work, copy and paste this URL into your browser:</p>
    <p style="color: #6b7280; font-size: 12px; word-break: break-all;">${verifyUrl}</p>
  </div>
</body>
</html>`;

  const text = `
Verify your email address

Hey @${username},

Welcome to GitBruv! Please verify your email address by visiting the link below:

${verifyUrl}

This link will expire in 24 hours.
`;

  return sendEmail({
    to,
    subject: 'Verify your GitBruv email',
    html,
    text,
  });
}

export async function sendNotificationEmail(
  to: string,
  title: string,
  body: string,
  actionUrl?: string,
  actionText?: string,
): Promise<boolean> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px;">
    <h1 style="color: white; margin: 0; font-size: 28px;">GitBruv</h1>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
    <h2 style="margin-top: 0;">${title}</h2>
    <p>${body}</p>
    ${
      actionUrl && actionText
        ? `
    <div style="text-align: center; margin: 30px 0;">
      <a href="${actionUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; font-weight: 600; display: inline-block;">${actionText}</a>
    </div>`
        : ''
    }
  </div>
</body>
</html>`;

  const text = `${title}\n\n${body}${actionUrl ? `\n\n${actionText}: ${actionUrl}` : ''}`;

  return sendEmail({
    to,
    subject: title,
    html,
    text,
  });
}
