import type { Network } from "@/lib/networks";
import type { PublishPayload, PublishResult } from "@/lib/agents/schemas";

export interface ValidationIssue {
  field: string;
  message: string;
}

export interface PublishOptions {
  /** En Dry Run no se envía nada: solo se valida y se registra el payload. */
  dryRun: boolean;
  /** Token descifrado; solo el conector lo recibe, nunca los agentes. */
  accessToken?: string;
}

export interface MetricsResult {
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
}

/**
 * Contrato de conector social. En la fase 1 todas las implementaciones son
 * simuladas: no existen endpoints reales.
 */
export interface SocialConnector {
  readonly network: Network;
  readonly simulated: boolean;
  validate(payload: PublishPayload): ValidationIssue[];
  publish(payload: PublishPayload, options: PublishOptions): Promise<PublishResult>;
  fetchMetrics(externalId: string): Promise<MetricsResult>;
}
