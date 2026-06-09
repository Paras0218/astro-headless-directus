import nodemailer from 'nodemailer';

export interface LeadEmail {
  name: string;
  email: string;
  website?: string;
  message?: string;
}

const BRAND = 'Thrive Agency';

let cached: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter(): ReturnType<typeof nodemailer.createTransport> | null {
  if (cached) return cached;
  const host = import.meta.env.SMTP_HOST;
  const user = import.meta.env.SMTP_USER;
  const pass = import.meta.env.SMTP_PASS;
  const port = Number(import.meta.env.SMTP_PORT ?? '587');
  if (!host || !user || !pass) return null;
  cached = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = implicit TLS, 587 = STARTTLS
    requireTLS: port === 587,
    auth: { user, pass },
  });
  return cached;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Notification email to the site owner whenever a new lead arrives.
export async function sendLeadNotification(lead: LeadEmail): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('[mailer] SMTP not configured — skipping lead notification email.');
    return;
  }

  const to = import.meta.env.LEAD_NOTIFY_TO || import.meta.env.SMTP_FROM || import.meta.env.SMTP_USER;
  const from = import.meta.env.SMTP_FROM || import.meta.env.SMTP_USER;

  const website = lead.website && lead.website.trim() ? lead.website : '—';
  const message = lead.message && lead.message.trim() ? lead.message : '—';

  const text = [
    'New lead submitted from the website:',
    '',
    `Name:    ${lead.name}`,
    `Email:   ${lead.email}`,
    `Website: ${website}`,
    `Message: ${message}`,
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color:#0f172a;">
      <h2 style="margin-bottom:16px;">🚀 New Lead Received</h2>
      <table style="width:100%; border-collapse:collapse; font-size:14px;">
        <tr><td style="padding:8px; font-weight:bold; width:110px;">Name</td><td style="padding:8px;">${escapeHtml(lead.name)}</td></tr>
        <tr style="background:#f8fafc;"><td style="padding:8px; font-weight:bold;">Email</td><td style="padding:8px;"><a href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a></td></tr>
        <tr><td style="padding:8px; font-weight:bold;">Website</td><td style="padding:8px;">${escapeHtml(website)}</td></tr>
        <tr style="background:#f8fafc;"><td style="padding:8px; font-weight:bold; vertical-align:top;">Message</td><td style="padding:8px; white-space:pre-line;">${escapeHtml(message)}</td></tr>
      </table>
      <p style="color:#64748b; font-size:12px; margin-top:16px;">Sent automatically by your Astro + Directus site.</p>
    </div>`;

  const info = await transporter.sendMail({
    from: `"New Lead — ${BRAND}" <${from}>`,
    to,
    replyTo: lead.email,
    subject: `New Lead: ${lead.name}`,
    text,
    html,
  });
  console.log(`[mailer] notification → accepted=${JSON.stringify(info.accepted)} response="${info.response}"`);
}

// Friendly confirmation / auto-reply sent to the lead who submitted the form.
export async function sendLeadAutoReply(lead: LeadEmail): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('[mailer] SMTP not configured — skipping auto-reply email.');
    return;
  }
  if (!lead.email) return;

  const from = import.meta.env.SMTP_FROM || import.meta.env.SMTP_USER;
  const firstName = (lead.name || 'there').trim().split(/\s+/)[0];

  const text = [
    `Hi ${firstName},`,
    '',
    `Thank you for reaching out to ${BRAND}! We've successfully received your request, and it's already on our radar.`,
    '',
    'One of our growth experts will personally review your details and connect with you shortly — typically within one business day.',
    '',
    'In the meantime, feel free to reply to this email with anything else you’d like us to know.',
    '',
    `Talk soon,`,
    `The ${BRAND} Team`,
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color:#0f172a; line-height:1.6;">
      <div style="background:linear-gradient(135deg,#ea580c,#c2410c); color:#fff; padding:28px 24px; border-radius:14px 14px 0 0;">
        <h1 style="margin:0; font-size:22px;">Thanks, ${escapeHtml(firstName)}! 🎉</h1>
        <p style="margin:8px 0 0; opacity:.92;">We've received your request.</p>
      </div>
      <div style="border:1px solid #f1f5f9; border-top:none; padding:24px; border-radius:0 0 14px 14px;">
        <p>Thank you for reaching out to <strong>${BRAND}</strong>! Your request is already on our radar.</p>
        <p>One of our growth experts will personally review your details and <strong>connect with you shortly</strong> — typically within one business day.</p>
        <p>In the meantime, just reply to this email with anything else you'd like us to know.</p>
        <p style="margin-top:24px;">Talk soon,<br/><strong>The ${BRAND} Team</strong></p>
      </div>
      <p style="color:#94a3b8; font-size:12px; text-align:center; margin-top:16px;">This is an automated confirmation — a real human will follow up.</p>
    </div>`;

  const info = await transporter.sendMail({
    from: `"${BRAND}" <${from}>`,
    to: lead.email,
    replyTo: from,
    subject: `Thanks ${firstName} — we've received your request`,
    text,
    html,
  });
  console.log(`[mailer] auto-reply → accepted=${JSON.stringify(info.accepted)} response="${info.response}"`);
}
