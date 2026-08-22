// ============================================================================
// Minimal Mistral API client — one prompt, one call, no agent, no chains.
// Overridable base URL (for gateways / self-hosted OpenAI-compatible endpoints).
// ============================================================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface MistralConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

const env = (name: string): string | undefined => process.env[name];

export function getMistralConfig(): MistralConfig {
  return {
    apiKey: env('MISTRAL_API_KEY'),
    baseUrl: env('MISTRAL_BASE_URL') ?? 'https://api.mistral.ai/v1',
    model: env('MISTRAL_MODEL') ?? 'mistral-small-latest',
    maxTokens: Number(env('MISTRAL_MAX_TOKENS') ?? 800),
    temperature: 0.2, // low = stable, factual tone
  };
}

/** True when the env is configured for real LLM calls. */
export function hasMistralKey(): boolean {
  return Boolean(env('MISTRAL_API_KEY'));
}

export class MistralError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'MistralError';
  }
}

export async function chatCompletion(
  messages: ChatMessage[],
  config: MistralConfig = getMistralConfig()
): Promise<string> {
  if (!config.apiKey) {
    throw new MistralError('MISTRAL_API_KEY is not configured');
  }

  const authScheme = 'Bearer';
  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `${authScheme} ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new MistralError(`Mistral API error: ${res.status} ${await res.text()}`, res.status);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new MistralError('Mistral API returned no content');
  }
  return content;
}
