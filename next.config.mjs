function parseOrigin(value) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("/")) return null;

  try {
    return new URL(trimmed).origin;
  } catch {
    try {
      const protocol = /^(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(trimmed)
        ? "http://"
        : "https://";
      return new URL(`${protocol}${trimmed}`).origin;
    } catch {
      return null;
    }
  }
}

const isProd = process.env.NODE_ENV === "production";
const connectSrcValues = new Set(["'self'"]);
if (!isProd) {
  connectSrcValues.add("ws:");
}

[
  process.env.BACKEND_URL,
  process.env.API_URL,
  process.env.NEXT_PUBLIC_BACKEND_URL,
  process.env.NEXT_PUBLIC_API_URL,
  process.env.NEXT_PUBLIC_API_BASE_URL,
]
  .map(parseOrigin)
  .filter(Boolean)
  .forEach((origin) => connectSrcValues.add(origin));

const scriptSrc = ["'self'", "'unsafe-inline'"];
if (!isProd) {
  scriptSrc.push("'unsafe-eval'");
}

const cspDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "form-action 'self'",
  `script-src ${scriptSrc.join(" ")}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src ${Array.from(connectSrcValues).join(" ")}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
];

if (isProd) {
  cspDirectives.push("upgrade-insecure-requests");
}

const contentSecurityPolicy = cspDirectives.join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  poweredByHeader: false,
  images: {
    unoptimized: false,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-origin",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "off",
          },
          ...(isProd
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
