export type Tier = 'HOT' | 'WARM' | 'COLD' | 'MANUAL';

export interface RoutingResult {
  tier: Tier;
  actions: string[];
}

export interface RouterInput {
  composite: number;
  confidence: number;
  inference_failed?: boolean;
}

export function router(input: RouterInput): RoutingResult {
  // MANUAL override for exhausted inference repair
  if (input.inference_failed) {
    return { tier: 'MANUAL', actions: ['dlq', 'alert'] };
  }

  if (input.composite >= 70 && input.confidence >= 0.6) {
    return { tier: 'HOT', actions: ['chat', 'crm'] };
  }

  if (input.composite >= 40) {
    return { tier: 'WARM', actions: ['sheet'] };
  }

  return { tier: 'COLD', actions: ['log'] };
}
