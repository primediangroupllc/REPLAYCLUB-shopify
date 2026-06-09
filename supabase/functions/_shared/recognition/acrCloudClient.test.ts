// Mocked-fetch tests for the ACRCloud client — locks the request/response shape
// WITHOUT any real API call, secrets, or billing.
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getFileScanResult, submitFileScan } from "./acrCloudClient.ts";

const CFG = { token: "tok_123", containerId: "cont_9", region: "us-west-2" };

Deno.test("submitFileScan: posts data_type=audio_url with bearer, parses file id", async () => {
  let captured: { url: string; init: RequestInit } | null = null;
  const orig = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    captured = { url: String(input), init: init ?? {} };
    return Promise.resolve(
      new Response(JSON.stringify({ data: { id: "file_42" } }), { status: 200 }),
    );
  }) as typeof fetch;
  try {
    const out = await submitFileScan(CFG, { url: "https://signed/mix.mp3", name: "My Mix" });
    assertEquals(out.fileId, "file_42");
    assertEquals(
      captured!.url,
      "https://api-us-west-2.acrcloud.com/api/fs-containers/cont_9/files",
    );
    assertEquals(captured!.init.method, "POST");
    assertEquals(
      (captured!.init.headers as Record<string, string>).Authorization,
      "Bearer tok_123",
    );
    const body = JSON.parse(String(captured!.init.body));
    assertEquals(body.data_type, "audio_url");
    assertEquals(body.url, "https://signed/mix.mp3");
    assertEquals(body.name, "My Mix");
  } finally {
    globalThis.fetch = orig;
  }
});

Deno.test("getFileScanResult: builds ?with_result=1 URL + extracts state", async () => {
  let capturedUrl = "";
  const orig = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request) => {
    capturedUrl = String(input);
    return Promise.resolve(
      new Response(JSON.stringify({ data: [{ state: 1, results: { music: [] } }] }), { status: 200 }),
    );
  }) as typeof fetch;
  try {
    const out = await getFileScanResult(CFG, "file_42");
    assertEquals(out.state, 1);
    assertEquals(
      capturedUrl,
      "https://api-us-west-2.acrcloud.com/api/fs-containers/cont_9/files/file_42?with_result=1",
    );
    assert(out.raw != null);
  } finally {
    globalThis.fetch = orig;
  }
});

Deno.test("submitFileScan: throws on non-2xx", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = (() =>
    Promise.resolve(new Response("nope", { status: 401 }))) as typeof fetch;
  try {
    let threw = false;
    try {
      await submitFileScan(CFG, { url: "u", name: "n" });
    } catch {
      threw = true;
    }
    assert(threw);
  } finally {
    globalThis.fetch = orig;
  }
});
