export type AIMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AIMessage {
  role: AIMessageRole;
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface AIResponseFormat {
  type: 'json_object' | 'text' | 'json_schema';
  jsonSchema?: Record<string, unknown>;
}

export interface AIToolDefinition {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

export interface AIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface AIRequest {
  model?: string;
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: AIResponseFormat;
  tools?: AIToolDefinition[];
  metadata?: {
    workflowId?: string;
    agentName?: string;
    conversationId?: string;
  };
  signal?: AbortSignal;
}

export interface AIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AIResponse {
  content: string;
  toolCalls?: AIToolCall[];
  model: string; // The actual model that serviced the request
  finishReason: string;
  usage: AIUsage | null;
  latencyMs: number;
  providerRequestId?: string;
}

export interface AIChunk {
  deltaContent: string;
  model?: string;
  finishReason?: string;
}

export interface AIProvider {
  generate(request: AIRequest): Promise<AIResponse>;
  stream(request: AIRequest): AsyncIterable<AIChunk>;
  generateWithTools(request: AIRequest): Promise<AIResponse>;
}
