import { describe, expect, it } from 'vitest';
import { segmentTranscript } from '../conversations/segmenter.js';
import { ValidationError } from '../errors/AppError.js';

describe('Transcript Segmenter Utility (Appendix E)', () => {
  it('parses formatted transcript into stable segments with speakers and timestamps', () => {
    const raw = `
[00:00:05] Advisor: Welcome to Vayu Motors! Are you looking at the commuter range today?
[00:00:12] Customer: Yes, mostly for daily office travel in Bengaluru traffic.
[00:00:18] Advisor: The Prithvi 110 gives 68 kmpl and has very low maintenance.
    `.trim();

    const segments = segmentTranscript(raw, {
      conversationId: 'conv-test-1',
      transcriptVersion: 1,
    });

    expect(segments).toHaveLength(3);

    expect(segments[0]).toMatchObject({
      index: 0,
      speaker: 'advisor',
      startMs: 5000,
      text: 'Welcome to Vayu Motors! Are you looking at the commuter range today?',
    });
    expect(segments[0]?.id).toMatch(/^seg-1-0-[a-f0-9]{8}$/);

    expect(segments[1]).toMatchObject({
      index: 1,
      speaker: 'customer',
      startMs: 12000,
      text: 'Yes, mostly for daily office travel in Bengaluru traffic.',
    });

    expect(segments[2]).toMatchObject({
      index: 2,
      speaker: 'advisor',
      startMs: 18000,
      text: 'The Prithvi 110 gives 68 kmpl and has very low maintenance.',
    });
  });

  it('guarantees stable, deterministic segment IDs across runs for identical input', () => {
    const raw = '[01:15] Customer: What is the waiting period for the Vidyut S1 electric scooter?';

    const run1 = segmentTranscript(raw, { conversationId: 'conv-abc', transcriptVersion: 1 });
    const run2 = segmentTranscript(raw, { conversationId: 'conv-abc', transcriptVersion: 1 });

    expect(run1[0]?.id).toBe(run2[0]?.id);
    expect(run1[0]?.id).toBeDefined();
  });

  it('parses transcripts without timestamps and normalizes speaker roles', () => {
    const raw = `
Sales Executive: How can I help you today?
Buyer: I want to know about financing options.
Unknown Person: Where is the billing desk?
    `.trim();

    const segments = segmentTranscript(raw);
    expect(segments).toHaveLength(3);
    expect(segments[0]?.speaker).toBe('advisor');
    expect(segments[0]?.startMs).toBeNull();
    expect(segments[1]?.speaker).toBe('customer');
    expect(segments[2]?.speaker).toBe('unknown');
  });

  it('handles Indian language scripts and code-mixed (Hinglish) text without mangling', () => {
    const raw = `
Advisor: Namaste sir! Aapko petrol bike dekhni hai ya electric?
Customer: Mujhe Prithvi 110 ka mileage samajhna hai. Kya yeh sach mein 68 kmpl deti hai?
कस्टमर: क्या इसकी सर्विस वारंटी ५ साल की है?
    `.trim();

    const segments = segmentTranscript(raw);
    expect(segments).toHaveLength(3);
    expect(segments[0]?.text).toContain('Namaste sir!');
    expect(segments[1]?.text).toContain('Mujhe Prithvi 110 ka mileage samajhna hai.');
    expect(segments[2]?.speaker).toBe('customer');
    expect(segments[2]?.text).toContain('क्या इसकी सर्विस वारंटी ५ साल की है?');
  });

  it('throws ValidationError on empty or whitespace-only transcript', () => {
    expect(() => segmentTranscript('')).toThrowError(ValidationError);
    expect(() => segmentTranscript('   \n\n  \t ')).toThrowError(ValidationError);
  });
});
