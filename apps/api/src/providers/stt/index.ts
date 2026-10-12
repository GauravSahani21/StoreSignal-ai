import type { EnvConfig } from '../../config/env.js';
import { MockSTTProvider } from './MockSTTProvider.js';
import type { STTProvider } from './types.js';
import { WhisperSTTProvider } from './WhisperSTTProvider.js';

export function getSTTProvider(env: EnvConfig, customProvider?: STTProvider): STTProvider {
  if (customProvider) {
    return customProvider;
  }

  // In test mode, keep mock STT unless explicitly testing whisper
  if (env.NODE_ENV === 'test' && env.STT_PROVIDER !== 'whisper') {
    return new MockSTTProvider();
  }

  // Use Whisper with Groq (or OpenAI if STT_API_KEY is custom)
  const apiKey = env.STT_API_KEY || env.GROQ_API_KEY;
  if (apiKey) {
    const isGroq = !env.STT_API_KEY && !!env.GROQ_API_KEY;
    return new WhisperSTTProvider({
      apiKey,
      endpointUrl: isGroq ? 'https://api.groq.com/openai/v1/audio/transcriptions' : undefined,
      model: isGroq ? 'whisper-large-v3-turbo' : 'whisper-1',
      defaultLanguage: env.STT_DEFAULT_LANGUAGE,
    });
  }

  return new MockSTTProvider();
}

export * from './types.js';
export * from './MockSTTProvider.js';
export * from './WhisperSTTProvider.js';
