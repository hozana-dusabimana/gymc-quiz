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
 * this logs and resolves so flows are still exercised.
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

export function notifyEmail({ title, message }) {
  return {
    subject: title,
    text: message,
    html: `<div style="font-family:Inter,Arial,sans-serif;max-width:460px;margin:auto">
      <h3 style="color:#0f172a">${title}</h3><p style="color:#334155">${message}</p>
      <p style="color:#94a3b8;font-size:12px">— Gisozi Youth Mass Choir Quiz</p></div>`,
  };
}
