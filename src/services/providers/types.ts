// Common types for AI provider services

export type MessageRole = "system" | "user" | "assistant";

export interface CacheControl {
  type: "ephemeral";
}

export interface TextPart {
  type: "text";
  text: string;
  cache_control?: CacheControl;
}

export interface ImagePart {
  type: "image_url";
  image_url: {
    url: string;
    detail: "high" | "low" | "auto";
  };
}

export type MessageContent = string | Array<TextPart | ImagePart>;

export interface Message {
  role: MessageRole;
  content: MessageContent;
}

export interface Plugin {
  id: "web";
  max_results?: number;
  search_prompt?: string;
}

export interface APIOptions {
  temperature?: number;
  max_tokens?: number;
  model?: string;
  plugins?: Plugin[];
}

export interface ChatCompletionRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  usage?: { include: boolean };
  plugins?: Plugin[];
}

export interface ChatCompletionResponse {
  id: string;
  choices: {
    index: number;
    message: {
      role: "assistant";
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ChatCompletionStreamResponse {
  id: string;
  choices: {
    index: number;
    delta: {
      content?: string;
      role?: string;
    };
    finish_reason: string | null;
  }[];
}

export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onReasoningChunk?: (chunk: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}

export interface AIServiceProvider {
  sendMessage: (messages: Message[], apiKey: string, options?: APIOptions) => Promise<string>;
  streamResponse: (
    messages: Message[],
    apiKey: string,
    callbacks: StreamCallbacks,
    options?: APIOptions
  ) => Promise<void>;
  callAI: (options: {
    messages: { role: string; content: string }[];
    max_tokens?: number;
    temperature?: number;
    projectInstructions?: string;
    model?: string;
  }) => Promise<{
    choices: [{ message: { content: string } }];
    quick_replies?: string[];
  }>;
}


