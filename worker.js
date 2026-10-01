// Cloudflare Worker: receives the name from the demo page and posts it to a Teams channel.
// The Teams webhook URL lives here as a secret, so it never appears in the public page.
//
// Settings (Worker > Settings > Variables and Secrets):
//   TEAMS_WEBHOOK_URL  (Secret)  the "Post to a channel when a webhook request is received" URL
//   ALLOWED_ORIGIN     (Text)    your site origin, e.g. https://yourname.github.io
//                                several allowed, separated by commas

const MAX_NAME = 60;

function clean(text) {
  // keep it to plain text: drop control characters and Markdown/HTML that Teams would render
  return String(text)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[<>\[\]()*_`~|\\]/g, "")
    .replace(/:\/\//g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME);
}

function buildCard(name) {
  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        contentUrl: null,
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            {
              type: "TextBlock",
              text: "New interest: AI Agents web search demo",
              weight: "Bolder",
              size: "Medium",
              wrap: true,
            },
            {
              type: "FactSet",
              facts: [
                { title: "Name", value: name },
                { title: "Response", value: "Yes, I will get involved" },
                { title: "Received", value: new Date().toUTCString() },
              ],
            },
          ],
        },
      },
    ],
  };
}

export default {
  async fetch(request, env) {
    const allowed = (env.ALLOWED_ORIGIN || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const origin = request.headers.get("Origin") || "";
    const originOk = allowed.includes(origin);

    const cors = {
      "Access-Control-Allow-Origin": originOk ? origin : allowed[0] || "",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      Vary: "Origin",
    };
    const reply = (status, body) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json" },
      });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return reply(405, { ok: false, error: "method" });
    if (!originOk) return reply(403, { ok: false, error: "origin" });
    if (!env.TEAMS_WEBHOOK_URL) return reply(500, { ok: false, error: "not configured" });

    let data;
    try {
      const raw = await request.text();
      if (raw.length > 2000) return reply(413, { ok: false, error: "too large" });
      data = JSON.parse(raw);
    } catch {
      return reply(400, { ok: false, error: "bad json" });
    }

    const name = clean(data && data.name ? data.name : "");
    if (!name) return reply(400, { ok: false, error: "name required" });

    let res;
    try {
      res = await fetch(env.TEAMS_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildCard(name)),
      });
    } catch {
      return reply(502, { ok: false, error: "teams unreachable" });
    }
    if (!res.ok) return reply(502, { ok: false, error: "teams rejected" });
    return reply(200, { ok: true });
  },
};
