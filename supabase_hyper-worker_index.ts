// Supabase Edge Function: hyper-worker
// Save as: supabase/functions/hyper-worker/index.ts
//
// Provides:
// - action=login {username,password} -> {ok,token,role,username,exp}
// - action=save  {token,catalogue}   -> {ok}
//
// SECURITY NOTES:
// - Set ADMIN_USER / ADMIN_PASS as secrets (do NOT hardcode).
// - Password is checked against the secret. Change it from the default ASAP.
// - JWT is signed with JWT_SECRET secret (set via `supabase secrets set`).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, x-client-info, apikey, content-type" },
  });
}

function b64url(input: string) {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmacSha256(key: string, msg: string) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(msg));
  const bytes = Array.from(new Uint8Array(sig));
  const bin = String.fromCharCode(...bytes);
  return b64url(bin);
}

async function signJWT(payload: Record<string, unknown>, secret: string, expSeconds: number) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + expSeconds };

  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(fullPayload));
  const toSign = `${h}.${p}`;
  const s = await hmacSha256(secret, toSign);
  return { token: `${toSign}.${s}`, exp: fullPayload.exp as number };
}

async function verifyJWT(token: string, secret: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false as const, error: "Bad token" };
  const [h, p, s] = parts;
  const toSign = `${h}.${p}`;
  const expected = await hmacSha256(secret, toSign);
  if (expected !== s) return { ok: false as const, error: "Invalid signature" };
  const payload = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) return { ok: false as const, error: "Expired" };
  return { ok: true as const, payload };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return jsonResponse({ ok: true }, 200);

  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }

  const action = body?.action;

  const adminUser = Deno.env.get("ADMIN_USER") ?? "omaggi";
  const adminPass = Deno.env.get("ADMIN_PASS") ?? "mixmax1";
  const jwtSecret = Deno.env.get("JWT_SECRET");
  if (!jwtSecret) return jsonResponse({ ok: false, error: "Missing JWT_SECRET" }, 500);

  // Use service role to bypass RLS safely inside the function
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  if (action === "login") {
    const u = String(body?.username || "").trim();
    const p = String(body?.password || "").trim();

    if (u !== adminUser || p !== adminPass) {
      return jsonResponse({ ok: false, error: "Invalid credentials" }, 401);
    }

    const { token, exp } = await signJWT({ role: "admin", username: u }, jwtSecret, 60 * 60 * 12); // 12h
    return jsonResponse({ ok: true, token, role: "admin", username: u, exp });
  }

  if (action === "save") {
    const token = String(body?.token || "");
    const cat = body?.catalogue;

    const ver = await verifyJWT(token, jwtSecret);
    if (!ver.ok) return jsonResponse({ ok: false, error: ver.error }, 401);
    if (ver.payload.role !== "admin") return jsonResponse({ ok: false, error: "Not allowed" }, 403);

    // upsert into catalogue table
    const { error } = await sb
      .from("catalogue")
      .upsert({ id: "main", data: cat }, { onConflict: "id" });

    if (error) return jsonResponse({ ok: false, error: error.message }, 500);
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ ok: false, error: "Unknown action" }, 400);
});
