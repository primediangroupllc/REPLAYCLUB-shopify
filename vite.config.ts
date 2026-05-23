import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { componentTagger } from "lovable-tagger";
import { visualizer } from "rollup-plugin-visualizer";

type BuildIdOutputOptions = {
  dir?: string | null;
};

// Build identifier — regenerated on every Vite startup (dev) or build (prod).
// Injected into the bundle as `__BUILD_ID__` and written to `/version.json`
// so the running client can detect when a newer version is deployed and
// prompt the user to refresh. Lovable's GitHub-driven rebuild reruns Vite
// on every push, so each deploy gets a fresh ID.
const BUILD_ID = String(Date.now());

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // The bundle visualizer writes dist/stats.html, which (when deployed)
  // exposes the full module map (paths, dep versions, chunk sizes) to
  // anyone visiting the site. Gate it behind an explicit opt-in so it
  // never ships unintentionally:
  //
  //   BUNDLE_STATS=1 npm run build   # writes dist/stats.html locally
  //   npm run build                  # production, no stats.html
  const enableBundleStats =
    process.env.BUNDLE_STATS === "1" && mode !== "production";

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      // Allow tunneled hosts (loca.lt, trycloudflare.com, etc.) so Brian can
      // preview the dev server from his phone or share a link. No effect on
      // production builds.
      allowedHosts: true,
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      enableBundleStats &&
        visualizer({
          filename: "dist/stats.html",
          gzipSize: true,
          brotliSize: true,
          template: "treemap",
        }),
      // Build-id plugin: serves `/version.json` in dev, writes the same
      // file into the build output for prod. Client polls this URL to
      // detect when a fresh build is live.
      {
        name: "build-id",
        configureServer(server: ViteDevServer) {
          server.middlewares.use("/version.json", (_req, res) => {
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.end(JSON.stringify({ buildId: BUILD_ID }));
          });
        },
        writeBundle(options: BuildIdOutputOptions) {
          const outDir = options.dir || "dist";
          const file = resolvePath(outDir, "version.json");
          mkdirSync(dirname(file), { recursive: true });
          writeFileSync(file, JSON.stringify({ buildId: BUILD_ID }));
        },
      } satisfies Plugin,
    ].filter(Boolean),
    define: {
      __BUILD_ID__: JSON.stringify(BUILD_ID),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
