// Standalone SMTP diagnostic — reads the real .env, verifies auth, sends a test
// mail, and prints Gmail's actual SMTP responses (accepted/rejected/response).
import fs from 'node:fs';
import nodemailer from 'nodemailer';

const env = {};
for (const line of fs.readFileSync('E:/Thrive-astro/Astro-headless/.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && !line.trim().startsWith('#')) env[m[1]] = m[2];
}

const port = Number(env.SMTP_PORT || '587');
console.log(`host=${env.SMTP_HOST} port=${port} user=${env.SMTP_USER} passLen=${(env.SMTP_PASS || '').length}`);

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port,
  secure: port === 465,
  requireTLS: port === 587,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  logger: true,
  debug: true,
});

try {
  await transporter.verify();
  console.log('VERIFY: OK — connection + auth succeeded');
} catch (e) {
  console.error('VERIFY FAILED:', e.code, '-', e.message);
  process.exit(1);
}

try {
  const info = await transporter.sendMail({
    from: `"Lead Notifier" <${env.SMTP_FROM}>`,
    to: env.LEAD_NOTIFY_TO,
    subject: 'Directus lead notifier — diagnostic test',
    text: 'If you can read this, SMTP delivery is working.',
  });
  console.log('SEND messageId:', info.messageId);
  console.log('SEND response :', info.response);
  console.log('SEND accepted :', JSON.stringify(info.accepted));
  console.log('SEND rejected :', JSON.stringify(info.rejected));
} catch (e) {
  console.error('SEND FAILED:', e.code, '-', e.message);
  process.exit(1);
}
