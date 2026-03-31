import { assertEquals, assert } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { handleGenerateImage } from "./index.ts";

type MockCall = { name: string; payload?: unknown };

function createMockCreateClient(calls: MockCall[]) {
  return function createClientFn() {
    return {
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
      },
      from: (table: string) => {
        if (table === "rate_limits") {
          return {
            insert: async () => ({ error: null }),
            select: () => ({
              eq: () => ({
                gte: async () => ({ count: 0, error: null }),
              }),
            }),
          };
        }
        if (table === "credits") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { balance: 50 } }),
              }),
            }),
          };
        }
        if (table === "ai_usage_logs") {
          return {
            insert: async () => ({ error: null }),
          };
        }
        return {};
      },
      rpc: async (name: string, payload: unknown) => {
        calls.push({ name, payload });
        return { error: null };
      },
    };
  };
}

Deno.test("generate-image success: returns images and deducts credits", async () => {
  Deno.env.set("SUPABASE_URL", "https://local.supabase.test");
  Deno.env.set("SUPABASE_ANON_KEY", "anon");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service");
  Deno.env.set("LOVABLE_API_KEY", "lovable");
  Deno.env.set("LEONARDO_API_KEY", "leonardo");
  Deno.env.set("SENTRY_DSN", "");

  const calls: MockCall[] = [];
  const createClientFn = createMockCreateClient(calls);

  let generationCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    if (url.includes("ai.gateway.lovable.dev")) {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  prompt_1: "prompt um",
                  prompt_2: "prompt dois",
                  negative_prompt: "neg",
                }),
              },
            },
          ],
        }),
        { status: 200 }
      );
    }
    if (url.endsWith("/generations") && init?.method === "POST") {
      generationCount += 1;
      return new Response(
        JSON.stringify({ sdGenerationJob: { generationId: `gen-${generationCount}` } }),
        { status: 200 }
      );
    }
    if (url.includes("/generations/")) {
      const genId = url.split("/").pop();
      return new Response(
        JSON.stringify({
          generations_by_pk: {
            status: "COMPLETE",
            generated_images: [{ url: `https://img.test/${genId}.png` }],
          },
        }),
        { status: 200 }
      );
    }
    return new Response("not found", { status: 404 });
  };

  const req = new Request("https://local.test/generate-image", {
    method: "POST",
    headers: { Authorization: "Bearer token" },
    body: JSON.stringify({ prompt: "Uma imagem", quality: "fast", format: "square" }),
  });

  const res = await handleGenerateImage(req, { createClientFn });
  const body = await res.json();

  assertEquals(res.status, 200);
  assertEquals(Array.isArray(body.images), true);
  assertEquals(body.images.length, 2);
  assert(calls.some((c) => c.name === "deduct_credits"));

  globalThis.fetch = originalFetch;
});

Deno.test("generate-image error: rate limited on Leonardo", async () => {
  Deno.env.set("SUPABASE_URL", "https://local.supabase.test");
  Deno.env.set("SUPABASE_ANON_KEY", "anon");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service");
  Deno.env.set("LOVABLE_API_KEY", "lovable");
  Deno.env.set("LEONARDO_API_KEY", "leonardo");
  Deno.env.set("SENTRY_DSN", "");

  const createClientFn = createMockCreateClient([]);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    if (url.includes("ai.gateway.lovable.dev")) {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  prompt_1: "prompt um",
                  prompt_2: "prompt dois",
                  negative_prompt: "neg",
                }),
              },
            },
          ],
        }),
        { status: 200 }
      );
    }
    if (url.endsWith("/generations") && init?.method === "POST") {
      return new Response("rate limited", { status: 429 });
    }
    return new Response("not found", { status: 404 });
  };

  const req = new Request("https://local.test/generate-image", {
    method: "POST",
    headers: { Authorization: "Bearer token" },
    body: JSON.stringify({ prompt: "Uma imagem", quality: "fast", format: "square" }),
  });

  const res = await handleGenerateImage(req, { createClientFn });
  const body = await res.json();

  assertEquals(res.status, 429);
  assertEquals(body.error, "rate_limited");

  globalThis.fetch = originalFetch;
});
