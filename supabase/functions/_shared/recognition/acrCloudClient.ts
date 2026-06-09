// ACRCloud File Scanning client. GATED — only ever invoked behind
// acrCloudConfigured(); no request is made without config/secrets. Network code
// lives here so the poller/trigger stay thin. Unit-tested with a MOCKED fetch
// (no real API, no secrets, no billing).
//
// ⚠️ Endpoint paths + response shape are from RECOGNITION-SPEC §1 + ACRCloud
// docs — reconcile against a REAL response when the container exists. Parsing is
// defensive (file-id + state extracted from a few likely locations).

import { type AcrCloudConfig, getAcrCloudConfig } from "./acrCloudConfig.ts";

const baseUrl = (region: string) => `https://api-${region}.acrcloud.com`;

// Convenience for callers that haven't already gated.
export function requireAcrConfig(): AcrCloudConfig {
  const cfg = getAcrCloudConfig();
  if (!cfg) throw new Error("ACRCloud not configured");
  return cfg;
}

export interface SubmitResult {
  fileId: string;
}

// Submit a signed audio URL for File Scanning — ACRCloud pulls + scans it (async).
export async function submitFileScan(
  cfg: AcrCloudConfig,
  input: { url: string; name: string },
): Promise<SubmitResult> {
  const res = await fetch(
    `${baseUrl(cfg.region)}/api/fs-containers/${cfg.containerId}/files`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        data_type: "audio_url",
        url: input.url,
        name: input.name,
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`ACRCloud submit failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  const fileId = String(json?.data?.id ?? json?.id ?? "");
  if (!fileId) throw new Error("ACRCloud submit: no file id in response");
  return { fileId };
}

export interface FileScanState {
  state: number; // 0 processing · 1 ready · -1 no result · -2/-3 error
  raw: unknown; // full payload → fed to recognitionNormalize when state === 1
}

export async function getFileScanResult(
  cfg: AcrCloudConfig,
  fileId: string,
): Promise<FileScanState> {
  const res = await fetch(
    `${baseUrl(cfg.region)}/api/fs-containers/${cfg.containerId}/files/${fileId}?with_result=1`,
    { headers: { Authorization: `Bearer ${cfg.token}`, Accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`ACRCloud getResults failed: ${res.status}`);
  const json = await res.json();
  const state = Number(
    json?.data?.[0]?.state ?? json?.data?.state ?? json?.state ?? 0,
  );
  return { state, raw: json };
}
