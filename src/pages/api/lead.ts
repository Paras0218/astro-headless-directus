import type { APIRoute } from 'astro';
import { sendLeadNotification, sendLeadAutoReply } from '../../lib/mailer';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const payload = await request.json();
    const { name, email, website, message } = payload;

    if (!name || !email) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    const directusRes = await fetch(`${import.meta.env.DIRECTUS_URL}/items/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.DIRECTUS_STATIC_TOKEN}`
      },
      body: JSON.stringify({ name, email, website, message }),
    });

    if (!directusRes.ok) {
      const errText = await directusRes.text();
      return new Response(JSON.stringify({ error: 'Database insertion failed', details: errText }), { status: 500 });
    }

    // Lead is safely stored. Fire two best-effort emails — a mail failure must
    // never break lead capture, the visitor's success response, or each other.
    try {
      await sendLeadNotification({ name, email, website, message });
    } catch (mailErr: any) {
      console.error('[lead] notification email failed:', mailErr?.message ?? mailErr);
    }
    try {
      await sendLeadAutoReply({ name, email, website, message });
    } catch (mailErr: any) {
      console.error('[lead] auto-reply email failed:', mailErr?.message ?? mailErr);
    }

    return new Response(JSON.stringify({ success: true, message: 'Lead recorded successfully' }), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), { status: 500 });
  }
};
