// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type AppointmentRecord = {
  id: string;
  employee_id: string;
  expert_id: string | null;
  kind: 'Videollamada' | 'Llamada';
  meeting_provider: string | null;
  meeting_url: string | null;
};

type GoogleTokenResponse = {
  access_token: string;
};

type GoogleMeetSpaceResponse = {
  name?: string;
  meetingUri?: string;
  meetingCode?: string;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const googleClientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
  const googleClientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');
  const googleRefreshToken = Deno.env.get('GOOGLE_OAUTH_REFRESH_TOKEN');

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse({ error: 'Supabase function secrets are missing.' }, 500);
  }

  if (!googleClientId || !googleClientSecret || !googleRefreshToken) {
    return jsonResponse(
      {
        error:
          'Google OAuth credentials are missing. Configure GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET and GOOGLE_OAUTH_REFRESH_TOKEN.',
      },
      500
    );
  }

  const authHeader = request.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) {
    return jsonResponse({ error: 'Missing authorization token.' }, 401);
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
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
  const appointmentId = typeof body?.appointmentId === 'string' ? body.appointmentId : '';
  if (!appointmentId) {
    return jsonResponse({ error: 'appointmentId is required.' }, 400);
  }

  const { data: appointment, error: appointmentError } = await supabaseAdmin
    .from('appointments')
    .select('id, employee_id, expert_id, kind, meeting_provider, meeting_url')
    .eq('id', appointmentId)
    .maybeSingle();

  const typedAppointment = appointment as AppointmentRecord | null;

  if (appointmentError || !typedAppointment) {
    return jsonResponse({ error: 'Appointment not found.' }, 404);
  }

  if (typedAppointment.kind !== 'Videollamada') {
    return jsonResponse({ error: 'Only Videollamada appointments can generate Google Meet links.' }, 400);
  }

  const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).maybeSingle();

  const typedProfile = profile as { role: string | null } | null;

  const canManageAppointment =
    typedAppointment.employee_id === user.id ||
    typedAppointment.expert_id === user.id ||
    typedProfile?.role === 'pet_expert' ||
    typedProfile?.role === 'admin';

  if (!canManageAppointment) {
    return jsonResponse({ error: 'Forbidden.' }, 403);
  }

  if (typedAppointment.meeting_provider === 'google_meet' && typedAppointment.meeting_url) {
    return jsonResponse({
      meetingProvider: 'google_meet',
      meetingUrl: typedAppointment.meeting_url,
    });
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: googleClientId,
      client_secret: googleClientSecret,
      refresh_token: googleRefreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!tokenResponse.ok) {
    const tokenError = await tokenResponse.text();
    return jsonResponse({ error: `Google OAuth token exchange failed: ${tokenError}` }, 502);
  }

  const tokenPayload = (await tokenResponse.json()) as GoogleTokenResponse;
  if (!tokenPayload.access_token) {
    return jsonResponse({ error: 'Google OAuth token exchange did not return an access token.' }, 502);
  }

  const meetResponse = await fetch('https://meet.googleapis.com/v2/spaces', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenPayload.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      config: {
        accessType: 'OPEN',
        entryPointAccess: 'ALL',
      },
    }),
  });

  if (!meetResponse.ok) {
    const meetError = await meetResponse.text();
    return jsonResponse({ error: `Google Meet space creation failed: ${meetError}` }, 502);
  }

  const meetPayload = (await meetResponse.json()) as GoogleMeetSpaceResponse;
  if (!meetPayload.meetingUri) {
    return jsonResponse({ error: 'Google Meet did not return a meeting URL.' }, 502);
  }

  const updatePayload = {
    meeting_provider: 'google_meet',
    meeting_url: meetPayload.meetingUri,
    meeting_code: meetPayload.meetingCode ?? null,
    meeting_space_name: meetPayload.name ?? null,
  };

  const { error: updateError } = await supabaseAdmin
    .from('appointments')
    .update(updatePayload)
    .eq('id', typedAppointment.id);

  if (updateError) {
    return jsonResponse({ error: 'Google Meet space was created but the appointment could not be updated.' }, 500);
  }

  return jsonResponse({
    meetingProvider: updatePayload.meeting_provider,
    meetingUrl: updatePayload.meeting_url,
    meetingCode: updatePayload.meeting_code,
    meetingSpaceName: updatePayload.meeting_space_name,
  });
});

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
