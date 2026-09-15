import nodemailer from 'nodemailer';
import { env, emailConfigured } from '../config/env.js';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!emailConfigured()) return null;
  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: { user: env.smtp.user, pass: env.smtp.pass },
  });
  return transporter;
}

/**
 * Send an email. In dev/test without SMTP configured (or when sending fails),
 * this logs and resolves so flows are still exercised — the OTP is also
 * returned to the caller of the auth service when OTP_DEBUG_LOG is on.
 */
export async function sendMail({ to, subject, text, html }) {
  const tx = getTransporter();
  if (!tx) {
    if (!env.isTest) {
      // eslint-disable-next-line no-console
      console.log(`[email:stub] to=${to} subject="${subject}"\n${text || ''}`);
    }
    return { stubbed: true };
  }
  try {
    const info = await tx.sendMail({ from: env.smtp.from, to, subject, text, html });
    return { messageId: info.messageId };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[email] send failed:', err.message);
    return { error: err.message };
  }
}

export function otpEmail({ code, name, purpose }) {
  const action = purpose === 'login' ? 'sign in to' : 'verify your email for';
  return {
    subject: `${code} is your GYMC Quiz verification code`,
    text: `Hi ${name || 'there'},

Use this code to ${action} Gisozi Youth Mass Choir Quiz:

    ${code}

It expires in ${env.otp.ttlMinutes} minutes. If you didn't request this, you can ignore this email.

— Gisozi Youth Mass Choir Quiz`,
    html: `<div style="font-family:Inter,Arial,sans-serif;max-width:460px;margin:auto">
      <h2 style="color:#1d4ed8;margin-bottom:4px">Gisozi Youth Mass Choir Quiz</h2>
      <p style="color:#334155">Hi ${name || 'there'}, use this code to ${action} Gisozi Youth Mass Choir Quiz:</p>
      <p style="font-size:30px;letter-spacing:6px;font-weight:800;color:#0f172a;background:#f1f5f9;padding:14px 0;text-align:center;border-radius:12px">${code}</p>
      <p style="color:#64748b;font-size:13px">It expires in ${env.otp.ttlMinutes} minutes. If you didn't request this, ignore this email.</p>
    </div>`,
  };
}

export function notifyEmail({ title, message }) {
  return {
    subject: title,
    text: message,
    html: `<div style="font-family:Inter,Arial,sans-serif;max-width:460px;margin:auto">
      <h3 style="color:#0f172a">${title}</h3><p style="color:#334155">${message}</p>
      <p style="color:#94a3b8;font-size:12px">— Gisozi Youth Mass Choir Quiz</p></div>`,
  };
}
