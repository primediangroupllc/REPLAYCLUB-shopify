// ACRCloud File Scanning config gate — mirrors _shared/shopify-admin.ts's
// shopifyConfigured(). The recognition pipeline is a NO-OP until these secrets
// exist (set later in Brian's terminal). No ACRCloud call is ever attempted
// while unconfigured. Pure except for reading Deno.env — no network.

export interface AcrCloudConfig {
  token: string;
  containerId: string;
  region: string;
}

export function acrCloudConfigured(): boolean {
  return Boolean(
    Deno.env.get("ACRCLOUD_CONSOLE_API_TOKEN") &&
      Deno.env.get("ACRCLOUD_FS_CONTAINER_ID") &&
      Deno.env.get("ACRCLOUD_FS_REGION"),
  );
}

export function getAcrCloudConfig(): AcrCloudConfig | null {
  if (!acrCloudConfigured()) return null;
  return {
    token: Deno.env.get("ACRCLOUD_CONSOLE_API_TOKEN")!,
    containerId: Deno.env.get("ACRCLOUD_FS_CONTAINER_ID")!,
    region: Deno.env.get("ACRCLOUD_FS_REGION")!,
  };
}
