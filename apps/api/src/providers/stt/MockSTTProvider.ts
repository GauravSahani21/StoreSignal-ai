import {
  STTEmptyError,
  STTTimeoutError,
  STTUnsupportedFormatError,
} from '../../errors/AppError.js';
import type { AudioBufferData, STTOptions, STTProvider, STTResult } from './types.js';

export interface MockSTTOptions {
  simulateEmpty?: boolean;
  simulateTimeout?: boolean;
  simulateUnsupportedFormat?: boolean;
  cannedText?: string;
}

export class MockSTTProvider implements STTProvider {
  private readonly config: MockSTTOptions;

  constructor(config: MockSTTOptions = {}) {
    this.config = config;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async transcribe(audio: AudioBufferData, _options?: STTOptions): Promise<STTResult> {
    if (this.config.simulateTimeout) {
      throw new STTTimeoutError('Speech-to-text service timed out during processing.');
    }

    if (this.config.simulateUnsupportedFormat) {
      throw new STTUnsupportedFormatError(
        `Unsupported audio mime-type "${audio.mimeType}". Allowed: audio/wav, audio/mpeg, audio/mp4, audio/webm.`
      );
    }

    if (this.config.simulateEmpty || audio.sizeBytes === 0) {
      throw new STTEmptyError('No audible dialogue detected in uploaded audio recording.');
    }

    const defaultDialogue = `
[00:00:03] Advisor: Namaste! Welcome to Vayu Motors showroom. Are you looking for commuter bikes or scooters?
[00:00:10] Customer: Hello, I am looking for a commuter motorcycle for daily office travel in Bengaluru.
[00:00:17] Advisor: We have the Prithvi 110 which gives 68 kmpl and the Agni 125 with more power.
[00:00:25] Customer: What is the service schedule and on-road price for the Prithvi 110?
    `.trim();

    const text = this.config.cannedText || defaultDialogue;

    return {
      text,
      language: 'en',
      durationMs: audio.durationMs || 28000,
      segments: [
        {
          index: 0,
          speaker: 'advisor',
          startMs: 3000,
          endMs: 8000,
          text: 'Namaste! Welcome to Vayu Motors showroom. Are you looking for commuter bikes or scooters?',
          confidence: 0.95,
        },
        {
          index: 1,
          speaker: 'customer',
          startMs: 10000,
          endMs: 16000,
          text: 'Hello, I am looking for a commuter motorcycle for daily office travel in Bengaluru.',
          confidence: 0.92,
        },
        {
          index: 2,
          speaker: 'advisor',
          startMs: 17000,
          endMs: 24000,
          text: 'We have the Prithvi 110 which gives 68 kmpl and the Agni 125 with more power.',
          confidence: 0.94,
        },
        {
          index: 3,
          speaker: 'customer',
          startMs: 25000,
          endMs: 31000,
          text: 'What is the service schedule and on-road price for the Prithvi 110?',
          confidence: 0.93,
        },
      ],
    };
  }
}
