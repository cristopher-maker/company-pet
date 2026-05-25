// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MERCADOPAGO_API_BASE = 'https://api.mercadopago.com';

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const mercadoPagoAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
  const webhookSecret = Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET');

  if (!supabaseUrl || !serviceRoleKey || !mercadoPagoAccessToken) {
    return jsonResponse({ error: 'Function secrets are missing.' }, 500);
  }

  const url = new URL(request.url);
  const body = await request.json().catch(() => ({}));
  const paymentId = String(url.searchParams.get('data.id') || body?.data?.id || body?.id || '');
  const eventType = String(body?.type || body?.topic || url.searchParams.get('type') || '');

  if (webhookSecret && !await isValidWebhookSignature(request, url, webhookSecret, paymentId)) {
    return jsonResponse({ error: 'Invalid webhook signature.' }, 401);
  }

  if (!paymentId || eventType !== 'payment') {
    return jsonResponse({ ok: true, ignored: true });
  }

  const paymentResponse = await fetch(`${MERCADOPAGO_API_BASE}/v1/payments/${paymentId}`, {
    headers: {
      Authorization: `Bearer ${mercadoPagoAccessToken}`,
      'Content-Type': 'application/json',
    },
  });

  const payment = await paymentResponse.json().catch(() => null);
  if (!paymentResponse.ok || !payment) {
    return jsonResponse({ error: 'Could not fetch Mercado Pago payment.', detail: payment }, 502);
  }

  const subscriptionId = String(payment.external_reference || payment.metadata?.subscription_id || '');
  if (!subscriptionId) {
    return jsonResponse({ ok: true, ignored: true, reason: 'Missing external_reference.' });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: subscription, error: subscriptionError } = await supabaseAdmin
    .from('company_subscriptions')
    .select('id,company_id,plan_tier,contract_id')
    .eq('id', subscriptionId)
    .maybeSingle();

  if (subscriptionError || !subscription) {
    return jsonResponse({ ok: true, ignored: true, reason: 'Subscription not found.' });
  }

  const status = mapPaymentStatus(payment.status);
  const paidAt = payment.date_approved || payment.money_release_date || null;
  const amount = Number(payment.transaction_amount || payment.transaction_details?.total_paid_amount || 0);
  const currency = String(payment.currency_id || 'CLP').toUpperCase();

  const { data: invoice } = await supabaseAdmin
    .from('company_invoices')
    .upsert(
      {
        company_id: subscription.company_id,
        subscription_id: subscription.id,
        provider: 'mercadopago',
        external_invoice_id: String(payment.order?.id || payment.id),
        external_reference: subscription.id,
        invoice_number: String(payment.order?.id || payment.id),
        status: status === 'approved' ? 'paid' : status === 'failed' ? 'open' : 'open',
        amount_due: amount,
        amount_paid: status === 'approved' ? amount : 0,
        currency,
        paid_at: status === 'approved' ? paidAt : null,
        metadata: { payment },
      },
      { onConflict: 'provider,external_invoice_id' }
    )
    .select('id')
    .maybeSingle();

  await supabaseAdmin.from('company_payments').upsert(
    {
      company_id: subscription.company_id,
      subscription_id: subscription.id,
      invoice_id: invoice?.id ?? null,
      provider: 'mercadopago',
      external_payment_id: String(payment.id),
      external_reference: subscription.id,
      status,
      amount,
      currency,
      payment_method: payment.payment_method_id || payment.payment_type_id || null,
      paid_at: status === 'approved' ? paidAt : null,
      raw_payload: payment,
    },
    { onConflict: 'provider,external_payment_id' }
  );

  if (status === 'approved') {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await supabaseAdmin
      .from('company_subscriptions')
      .update({
        status: 'active',
        activated_at: paidAt || now.toISOString(),
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        payment_url: null,
      })
      .eq('id', subscription.id);

    await supabaseAdmin
      .from('companies')
      .update({
        plan_tier: subscription.plan_tier,
        operational_status: 'active',
      })
      .eq('id', subscription.company_id);
  } else if (status === 'failed') {
    await supabaseAdmin
      .from('company_subscriptions')
      .update({ status: 'past_due' })
      .eq('id', subscription.id);
  }

  return jsonResponse({ ok: true });
});

async function isValidWebhookSignature(
  request: Request,
  url: URL,
  secret: string,
  paymentId: string
): Promise<boolean> {
  const xSignature = request.headers.get('x-signature') || '';
  const xRequestId = request.headers.get('x-request-id') || '';
  const parts = xSignature.split(',');
  const ts = parts.find((part) => part.trim().startsWith('ts='))?.split('=')[1]?.trim();
  const hash = parts.find((part) => part.trim().startsWith('v1='))?.split('=')[1]?.trim();
  if (!ts || !hash || !xRequestId) return false;

  const dataId = (url.searchParams.get('data.id') || paymentId || '').toLowerCase();
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest));
  const hex = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return hex === hash;
}

function mapPaymentStatus(status: string): 'pending' | 'approved' | 'failed' | 'refunded' | 'cancelled' {
  if (status === 'approved' || status === 'accredited') return 'approved';
  if (status === 'refunded' || status === 'charged_back') return 'refunded';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'rejected') return 'failed';
  return 'pending';
}

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
