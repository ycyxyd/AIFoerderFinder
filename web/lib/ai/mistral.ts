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
  /** Fallback model used when the primary is rate-limited / errors (e.g. free-tier 429s). */
  fallbackModel?: string;
  maxTokens?: number;
  temperature?: number;
}

const env = (name: string): string | undefined => process.env[name];

export function getMistralConfig(): MistralConfig {
  return {
    apiKey: env('MISTRAL_API_KEY'),
    baseUrl: env('MISTRAL_BASE_URL') ?? 'https://api.mistral.ai/v1',
    model: env('MISTRAL_MODEL') ?? 'mistral-small-latest',
    fallbackModel: env('MISTRAL_FALLBACK_MODEL'),
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

  const models = [config.model, config.fallbackModel].filter((m): m is string => Boolean(m));
  let lastError: MistralError | null = null;

  for (const model of models) {
    try {
      return await chatCompletionOnce(messages, config, model);
    } catch (err) {
      const m = err instanceof MistralError ? err : new MistralError(String(err));
      lastError = m;
      // Only fall back on rate limits / server errors — NOT on prompt issues.
      if (m.status === undefined || (m.status >= 400 && m.status < 500 && m.status !== 429)) {
        throw m;
      }
    }
  }

  throw lastError ?? new MistralError('No model available');
}

async function chatCompletionOnce(
  messages: ChatMessage[],
  config: MistralConfig,
  model: string
): Promise<string> {
  const authScheme = 'Bearer';
  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `${authScheme} ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
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
    choices?: { message?: { content?: string | null } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new MistralError('Mistral API returned no content');
  }
  return content;
}
