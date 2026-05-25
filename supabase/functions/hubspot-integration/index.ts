declare const Deno: {
  env: { get: (name: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type LeadStatus = "nuevo" | "contactado" | "evaluacion" | "match" | "cerrado" | "perdido";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HUBSPOT_API_BASE = "https://api.hubapi.com";

// El nombre interno de la propiedad personalizada que creaste en HubSpot.
const TENANT_PROPERTY_NAME = "id_empresa_cliente_company_care";

function jsonResponse(body: unknown, status = 200): Response {
  // Evitar que supabase-js oculte el error original. 
  // Transformamos los errores 400+ en 200 OK para que el frontend pueda leer el JSON con el error.
  if (status >= 400 && typeof body === 'object' && body !== null) {
    status = 200;
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: CORS_HEADERS,
  });
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  if (num < min) return min;
  if (num > max) return max;
  return Math.floor(num);
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function statusFromStageLabel(label: string): LeadStatus {
  const normalized = normalizeText(label);
  if (normalized.includes("perd")) return "perdido";
  if (normalized.includes("closed lost")) return "perdido";
  if (normalized.includes("cerrad") || normalized.includes("ganad") || normalized.includes("won")) return "cerrado";
  if (normalized.includes("match") || normalized.includes("propuest") || normalized.includes("proposal")) return "match";
  if (normalized.includes("evalu") || normalized.includes("assessment")) return "evaluacion";
  if (normalized.includes("contact")) return "contactado";
  return "nuevo";
}

async function hubspotRequest(
  token: string,
  path: string,
  init: RequestInit = {}
): Promise<{ status: number; data: any }> {
  const response = await fetch(`${HUBSPOT_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const responseText = await response.text();
  let data;
  try {
    // La mayoría de las respuestas de HubSpot, incluidos los errores, son JSON
    data = JSON.parse(responseText);
  } catch (e) {
    // Fallback para respuestas que no son JSON (ej. errores de texto plano)
    data = { message: responseText || `HubSpot devolvió el estado ${response.status} con un cuerpo vacío.` };
  }

  // Convertir el formato de error de HubSpot al formato que espera Supabase JS ({ error: '...' })
  if (!response.ok) {
    console.error("HubSpot Error Response:", JSON.stringify(data, null, 2));
    if (data && !data.error) {
      const errMsg =
        (Array.isArray(data.errors) && data.errors[0]?.message) || data.message || `Error HTTP ${response.status} desde HubSpot.`;
      data.error = `HubSpot API: ${errMsg}`;
    }
  }

  return { status: response.status, data };
}

function parseExistingContactId(errorMessage: unknown): string | null {
  if (typeof errorMessage !== 'string') return null;
  const match = errorMessage.match(/Contact already exists\. Existing ID: (\d+)/);
  return match ? match[1] : null;
}

async function updateContact(
  hubspotToken: string,
  contactId: string,
  properties: Record<string, unknown>
): Promise<{ status: number; data: any }> {
  return hubspotRequest(hubspotToken, `/crm/v3/objects/contacts/${contactId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties }),
  });
}

async function createContact(
  hubspotToken: string,
  payload: { email?: string; firstname?: string; lastname?: string; companyId?: string }
): Promise<Response> {
  const { email, firstname, lastname, companyId } = payload;
  if (!email?.trim()) {
    return jsonResponse({ error: "email is required" }, 400);
  }
  // Es crucial para la arquitectura multi-tenant.
  if (!companyId) {
    return jsonResponse({ error: "companyId is required to create a contact" }, 400);
  }

  const properties = {
    email: email.trim(),
    firstname: firstname?.trim() || "",
    lastname: lastname?.trim() || "",
    [TENANT_PROPERTY_NAME]: companyId,
  };

  const result = await hubspotRequest(hubspotToken, "/crm/v3/objects/contacts", {
    method: "POST",
    body: JSON.stringify({ properties }),
  });

  if (result.status >= 400) {
    const existingContactId = parseExistingContactId(result.data?.error);
    if (existingContactId) {
      const updateResult = await updateContact(hubspotToken, existingContactId, properties);
      return jsonResponse(updateResult.data, updateResult.status);
    }
  }

  return jsonResponse(result.data, result.status);
}

async function createDeal(
  hubspotToken: string,
  payload: {
    companyId?: string;
    dealname?: string;
    amount?: number | null;
    comuna?: string;
    dependency?: string;
    care_profile?: string;
    employee_id?: string;
    pipelineId?: string;
  }
): Promise<Response> {
  const { companyId, dealname, amount, comuna, dependency, care_profile, employee_id, pipelineId } = payload;

  if (!companyId) {
    return jsonResponse({ error: "companyId is required to create a deal" }, 400);
  }

  let targetPipelineId = pipelineId;
  let targetStageId = "";

  if (!targetPipelineId) {
    const pipelinesRes = await hubspotRequest(hubspotToken, "/crm/v3/pipelines/deals");
    if (pipelinesRes.status < 400) {
      const pipelines = Array.isArray(pipelinesRes.data?.results) ? pipelinesRes.data.results : [];
      const selectedPipeline =
        pipelines.find((p: any) => normalizeText(`${p.label ?? ""}`).includes("company care")) ??
        pipelines[0];
      
      if (selectedPipeline) {
        targetPipelineId = selectedPipeline.id;
        const stages = selectedPipeline.stages ?? [];
        targetStageId = stages[0]?.id ?? "";
      }
    }
  }

  const properties: any = {
    dealname: dealname?.trim() || "Nueva Solicitud de Cuidado",
    [TENANT_PROPERTY_NAME]: companyId,
  };

  if (targetPipelineId) properties.pipeline = targetPipelineId;
  if (targetStageId) properties.dealstage = targetStageId;
  if (amount !== undefined && amount !== null) properties.amount = String(amount);
  if (comuna) properties.comuna = comuna;
  if (dependency) properties.dependency = dependency;
  if (care_profile) properties.care_profile = care_profile;
  if (employee_id) properties.employee_id = employee_id;

  const result = await hubspotRequest(hubspotToken, "/crm/v3/objects/deals", {
    method: "POST",
    body: JSON.stringify({ properties }),
  });

  return jsonResponse(result.data, result.status);
}

async function listPipelineSummary(
  hubspotToken: string,
  payload: { rangeDays?: number; limit?: number; pipelineId?: string; companyId?: string }
): Promise<Response> {
  const rangeDays = clampNumber(payload.rangeDays, 1, 365, 30);
  const limit = clampNumber(payload.limit, 1, 100, 25);
  const companyId = payload.companyId;

  if (!companyId) {
    return jsonResponse({ error: "companyId is required to list pipeline summary" }, 400);
  }

  const pipelinesRes = await hubspotRequest(hubspotToken, "/crm/v3/pipelines/deals");
  if (pipelinesRes.status >= 400) {
    return jsonResponse(pipelinesRes.data, pipelinesRes.status);
  }

  const pipelines = Array.isArray(pipelinesRes.data?.results) ? pipelinesRes.data.results : [];
  const selectedPipeline =
    pipelines.find((pipeline: any) => pipeline.id === payload.pipelineId) ??
    pipelines.find((pipeline: any) => normalizeText(`${pipeline.label ?? ""}`).includes("company care")) ??
    pipelines[0];

  if (!selectedPipeline) {
    return jsonResponse({
      pipeline: null,
      leadStatusMetrics: { nuevo: 0, contactado: 0, evaluacion: 0, match: 0, cerrado: 0, perdido: 0 },
      leadSnapshots: [],
    });
  }

  const stageLabelById = new Map<string, string>();
  for (const stage of selectedPipeline.stages ?? []) {
    stageLabelById.set(String(stage.id), String(stage.label ?? stage.id ?? ""));
  }

  const startDate = Date.now() - rangeDays * 24 * 60 * 60 * 1000;
  const dealsSearchRes = await hubspotRequest(hubspotToken, "/crm/v3/objects/deals/search", {
    method: "POST",
    body: JSON.stringify({
      filterGroups: [
        {
          filters: [
            { propertyName: "pipeline", operator: "EQ", value: selectedPipeline.id },
            { propertyName: "createdate", operator: "GTE", value: String(startDate) },
            // separar datos de cada empresa cliente.
            { propertyName: TENANT_PROPERTY_NAME, operator: "EQ", value: companyId },
          ],
        },
      ],
      sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
      properties: [
        "dealname",
        "dealstage",
        "createdate",
        "hs_lastmodifieddate",
        "amount",
        "comuna",
        "dependency",
        "budget",
        "care_profile",
        "employee_id",
      ],
      limit,
    }),
  });

  if (dealsSearchRes.status >= 400) {
    return jsonResponse(dealsSearchRes.data, dealsSearchRes.status);
  }

  const leadStatusMetrics: Record<LeadStatus, number> = {
    nuevo: 0,
    contactado: 0,
    evaluacion: 0,
    match: 0,
    cerrado: 0,
    perdido: 0,
  };

  const leadSnapshots = ((dealsSearchRes.data?.results as any[]) ?? []).map((deal) => {
    const properties = deal.properties ?? {};
    const stageId = String(properties.dealstage ?? "");
    const stageLabel = stageLabelById.get(stageId) ?? stageId;
    const status = statusFromStageLabel(stageLabel);
    leadStatusMetrics[status] += 1;

    const amountValue = Number(properties.amount ?? properties.budget ?? null);
    const parsedBudget = Number.isFinite(amountValue) ? amountValue : null;

    return {
      id: String(deal.id ?? "").slice(0, 8),
      name: String(properties.dealname ?? "Lead sin nombre"),
      phone: null,
      comuna: properties.comuna ?? null,
      dependency: properties.dependency ?? null,
      budget: parsedBudget,
      careProfile: properties.care_profile ?? null,
      employeeId: properties.employee_id ?? null,
      status,
      createdAt: properties.createdate ?? null,
      lastInteractionAt: properties.hs_lastmodifieddate ?? null,
      lastInteractionType: "nota",
    };
  });

  return jsonResponse({
    pipeline: { id: selectedPipeline.id, label: selectedPipeline.label ?? selectedPipeline.id },
    leadStatusMetrics,
    leadSnapshots,
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const hubspotToken = Deno.env.get("HUBSPOT_ACCESS_TOKEN");
  if (!hubspotToken) {
    return jsonResponse({ error: "Missing HUBSPOT_ACCESS_TOKEN" }, 500);
  }

  const body = await req.json().catch(() => ({}));
  const action = body?.action;

  if (!action) {
    return jsonResponse({ error: "Missing 'action' field in request body" }, 400);
  }

  if (action === "create_contact") {
    return createContact(hubspotToken, body);
  }

  if (action === "create_deal") {
    return createDeal(hubspotToken, body);
  }

  if (action === "list_pipeline_summary") {
    return listPipelineSummary(hubspotToken, body);
  }

  return jsonResponse({ error: `Unsupported action: ${action}` }, 400);
});
