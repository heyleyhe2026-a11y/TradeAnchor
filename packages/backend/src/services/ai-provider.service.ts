import OpenAI from 'openai';
import logger from '../lib/logger';

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'ofox';
export type AIModel = 'gpt-4o' | 'gpt-4-turbo' | 'claude-3-opus' | 'claude-3-sonnet' | 'gemini-pro' | string;

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  model: string;
  provider: AIProvider;
  tokensUsed: number;
  finishReason?: string;
}

/**
 * Model configuration registry — All models unified through OFOX gateway
 */
export const MODEL_REGISTRY: Record<AIModel, { provider: AIProvider; displayName: string; maxTokens: number }> = {
  // GPT Models (via OFOX)
  'gpt-4o': {
    provider: 'ofox',
    displayName: 'GPT-4o',
    maxTokens: 4096,
  },
  'gpt-4-turbo': {
    provider: 'ofox',
    displayName: 'GPT-4 Turbo',
    maxTokens: 4096,
  },
  'gpt-3.5-turbo': {
    provider: 'ofox',
    displayName: 'GPT-3.5 Turbo',
    maxTokens: 2048,
  },
  'gpt-5': {
    provider: 'ofox',
    displayName: 'GPT-5',
    maxTokens: 4096,
  },
  'gpt-5-mini': {
    provider: 'ofox',
    displayName: 'GPT-5 Mini',
    maxTokens: 4096,
  },
  'gpt-5.4-mini': {
    provider: 'ofox',
    displayName: 'GPT-5.4 Mini',
    maxTokens: 4096,
  },

  // Claude Models (via OFOX)
  'claude-3-opus': {
    provider: 'ofox',
    displayName: 'Claude 3 Opus',
    maxTokens: 4096,
  },
  'claude-3-sonnet': {
    provider: 'ofox',
    displayName: 'Claude 3 Sonnet',
    maxTokens: 4096,
  },
  'claude-3-haiku': {
    provider: 'ofox',
    displayName: 'Claude 3 Haiku',
    maxTokens: 2048,
  },
  'claude-sonnet-4': {
    provider: 'ofox',
    displayName: 'Claude Sonnet 4.6',
    maxTokens: 8192,
  },
  'claude-opus-4.8': {
    provider: 'ofox',
    displayName: 'Claude Opus 4.8',
    maxTokens: 128000,
  },

  // Gemini Models (via OFOX)
  'gemini-pro': {
    provider: 'ofox',
    displayName: 'Gemini Pro',
    maxTokens: 2048,
  },
  'gemini-flash': {
    provider: 'ofox',
    displayName: 'Gemini Flash Lite',
    maxTokens: 4096,
  },
};

/**
 * Get all available models
 */
export function getAvailableModels(): Array<{ id: AIModel; displayName: string; provider: AIProvider }> {
  return Object.entries(MODEL_REGISTRY).map(([id, config]) => ({
    id: id as AIModel,
    displayName: config.displayName,
    provider: config.provider,
  }));
}

/**
 * Check if a model is configured and available — all models route through OFOX
 */
export function isModelAvailable(model: AIModel): boolean {
  return !!MODEL_REGISTRY[model] && !!process.env.OFOX_API_KEY && process.env.OFOX_API_KEY.length > 0;
}

/**
 * Unified AI Provider Service
 * Supports multiple AI providers with a consistent interface
 */
class AIProviderService {
  private ofoxClient: OpenAI | null = null;

  /**
   * Get or create OFOX client (OpenAI-compatible gateway)
   */
  private getOfoxClient(): OpenAI {
    if (!this.ofoxClient) {
      this.ofoxClient = new OpenAI({
        apiKey: process.env.OFOX_API_KEY,
        baseURL: process.env.OFOX_BASE_URL || 'https://api.ofox.ai/v1',
      });
    }
    return this.ofoxClient;
  }

  /**
   * Generate completion using specified model — all models route through OFOX gateway
   */
  async generateCompletion(
    model: AIModel,
    messages: AIMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<AIResponse> {
    if (!MODEL_REGISTRY[model]) {
      throw new Error(`Unsupported model: ${model}`);
    }

    logger.info(`Generating completion via OFOX`, { model });
    return this.generateOfoxCompletion(model, messages, options);
  }

  /**
   * OFOX unified gateway completion (OpenAI-compatible)
   * All models route through OFOX — maps internal model IDs to ofox API model names
   */
  private async generateOfoxCompletion(
    model: AIModel,
    messages: AIMessage[],
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<AIResponse> {
    const client = this.getOfoxClient();

    // Map TradeWise internal model ID → actual ofox API model name
    const ofoxModelMap: Record<string, string> = {
      // GPT models
      'gpt-4o': 'openai/gpt-4o',
      'gpt-4-turbo': 'openai/gpt-4-turbo',
      'gpt-3.5-turbo': 'openai/gpt-3.5-turbo',
      'gpt-5': 'openai/gpt-5',
      'gpt-5-mini': 'openai/gpt-5-mini',
      'gpt-5.4-mini': 'openai/gpt-5.4-mini',
      // Claude models
      'claude-3-opus': 'anthropic/claude-3-opus-20240229',
      'claude-3-sonnet': 'anthropic/claude-3-sonnet-20240229',
      'claude-3-haiku': 'anthropic/claude-3-haiku-20240307',
      'claude-sonnet-4': 'anthropic/claude-sonnet-4.6',
      'claude-opus-4.8': 'anthropic/claude-opus-4.8',
      // Gemini models
      'gemini-pro': 'google/gemini-2.5-pro',
      'gemini-flash': 'google/gemini-3-flash-lite-preview',
    };
    const actualModel = ofoxModelMap[model] || `openai/${model}`;

    // Build request body — only include temperature if explicitly provided
    // Some models (e.g., claude-opus-4.8) reject temperature as deprecated
    const baseParams = {
      model: actualModel,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      max_tokens: options?.maxTokens ?? MODEL_REGISTRY[model]?.maxTokens ?? 2000,
    };

    // Only include temperature when caller explicitly sets a non-default value
    // This avoids 400 errors on models where temperature is deprecated
    const hasExplicitTemperature = options?.temperature !== undefined && options.temperature !== null;

    const response = await client.chat.completions.create({
      ...baseParams,
      ...(hasExplicitTemperature ? { temperature: options!.temperature } : {}),
    } as any);

    // Return clean model name — hide the proxy detail from users
    return {
      content: response.choices[0]?.message?.content || '',
      model,
      provider: 'ofox',
      tokensUsed: response.usage?.total_tokens || 0,
      finishReason: response.choices[0]?.finish_reason || undefined,
    };
  }

  /**
   * Reset all clients (useful for testing or when API keys change)
   */
  resetClients(): void {
    this.ofoxClient = null;
  }
}

// Singleton instance
export const aiProviderService = new AIProviderService();
