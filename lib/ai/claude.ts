import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * LLM provider seam. 현재 구현은 Anthropic Claude.
 * - 대량 초안/채점: claude-haiku-4-5 (effort/adaptive-thinking 미지원 → 평범 호출)
 * - 고품질 검수/재작성: claude-opus-4-8 (thinking:adaptive + output_config.effort, stream)
 * provider 교체 시 이 인터페이스만 다시 구현하면 된다.
 */

export const MODEL_DRAFT = "claude-haiku-4-5";
export const MODEL_REVIEW = "claude-opus-4-8";

export interface LLMProvider {
  completeJSON<T>(a: {
    model: string;
    system: string;
    user: string;
    schema: object;
    maxTokens?: number;
  }): Promise<T>;
  completeText(a: {
    model: string;
    system: string;
    user: string;
    maxTokens?: number;
    effort?: "low" | "medium" | "high" | "xhigh" | "max";
  }): Promise<string>;
}

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY 미설정");
  }
  if (!_client) _client = new Anthropic();
  return _client;
}

function isOpus(model: string): boolean {
  return model.startsWith("claude-opus");
}

// 새 API 필드(output_config·thinking·effort)는 SDK 타입 커버리지가 유동적이라
// 요청 객체를 SDK 파라미터 타입으로 캐스팅해 함께 전달한다(런타임에 유효).
type CreateParams = Anthropic.Messages.MessageCreateParamsNonStreaming;
type StreamParams = Anthropic.Messages.MessageStreamParams;

export const claude: LLMProvider = {
  async completeJSON<T>({
    model,
    system,
    user,
    schema,
    maxTokens = 4096,
  }: {
    model: string;
    system: string;
    user: string;
    schema: object;
    maxTokens?: number;
  }): Promise<T> {
    const res = await client().messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
      output_config: { format: { type: "json_schema", schema } },
    } as unknown as CreateParams);
    const text = res.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text",
    );
    return JSON.parse(text?.text ?? "{}") as T;
  },

  async completeText({
    model,
    system,
    user,
    maxTokens = 16000,
    effort,
  }: {
    model: string;
    system: string;
    user: string;
    maxTokens?: number;
    effort?: "low" | "medium" | "high" | "xhigh" | "max";
  }): Promise<string> {
    const base: Record<string, unknown> = {
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    };
    if (isOpus(model)) {
      base.thinking = { type: "adaptive" };
      base.output_config = { effort: effort ?? "high" };
    }
    // 큰 max_tokens 는 stream 으로 받아 HTTP 타임아웃을 피한다.
    const stream = client().messages.stream(base as unknown as StreamParams);
    const msg = await stream.finalMessage();
    return msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
  },
};
