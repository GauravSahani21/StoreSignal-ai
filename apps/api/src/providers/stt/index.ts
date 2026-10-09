import type { EnvConfig } from '../../config/env.js';
import { MockSTTProvider } from './MockSTTProvider.js';
import type { STTProvider } from './types.js';
import { WhisperSTTProvider } from './WhisperSTTProvider.js';

export function getSTTProvider(env: EnvConfig, customProvider?: STTProvider): STTProvider {
  if (customProvider) {
    return customProvider;
  }

  if (env.STT_PROVIDER === 'whisper' && env.STT_API_KEY) {
    return new WhisperSTTProvider({
      apiKey: env.STT_API_KEY,
      defaultLanguage: env.STT_DEFAULT_LANGUAGE,
    });
  }

  return new MockSTTProvider();
}

export * from './types.js';
export * from './MockSTTProvider.js';
export * from './WhisperSTTProvider.js';
