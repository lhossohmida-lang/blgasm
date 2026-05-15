/* Vercel serverless function — يحوّل طلبات الواجهة إلى OpenRouter بمفتاح سرّي */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "*").split(",").map((s) => s.trim());

function setCors(req, res) {
  const origin = req.headers.origin || "";
  const allow = ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(origin) ? (origin || "*") : ALLOWED_ORIGINS[0];
  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

async function callOpenRouter({ apiKey, body, origin, signal }) {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": origin || "https://blgasm.local",
      "X-Title": "Blgasm Store Assistant",
    },
    body: JSON.stringify(body),
    signal,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { status: res.status, ok: res.ok, data };
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "Server misconfigured: OPENROUTER_API_KEY environment variable is not set on Vercel.",
    });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const { model, messages, tools, tool_choice, temperature } = body;

  if (!model || !Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: "Missing required fields: model, messages" });
  }

  const origin = req.headers.origin || req.headers.referer || "";

  /* المحاولة الأولى: مع الأدوات إذا أُرسلت */
  const primaryBody = { model, messages, temperature: temperature ?? 0.2 };
  if (tools && tools.length) {
    primaryBody.tools = tools;
    primaryBody.tool_choice = tool_choice || "auto";
  }

  let result = await callOpenRouter({ apiKey, body: primaryBody, origin });

  /* إذا فشل بسبب عدم دعم الأدوات → أعِد المحاولة بدونها وأبلغ الواجهة */
  const errMsg = String(result.data?.error?.message || result.data?.error || "").toLowerCase();
  const isToolError = !result.ok && (errMsg.includes("tool_choice") || errMsg.includes("tools"));
  if (isToolError && tools && tools.length) {
    const fallbackBody = { model, messages, temperature: temperature ?? 0.2 };
    const retry = await callOpenRouter({ apiKey, body: fallbackBody, origin });
    return res.status(retry.status).json({ ...retry.data, _fallback: "no_tools" });
  }

  return res.status(result.status).json(result.data);
}
