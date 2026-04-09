import { createClient } from "@supabase/supabase-js";

interface Env {
  VITE_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  LEMONSQUEEZY_WEBHOOK_SECRET: string;
  VITE_LS_PRO_MONTHLY_VARIANT_ID: string;
  VITE_LS_PRO_ANNUAL_VARIANT_ID: string;
  CF_PAGES_URL?: string;
  INTERNAL_WEBHOOK_SECRET?: string;
}

async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison to prevent timing attacks
  if (hex.length !== signature.length) return false;
  const encoder2 = new TextEncoder();
  const a = encoder2.encode(hex);
  const b = encoder2.encode(signature);
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const signature = request.headers.get("x-signature");
  if (!signature) return Response.json({ error: "Missing signature" }, { status: 403 });

  const rawBody = await request.text();
  const valid = await verifySignature(rawBody, signature, env.LEMONSQUEEZY_WEBHOOK_SECRET);
  if (!valid) return Response.json({ error: "Invalid signature" }, { status: 403 });

  const event = request.headers.get("x-event-name") ?? "";
  const payload = JSON.parse(rawBody) as {
    meta?: { custom_data?: { user_id?: string } };
    data?: {
      attributes?: {
        status?: string;
        variant_id?: string;
        customer_id?: string;
        ends_at?: string | null;
        first_subscription_item?: { variant_id?: string };
      };
      id?: string;
    };
  };

  const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const PRO_VARIANTS = new Set([
    env.VITE_LS_PRO_MONTHLY_VARIANT_ID,
    env.VITE_LS_PRO_ANNUAL_VARIANT_ID,
  ]);
  const getTier = (variantId: string): "pro" | "lab" =>
    PRO_VARIANTS.has(variantId) ? "pro" : "lab";

  const userId = payload.meta?.custom_data?.user_id;
  const attributes = payload.data?.attributes;

  try {
    switch (event) {
      case "order_created": {
        if (!userId) break;
        await supabase.from("reports").insert({
          user_id: userId,
          order_id: payload.data?.id ?? "",
          status: "pending",
        });
        const baseUrl = env.CF_PAGES_URL ?? "https://betbacktest.com";
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (env.INTERNAL_WEBHOOK_SECRET) {
          headers["x-internal-secret"] = env.INTERNAL_WEBHOOK_SECRET;
        }
        fetch(`${baseUrl}/api/generate-report`, {
          method: "POST",
          headers,
          body: JSON.stringify({ userId, orderId: payload.data?.id }),
        }).catch(console.error);
        break;
      }

      case "subscription_created": {
        if (!userId || !attributes) break;
        const variantId = String(
          attributes.variant_id ?? attributes.first_subscription_item?.variant_id ?? ""
        );
        await supabase
          .from("profiles")
          .update({
            subscription_tier: getTier(variantId),
            lemon_customer_id: String(attributes.customer_id ?? ""),
            lemon_subscription_id: payload.data?.id ?? "",
            subscription_status: "active",
            subscription_ends_at: null,
          })
          .eq("id", userId);
        break;
      }

      case "subscription_updated": {
        if (!userId || !attributes) break;
        const status = attributes.status;
        const variantId = String(
          attributes.variant_id ?? attributes.first_subscription_item?.variant_id ?? ""
        );
        const updates: Record<string, unknown> = {
          subscription_status: status,
          subscription_tier: getTier(variantId),
        };
        if (status === "cancelled") updates.subscription_ends_at = attributes.ends_at;
        if (status === "expired" || status === "paused") {
          updates.subscription_tier = "free";
          updates.subscription_status = status;
        }
        await supabase.from("profiles").update(updates).eq("id", userId);
        break;
      }

      case "subscription_payment_success": {
        if (!userId) break;
        await supabase.from("profiles").update({ subscription_status: "active" }).eq("id", userId);
        break;
      }

      case "subscription_payment_failed": {
        if (!userId) break;
        await supabase
          .from("profiles")
          .update({ subscription_status: "past_due" })
          .eq("id", userId);
        break;
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  return onRequestPost(context);
};
