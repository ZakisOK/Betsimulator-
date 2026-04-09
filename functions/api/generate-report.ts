import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

interface Env {
  VITE_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ANTHROPIC_API_KEY: string;
  INTERNAL_WEBHOOK_SECRET?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Authenticate: require either a Bearer JWT or an internal webhook secret
  const authHeader = request.headers.get("authorization");
  const internalSecret = request.headers.get("x-internal-secret");

  const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  let authenticatedUserId: string | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) return Response.json({ error: "Invalid token" }, { status: 401 });
    authenticatedUserId = user.id;
  } else if (
    internalSecret &&
    env.INTERNAL_WEBHOOK_SECRET &&
    internalSecret === env.INTERNAL_WEBHOOK_SECRET
  ) {
    // Called internally from webhook handler
  } else {
    return Response.json({ error: "Missing authorization" }, { status: 401 });
  }

  const body = (await request.json()) as {
    userId: string;
    strategyConfig?: unknown;
    metrics?: unknown;
    orderId: string;
  };

  const { userId, strategyConfig, metrics, orderId } = body;
  if (!userId || !orderId)
    return Response.json({ error: "Missing required fields" }, { status: 400 });

  // If authenticated via JWT, ensure the user can only generate their own reports
  if (authenticatedUserId && authenticatedUserId !== userId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  await supabase
    .from("reports")
    .update({ status: "generating" })
    .eq("user_id", userId)
    .eq("order_id", orderId);

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: `You are a quantitative analyst specializing in baccarat betting systems.
Generate a structured deep analysis report (3,000-4,000 tokens) in HTML format.

Include these sections:
1. Executive Summary
2. Strategy Overview and Rule Analysis
3. Full EV Breakdown Per Rule
4. Progression Failure Probability Tables
5. Monte Carlo Confidence Intervals (interpret the simulation results)
6. Risk Assessment (drawdown analysis, risk of ruin interpretation)
7. Five Specific Parameter Recommendations (numbered, actionable)
8. Conclusion

Use proper HTML with h2, h3, p, table, ul tags. Be honest about house edge math.`,
      messages: [
        {
          role: "user",
          content: `Generate a deep analysis report for this baccarat strategy.

Strategy Config: ${JSON.stringify(strategyConfig ?? {})}
Backtest Metrics: ${JSON.stringify(metrics ?? {})}

Generate the full HTML report now.`,
        },
      ],
    });

    const content = response.content[0];
    const htmlContent = content.type === "text" ? content.text : "<p>Analysis unavailable.</p>";

    const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>BetBacktest Deep Analysis Report</title>
<style>
  body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.6; }
  h1 { color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 10px; }
  h2 { color: #2c5282; margin-top: 30px; }
  h3 { color: #2d3748; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
  th { background: #edf2f7; font-weight: 600; }
  .disclaimer { background: #fff3cd; border: 1px solid #ffc107; padding: 12px; border-radius: 6px; font-size: 0.9em; }
</style>
</head>
<body>
<h1>BetBacktest Deep Analysis Report</h1>
<p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
<div class="disclaimer">
  <strong>Disclaimer:</strong> This report is a mathematical research tool. No betting system eliminates the house edge.
  Banker EV = -1.06%, Player EV = -1.24%, Tie EV = -14.36%. Past simulation results do not predict future outcomes.
</div>
${htmlContent}
</body>
</html>`;

    const reportId = crypto.randomUUID();
    const path = `${userId}/${reportId}.html`;
    await supabase.storage.from("reports").upload(path, fullHtml, { contentType: "text/html" });

    await supabase
      .from("reports")
      .update({ status: "ready", pdf_path: path })
      .eq("user_id", userId)
      .eq("order_id", orderId);

    return Response.json({ ok: true, reportId });
  } catch (err) {
    console.error("Report generation error:", err);
    await supabase
      .from("reports")
      .update({ status: "failed" })
      .eq("user_id", userId)
      .eq("order_id", orderId);
    return Response.json({ error: "Report generation failed" }, { status: 500 });
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  return onRequestPost(context);
};
