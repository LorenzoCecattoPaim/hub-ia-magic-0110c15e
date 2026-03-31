import { assertEquals, assert } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { handleAiChat } from "./index.ts";

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
                maybeSingle: async () => ({ data: { balance: 10 } }),
              }),
            }),
          };
        }
        if (table === "business_profiles") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    nome_empresa: "Empresa Teste",
                    nicho: "Varejo",
                    tom_comunicacao: "informal",
                    publico_alvo: "Clientes",
                  },
                }),
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

Deno.test("ai-chat success: returns response and deducts credits", async () => {
  Deno.env.set("SUPABASE_URL", "https://local.supabase.test");
  Deno.env.set("SUPABASE_ANON_KEY", "anon");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service");
  Deno.env.set("LOVABLE_API_KEY", "lovable");
  Deno.env.set("SENTRY_DSN", "");

  const calls: MockCall[] = [];
  const createClientFn = createMockCreateClient(calls);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: "Resposta da IA" } }],
        usage: { total_tokens: 500 },
      }),
      { status: 200 }
    );

  const req = new Request("https://local.test/ai-chat", {
    method: "POST",
    headers: { Authorization: "Bearer token" },
    body: JSON.stringify({ message: "Crie um post" }),
  });

  const res = await handleAiChat(req, { createClientFn });
  const body = await res.json();

  assertEquals(res.status, 200);
  assertEquals(body.response, "Resposta da IA");
  assertEquals(body.credits_used >= 1, true);
  assert(calls.some((c) => c.name === "deduct_credits"));

  globalThis.fetch = originalFetch;
});

Deno.test("ai-chat error: empty response triggers error", async () => {
  Deno.env.set("SUPABASE_URL", "https://local.supabase.test");
  Deno.env.set("SUPABASE_ANON_KEY", "anon");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service");
  Deno.env.set("LOVABLE_API_KEY", "lovable");
  Deno.env.set("SENTRY_DSN", "");

  const createClientFn = createMockCreateClient([]);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: "" } }],
        usage: { total_tokens: 0 },
      }),
      { status: 200 }
    );

  const req = new Request("https://local.test/ai-chat", {
    method: "POST",
    headers: { Authorization: "Bearer token" },
    body: JSON.stringify({ message: "Teste" }),
  });

  const res = await handleAiChat(req, { createClientFn });
  const body = await res.json();

  assertEquals(res.status, 502);
  assertEquals(body.error, "empty_response");

  globalThis.fetch = originalFetch;
});
