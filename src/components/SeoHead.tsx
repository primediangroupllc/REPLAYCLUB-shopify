import { Helmet } from "react-helmet-async";

const DEFAULT_IMAGE =
  "https://storage.googleapis.com/gpt-engineer-file-uploads/GbEulQM8OzSeZbUIWGdRsN0Y2si1/social-images/social-1774136317931-F005324E-2D74-4D33-A0AC-E72D77632242-Photoroom.webp";
const SITE_URL = "https://replayclub.io";

type SeoHeadProps = {
  title: string;
  description: string;
  /** Path-only (e.g. "/dj-studio"). Defaults to current pathname at runtime. */
  path?: string;
  image?: string;
  type?: "website" | "article" | "product";
  /** Optional JSON-LD payload, stringified inline. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

/**
 * Per-route head tags: title, description, canonical, OpenGraph, Twitter,
 * and optional JSON-LD. Client-rendered via react-helmet-async — Google
 * executes JS so it sees these; iMessage/Slack will fall back to the
 * defaults already baked into index.html.
 */
const SeoHead = ({
  title,
  description,
  path,
  image = DEFAULT_IMAGE,
  type = "website",
  jsonLd,
}: SeoHeadProps) => {
  const resolvedPath =
    path ?? (typeof window !== "undefined" ? window.location.pathname : "/");
  const url = `${SITE_URL}${resolvedPath}`;
  const ldArray = jsonLd
    ? Array.isArray(jsonLd)
      ? jsonLd
      : [jsonLd]
    : [];

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content="Replay Club" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {ldArray.map((ld, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(ld)}
        </script>
      ))}
    </Helmet>
  );
};

export default SeoHead;