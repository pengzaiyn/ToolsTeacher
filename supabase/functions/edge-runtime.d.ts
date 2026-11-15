// Khai báo kiểu cho môi trường Deno / Supabase Edge Functions để IDE TypeScript kiểm tra chính xác mà không báo lỗi giả

declare namespace Deno {
  export const env: {
    get(key: string): string | undefined;
  };
  export function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

declare module 'npm:@supabase/supabase-js@2' {
  export * from '@supabase/supabase-js';
}

declare module 'npm:@google/genai@^2.29.1' {
  export interface InteractionSpeechConfig {
    voice?: string;
    language?: string;
  }

  export interface InteractionSpeechAnnotation {
    type: 'speech_metadata';
    style?: string;
  }

  export type InteractionContentItem =
    | {
        type: 'text';
        text: string;
        annotations?: InteractionSpeechAnnotation[];
      }
    | {
        type: 'audio';
        data: string;
        mime_type: string;
      };

  export interface InteractionTurnInput {
    type: 'user_input';
    content: InteractionContentItem[];
  }

  export interface InteractionCreateParams {
    model: string;
    input: string | InteractionContentItem[] | InteractionTurnInput[];
    system_instruction?: string;
    previous_interaction_id?: string;
    response_format?: { type: 'audio' | 'text' };
    generation_config?: {
      thinking_level?: 'minimal' | 'low' | 'medium' | 'high';
      max_output_tokens?: number;
      speech_config?: InteractionSpeechConfig[];
    };
    stream?: boolean;
  }

  export interface GoogleGenAIRequestOptions {
    timeout_ms?: number;
    maxRetries?: number;
  }

  export interface InteractionResponse {
    id?: string;
    output_text?: string;
    output_audio?: { data?: string; mime_type?: string } | null;
    steps?: Array<{
      content?: Array<{ type?: string; data?: string; mime_type?: string }>;
    }>;
  }

  export interface InteractionStreamEvent {
    event_type?: string;
    delta?: {
      type?: string;
      data?: string;
      sample_rate?: number;
    };
  }

  export class GoogleGenAI {
    constructor(options: { apiKey: string });
    interactions: {
      create(
        params: InteractionCreateParams & { stream: true },
        requestOptions?: GoogleGenAIRequestOptions
      ): Promise<AsyncIterable<InteractionStreamEvent>>;
      create(
        params: InteractionCreateParams & { stream?: false },
        requestOptions?: GoogleGenAIRequestOptions
      ): Promise<InteractionResponse>;
    };
  }
}

