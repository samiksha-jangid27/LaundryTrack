import { OAuth2Client } from 'google-auth-library';
import { HttpError } from './errors.js';

const google = new OAuth2Client();

export async function sendVerificationEmail({ email, code, id }) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
    throw new HttpError(503, 'Email verification is temporarily unavailable. Please try later.');
  let response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `verify-email/${id}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [email],
        subject: `${code} is your LaundryTrack verification code`,
        text: `Your LaundryTrack verification code is ${code}. It expires in 10 minutes. Never share this code. If you did not request it, ignore this email.`,
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new HttpError(503, 'Could not send your verification email. Please try again.');
  }
  if (!response.ok)
    throw new HttpError(503, 'Could not send your verification email. Please try again.');
}

export async function verifyGoogleToken(idToken) {
  if (!process.env.GOOGLE_WEB_CLIENT_ID)
    throw new HttpError(503, 'Google sign-in is temporarily unavailable. Please use email.');
  try {
    const ticket = await google.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_WEB_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified !== true) throw new Error();
    return payload;
  } catch {
    throw new HttpError(401, 'Google could not verify this account. Please sign in again.');
  }
}
