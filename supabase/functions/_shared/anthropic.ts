import Anthropic from 'npm:@anthropic-ai/sdk@0.98.0';

const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
if (!apiKey) {
  throw new Error('ANTHROPIC_API_KEY is not set (supabase secrets set ANTHROPIC_API_KEY=...)');
}

const anthropic = new Anthropic({ apiKey });

// Model is configurable via the CADDIE_LLM_MODEL edge secret, so you can run a
// cheaper model during testing without touching code or redeploying:
//   npx supabase secrets set CADDIE_LLM_MODEL=claude-haiku-4-5   (or claude-sonnet-4-6)
// Unset it (or set claude-opus-4-7) to return to the most capable model.
const DEFAULT_MODEL = Deno.env.get('CADDIE_LLM_MODEL') ?? 'claude-opus-4-7';

// Generic system prompt — does NOT mention the `respond` tool. In schema mode
// the `tool_choice: {type:'tool', name:'respond'}` forces tool use, so we don't
// need to tell the model about it. In text mode (no schema), mentioning a tool
// here would cause the model to hallucinate tool-use XML wrappers around its
// plain-text answer ("<respond>{...}</respond>"). Keep this short and generic.
const DEFAULT_SYSTEM = 'You are Caddie AI, an expert golf coach. Be direct and specific.';

interface InvokeLLMArgs {
  prompt: string;
  /** When provided, the model is forced to return JSON matching this schema. */
  response_json_schema?: Record<string, unknown>;
  system?: string;
  model?: string;
  maxTokens?: number;
}

/**
 * Drop-in replacement for Base44's `integrations.Core.InvokeLLM`.
 *
 * - With `response_json_schema`: forces a single `respond` tool whose
 *   input_schema IS that schema, and returns the parsed structured object.
 *   (Tool use handles the arbitrary Base44 schemas more reliably than
 *   output_config.format, which requires additionalProperties:false everywhere.)
 * - Without a schema: returns the model's plain text.
 *
 * Caching note: the stable system prompt + tool definition carry a
 * cache_control breakpoint so this is cache-ready, but it only actually caches
 * once that prefix exceeds the model's ~4096-token minimum. Today the prompts
 * are per-user-unique and the prefix is tiny, so caching is effectively a no-op.
 */
export async function invokeLLM(args: InvokeLLMArgs): Promise<unknown> {
  const {
    prompt,
    response_json_schema,
    system = DEFAULT_SYSTEM,
    model = DEFAULT_MODEL,
    maxTokens = 16000,
  } = args;

  const base = {
    model,
    max_tokens: maxTokens,
    // Tools render before system; the breakpoint on the last system block
    // caches tools+system together (when the prefix is large enough).
    system: [
      { type: 'text' as const, text: system, cache_control: { type: 'ephemeral' as const } },
    ],
    messages: [{ role: 'user' as const, content: prompt }],
  };

  if (response_json_schema) {
    const response = await anthropic.messages.create({
      ...base,
      // deno-lint-ignore no-explicit-any
      tools: [{
        name: 'respond',
        description: 'Return the response as structured data conforming to the schema.',
        input_schema: response_json_schema as any,
      }],
      tool_choice: { type: 'tool', name: 'respond' },
    });
    const block = response.content.find((b) => b.type === 'tool_use');
    if (!block || block.type !== 'tool_use') {
      throw new Error('Anthropic response did not contain structured tool output');
    }
    return block.input;
  }

  const response = await anthropic.messages.create(base);
  return response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { text: string }).text)
    .join('');
}
