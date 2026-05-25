// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ROLE_LABELS: Record<string, string> = {
  employee: 'Empleado',
  hr_admin: 'RR.HH.',
  manager: 'Manager',
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
    const appBaseUrl = (Deno.env.get('APP_BASE_URL') || '').replace(/\/$/, '');

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Supabase function secrets are missing.' }, 500);
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
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const role = typeof body?.role === 'string' ? body.role : 'employee';

    if (!companyId) return jsonResponse({ error: 'companyId is required.' }, 400);
    if (!email || !email.includes('@')) return jsonResponse({ error: 'Valid email is required.' }, 400);
    if (!ROLE_LABELS[role]) return jsonResponse({ error: 'Invalid invitation role.' }, 400);

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const { data: membership } = await supabaseAdmin
      .from('company_members')
      .select('member_role')
      .eq('company_id', companyId)
      .eq('user_id', user.id)
      .maybeSingle();

    const canInvite =
      profile?.role === 'admin' ||
      profile?.role === 'company_admin' ||
      profile?.role === 'pet_expert' ||
      membership?.member_role === 'company_admin' ||
      membership?.member_role === 'hr_admin' ||
      membership?.member_role === 'manager';

    if (!canInvite) {
      return jsonResponse({ error: 'Forbidden.' }, 403);
    }

    const { data: existingPending } = await supabaseAdmin
      .from('company_invitations')
      .select('id')
      .eq('company_id', companyId)
      .ilike('email', email)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingPending) {
      return jsonResponse({ error: 'Ya existe una invitacion pendiente para este correo.' }, 409);
    }

    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from('company_invitations')
      .insert({
        company_id: companyId,
        email,
        role,
        invited_by: user.id,
      })
      .select('id, email, role, status, token, expires_at')
      .single();

    if (invitationError || !invitation) {
      return jsonResponse({ error: invitationError?.message || 'Could not create invitation.' }, 400);
    }

    const inviteOptions: any = {
      data: {
        company_id: companyId,
        member_role: role,
        company_invitation_id: invitation.id,
      },
    };

    if (appBaseUrl) {
      inviteOptions.redirectTo = `${appBaseUrl}/auth/login`;
    }

    const { error: authInviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, inviteOptions);

    if (authInviteError) {
      await supabaseAdmin.from('company_invitations').update({ status: 'expired' }).eq('id', invitation.id);
      return jsonResponse({ error: authInviteError.message }, 400);
    }

    return jsonResponse({ invitation });
  } catch (error) {
    return jsonResponse({ error: error?.message || 'Unexpected error.' }, 500);
  }
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
