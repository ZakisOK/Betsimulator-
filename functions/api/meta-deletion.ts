interface Env {
  FACEBOOK_APP_SECRET?: string;
}

async function parseSignedRequest(
  signedRequest: string,
  secret: string
): Promise<{ user_id?: string } | null> {
  try {
    const [encodedSig, payload] = signedRequest.split(".");
    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const expectedSig = btoa(String.fromCharCode(...new Uint8Array(sig)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    // Constant-time comparison to prevent timing attacks
    if (expectedSig.length !== encodedSig.length) return null;
    const enc = new TextEncoder();
    const a = enc.encode(expectedSig);
    const b = enc.encode(encodedSig);
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      diff |= a[i] ^ b[i];
    }
    if (diff !== 0) return null;

    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded) as { user_id?: string };
  } catch {
    return null;
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = (await request.json()) as { signed_request?: string };
  if (!body.signed_request)
    return Response.json({ error: "Missing signed_request" }, { status: 400 });

  const secret = env.FACEBOOK_APP_SECRET ?? "";
  const data = await parseSignedRequest(body.signed_request, secret);
  if (!data?.user_id) return Response.json({ error: "Invalid signed request" }, { status: 403 });

  return Response.json({
    url: "https://betbacktest.com/deletion-status",
    confirmation_code: crypto.randomUUID(),
  });
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  return onRequestPost(context);
};
