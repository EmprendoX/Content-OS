import { createHash } from "node:crypto";
import { NETWORK_SPECS, NETWORKS, type Network } from "@/lib/networks";
import type { PublishPayload, PublishResult } from "@/lib/agents/schemas";
import type { MetricsResult, PublishOptions, SocialConnector, ValidationIssue } from "./connector";

/**
 * Conectores simulados. No llaman a ninguna API: validan el payload según las
 * restricciones de cada red y devuelven una respuesta ficticia y trazable.
 */
class MockSocialConnector implements SocialConnector {
  readonly simulated = true;

  constructor(readonly network: Network) {}

  validate(payload: PublishPayload): ValidationIssue[] {
    const spec = NETWORK_SPECS[this.network];
    const issues: ValidationIssue[] = [];
    if (!payload.text.trim()) issues.push({ field: "text", message: "El texto está vacío." });

    if (this.network === "x") {
      // En X cada post del hilo debe respetar el límite.
      const posts = payload.text.split(/\n\s*\n/);
      posts.forEach((post, i) => {
        if (post.length > spec.maxChars) {
          issues.push({ field: "text", message: `El post ${i + 1} del hilo supera ${spec.maxChars} caracteres.` });
        }
      });
    } else if (payload.text.length > spec.maxChars) {
      issues.push({ field: "text", message: `El texto supera ${spec.maxChars} caracteres.` });
    }

    if ((this.network === "instagram" || this.network === "youtube") && !payload.mediaPath) {
      issues.push({ field: "mediaPath", message: `${spec.label} requiere un archivo visual.` });
    }
    return issues;
  }

  async publish(payload: PublishPayload, options: PublishOptions): Promise<PublishResult> {
    const issues = this.validate(payload);
    if (issues.length > 0) {
      return {
        ok: false,
        dryRun: options.dryRun,
        externalId: null,
        url: null,
        publishedAt: null,
        error: issues.map((i) => `${i.field}: ${i.message}`).join(" | "),
        raw: { simulated: true, issues },
      };
    }

    const externalId = `mock_${this.network}_${createHash("sha1")
      .update(`${payload.variantId}:${payload.text}`)
      .digest("hex")
      .slice(0, 10)}`;
    const publishedAt = new Date().toISOString();

    if (options.dryRun) {
      return {
        ok: true,
        dryRun: true,
        externalId: null,
        url: null,
        publishedAt: null,
        error: null,
        raw: { simulated: true, mode: "dry_run", wouldSend: { chars: payload.text.length, hashtags: payload.hashtags.length } },
      };
    }

    return {
      ok: true,
      dryRun: false,
      externalId,
      url: `https://${this.network}.example.local/${externalId}`,
      publishedAt,
      error: null,
      raw: { simulated: true, mode: "simulated_publish", tokenPresent: Boolean(options.accessToken) },
    };
  }

  async fetchMetrics(externalId: string): Promise<MetricsResult> {
    // Métricas deterministas a partir del id para que la demo sea estable.
    const seed = parseInt(createHash("md5").update(externalId).digest("hex").slice(0, 6), 16);
    const base = 400 + (seed % 3000);
    return {
      impressions: base,
      reach: Math.round(base * 0.72),
      likes: Math.round(base * 0.045),
      comments: Math.round(base * 0.006),
      shares: Math.round(base * 0.004),
      saves: Math.round(base * 0.01),
      clicks: Math.round(base * 0.015),
    };
  }
}

export const InstagramConnector = new MockSocialConnector("instagram");
export const FacebookConnector = new MockSocialConnector("facebook");
export const LinkedInConnector = new MockSocialConnector("linkedin");
export const XConnector = new MockSocialConnector("x");
export const YouTubeConnector = new MockSocialConnector("youtube");

const registry: Record<Network, SocialConnector> = {
  instagram: InstagramConnector,
  facebook: FacebookConnector,
  linkedin: LinkedInConnector,
  x: XConnector,
  youtube: YouTubeConnector,
};

export function getConnector(network: Network): SocialConnector {
  return registry[network];
}

export function listConnectors(): SocialConnector[] {
  return NETWORKS.map((n) => registry[n]);
}
