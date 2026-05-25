// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MERCADOPAGO_API_BASE = 'https://api.mercadopago.com';

type CompanyRow = {
  id: string;
  name: string;
  billing_email: string | null;
  plan_tier: string | null;
};

type ContractRow = {
  id: string;
  plan_tier: string;
  amount: number | null;
  currency: string | null;
  billing_cycle: string | null;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed.' }, 405);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const mercadoPagoAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    const appBaseUrl = Deno.env.get('APP_BASE_URL') || '';

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Supabase function secrets are missing.' }, 500);
    }

    if (!mercadoPagoAccessToken) {
      return jsonResponse({ error: 'Missing MERCADOPAGO_ACCESS_TOKEN.' }, 500);
    }

    const authHeader = request.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!jwt) {
      return jsonResponse({ error: 'Missing authorization token.' }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(jwt);

    if (userError || !user) {
      return jsonResponse({ error: 'Unauthorized user.' }, 401);
    }

    const body = await request.json().catch(() => null);
    const companyId = typeof body?.companyId === 'string' ? body.companyId : '';
    if (!companyId) {
      return jsonResponse({ error: 'companyId is required.' }, 400);
    }

    const { data: membership } = await supabaseAdmin
      .from('company_members')
      .select('member_role')
      .eq('company_id', companyId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership || !['hr_admin', 'manager'].includes(membership.member_role)) {
      return jsonResponse({ error: 'Forbidden.' }, 403);
    }

    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('id,name,billing_email,plan_tier')
      .eq('id', companyId)
      .maybeSingle();

    const typedCompany = company as CompanyRow | null;
    if (companyError || !typedCompany) {
      return jsonResponse({ error: 'Company not found.' }, 404);
    }

    const { data: activeContract } = await supabaseAdmin
      .from('company_contracts')
      .select('id,plan_tier,amount,currency,billing_cycle')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .maybeSingle();

    const typedContract = activeContract as ContractRow | null;
    const requestedPlanTier = normalizePlanTier(body?.planTier);
    const planTier = normalizePlanTier(requestedPlanTier || typedContract?.plan_tier || typedCompany.plan_tier);
    const matchingContract = typedContract?.plan_tier === planTier ? typedContract : null;
    const amount = normalizeAmount(matchingContract?.amount ?? body?.amount, planTier);
    const currency = String(matchingContract?.currency || body?.currency || 'CLP').toUpperCase();
    const title = `Company Pet - ${planLabel(planTier)}`;

    const { data: existingSubscription } = await supabaseAdmin
      .from('company_subscriptions')
      .select('id,status,payment_url,external_subscription_id')
      .eq('company_id', companyId)
      .eq('plan_tier', planTier)
      .in('status', ['pending', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let subscriptionId = existingSubscription?.id as string | undefined;

    if (!subscriptionId) {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('company_subscriptions')
        .insert({
          company_id: companyId,
          contract_id: matchingContract?.id ?? null,
          provider: 'mercadopago',
          plan_tier: planTier,
          status: 'pending',
          external_reference: null,
          created_by: user.id,
        })
        .select('id')
        .single();

      if (insertError || !inserted?.id) {
        return jsonResponse({ error: insertError?.message || 'Could not create subscription.' }, 500);
      }

      subscriptionId = inserted.id as string;
    }

    const origin = appBaseUrl || request.headers.get('origin') || '';
    const notificationUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;

    const preferenceBody = {
      items: [
        {
          id: planTier,
          title,
          quantity: 1,
          currency_id: currency,
          unit_price: amount,
        },
      ],
      payer: {
        email: typedCompany.billing_email || user.email || undefined,
      },
      external_reference: subscriptionId,
      notification_url: notificationUrl,
      ...(origin
        ? {
            back_urls: {
              success: `${origin}/#/company?payment=success`,
              failure: `${origin}/#/company?payment=failure`,
              pending: `${origin}/#/company?payment=pending`,
            },
            auto_return: 'approved',
          }
        : {}),
      metadata: {
        company_id: companyId,
        subscription_id: subscriptionId,
        plan_tier: planTier,
      },
    };

    const preferenceResponse = await fetch(`${MERCADOPAGO_API_BASE}/checkout/preferences`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mercadoPagoAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preferenceBody),
    });

    const preferencePayload = await preferenceResponse.json().catch(() => null);
    if (!preferenceResponse.ok) {
      console.error('Mercado Pago preference creation failed', preferencePayload);
      return jsonResponse(
        {
          error: 'Mercado Pago preference creation failed.',
          detail: preferencePayload,
        },
        502
      );
    }

    const paymentUrl = preferencePayload?.init_point || preferencePayload?.sandbox_init_point || null;
    const preferenceId = preferencePayload?.id || null;

    const { error: updateError } = await supabaseAdmin
      .from('company_subscriptions')
      .update({
        provider: 'mercadopago',
        external_subscription_id: preferenceId,
        external_reference: subscriptionId,
        plan_tier: planTier,
        payment_url: paymentUrl,
        status: 'pending',
        metadata: {
          preference: preferencePayload,
        },
      })
      .eq('id', subscriptionId);

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500);
    }

    return jsonResponse({
      subscriptionId,
      preferenceId,
      paymentUrl,
    });
  } catch (error) {
    console.error('Unhandled preference error', error);
    return jsonResponse(
      {
        error: 'Unhandled preference error.',
        detail: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

function normalizePlanTier(value: unknown): 'empresa' | 'premium' {
  return value === 'premium' ? 'premium' : 'empresa';
}

function normalizeAmount(value: unknown, planTier: 'empresa' | 'premium'): number {
  const amount = Number(value);
  if (Number.isFinite(amount) && amount > 0) return Math.round(amount);
  return planTier === 'premium' ? 499000 : 199000;
}

function planLabel(planTier: 'empresa' | 'premium'): string {
  return planTier === 'premium' ? 'Acompanamiento' : 'Plataforma';
}

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
