export interface GroqChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GroqChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
    finish_reason?: string;
  }>;
  error?: {
    message: string;
  };
}

export interface CaptionHashtagResult {
  caption: string;
  hashtags: string[];
}
