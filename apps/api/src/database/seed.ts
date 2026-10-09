import type { Repositories } from './repositories/index.js';

export const DEFAULT_DEV_ORG_ID = 'org-vayu-motors-dev';

export async function seedDatabase(repos: Repositories): Promise<{
  orgId: string;
  productCount: number;
  shopperCount: number;
  conversationCount?: number;
}> {
  const orgId = DEFAULT_DEV_ORG_ID;

  // 1. Seed Products per Appendix D (Fictional brand: Vayu Motors)
  const productsToSeed = [
    {
      sku: 'vayu-commuter-110',
      name: 'Vayu Prithvi 110',
      category: 'commuter_motorcycle',
      priceMin: 72000,
      priceMax: 78000,
      attributes: {
        displacementCc: 109.7,
        powerBhp: 8.4,
        mileageKmpl: 68,
        fuelTankLitres: 10,
        kerbWeightKg: 112,
        seatHeightMm: 790,
        brakes: 'Drum / Optional Front Disc',
        warrantyYears: 5,
        warrantyKm: 70000,
        colors: ['Midnight Black', 'Electric Blue', 'Scarlet Red'],
      },
    },
    {
      sku: 'vayu-commuter-125',
      name: 'Vayu Agni 125',
      category: 'commuter_motorcycle',
      priceMin: 88000,
      priceMax: 95000,
      attributes: {
        displacementCc: 124.8,
        powerBhp: 11.2,
        mileageKmpl: 58,
        fuelTankLitres: 10.5,
        kerbWeightKg: 118,
        seatHeightMm: 795,
        brakes: 'Disc Front, Drum Rear (Synchronized Braking)',
        warrantyYears: 5,
        warrantyKm: 70000,
        colors: ['Titanium Grey', 'Blazing Orange', 'Pearl White'],
      },
    },
    {
      sku: 'vayu-urban-160',
      name: 'Vayu Vayu 160R',
      category: 'mid_range_motorcycle',
      priceMin: 125000,
      priceMax: 135000,
      attributes: {
        displacementCc: 159.7,
        powerBhp: 17.5,
        mileageKmpl: 45,
        fuelTankLitres: 12,
        kerbWeightKg: 144,
        seatHeightMm: 800,
        brakes: 'Dual Disc with Single-Channel ABS',
        warrantyYears: 3,
        warrantyKm: 50000,
        colors: ['Matte Stealth Black', 'Racing Red', 'Metallic Blue'],
      },
    },
    {
      sku: 'vayu-tourer-250',
      name: 'Vayu Garud 250',
      category: 'touring_motorcycle',
      priceMin: 185000,
      priceMax: 198000,
      attributes: {
        displacementCc: 248.8,
        powerBhp: 27.0,
        mileageKmpl: 35,
        fuelTankLitres: 14.5,
        kerbWeightKg: 162,
        seatHeightMm: 815,
        brakes: 'Dual Disc with Dual-Channel ABS',
        warrantyYears: 3,
        warrantyKm: 50000,
        colors: ['Desert Sand', 'Alpine White', 'Phantom Black'],
      },
    },
    {
      sku: 'vayu-ev-scooter',
      name: 'Vayu Vidyut S1',
      category: 'electric_scooter',
      priceMin: 115000,
      priceMax: 128000,
      attributes: {
        batteryKwh: 3.8,
        certifiedRangeKm: 135,
        realWorldRangeKm: 105,
        topSpeedKmph: 85,
        chargingTimeHours: 4.5,
        kerbWeightKg: 108,
        seatHeightMm: 770,
        brakes: 'Combined Disc Braking',
        batteryWarrantyYears: 5,
        batteryWarrantyKm: 60000,
        colors: ['Cyber Cyan', 'Pearl Silver', 'Volt Yellow'],
      },
    },
    {
      sku: 'vayu-premium-400',
      name: 'Vayu Trishul 400',
      category: 'premium_roadster',
      priceMin: 260000,
      priceMax: 285000,
      attributes: {
        displacementCc: 398.2,
        powerBhp: 42.0,
        mileageKmpl: 28,
        fuelTankLitres: 13,
        kerbWeightKg: 171,
        seatHeightMm: 810,
        brakes: 'ByBre Dual Disc with Dual-Channel Cornering ABS',
        warrantyYears: 2,
        warrantyKm: 30000,
        colors: ['Nebula Matte Black', 'Heritage Silver'],
      },
    },
  ];

  for (const p of productsToSeed) {
    const existing = await repos.products.getProductBySku(orgId, p.sku);
    if (!existing) {
      await repos.products.createProduct({
        orgId,
        sku: p.sku,
        name: p.name,
        category: p.category,
        priceMin: p.priceMin,
        priceMax: p.priceMax,
        attributes: p.attributes,
        isDemo: true,
      });
    }
  }

  // 2. Seed Shoppers with explicit / anonymous profiles and varied consent
  const shoppersToSeed = [
    {
      externalCustomerId: 'CUST-IND-101',
      contactHash: 'hash-rahul-sharma-9876543210',
      anonymousId: 'anon-rahul-101',
      consentFlags: {
        audioRecording: true,
        transcriptProcessing: true,
        followUpContact: true,
      },
    },
    {
      externalCustomerId: 'CUST-IND-102',
      contactHash: 'hash-priya-patel-9811223344',
      anonymousId: 'anon-priya-102',
      consentFlags: {
        audioRecording: true,
        transcriptProcessing: true,
        followUpContact: false, // Explicitly declined follow-up
      },
    },
    {
      externalCustomerId: undefined, // Pure walk-in anonymous shopper
      contactHash: undefined,
      anonymousId: 'anon-walkin-bengaluru-901',
      consentFlags: {
        audioRecording: true,
        transcriptProcessing: true,
        followUpContact: false,
      },
    },
  ];

  for (const s of shoppersToSeed) {
    const existing = s.externalCustomerId
      ? await repos.shoppers.findShopperByExternalId(orgId, s.externalCustomerId)
      : await repos.shoppers.findShopperByAnonymousId(orgId, s.anonymousId);

    if (!existing) {
      await repos.shoppers.createShopper({
        orgId,
        externalCustomerId: s.externalCustomerId,
        contactHash: s.contactHash,
        anonymousId: s.anonymousId,
        consentFlags: s.consentFlags,
        isDemo: true,
      });
    }
  }

  // 3. Seed Realistic Demo Conversations & Workflows (Phase 11 Dashboard Demonstration Data)
  const shopper1 = await repos.shoppers.findShopperByExternalId(orgId, 'CUST-IND-101');
  const shopper2 = await repos.shoppers.findShopperByExternalId(orgId, 'CUST-IND-102');
  const shopper3 = await repos.shoppers.findShopperByAnonymousId(orgId, 'anon-walkin-bengaluru-901');

  const demoConversations = [
    {
      id: 'conv-demo-001',
      storeId: 'store-indiranagar-01',
      status: 'completed' as const,
      source: 'audio_upload' as const,
      rawTranscript:
        '[00:00:02] Advisor: Namaste! Looking for a daily commuter bike?\n[00:00:06] Customer: Yes, I travel 35 km daily to Whitefield. What is the mileage of the Prithvi 110?\n[00:00:12] Advisor: Real-world mileage is 68 kmpl with 5 years warranty.\n[00:00:18] Customer: Excellent, can I book a test ride and get the on-road price with cash down payment?',
      shopperId: shopper1?.id,
      basis: 'explicit_customer_id' as const,
      intentScore: 82,
      intentBand: 'high',
      intentConfidence: 'high',
      summary: 'Customer inquiring about daily office commuting on Prithvi 110 with high mileage requirement.',
      questions: [{ question: 'What is the mileage of the Prithvi 110?' }, { question: 'What is the on-road price with cash down payment?' }],
      objections: [],
      productInterests: [{ productRef: 'vayu-commuter-110', text: 'Vayu Prithvi 110', basis: 'explicit' }],
      contributingSignals: [
        { signalId: 'stated_timeline_near_term', weight: 20, label: 'Near-term purchase timeline' },
        { signalId: 'requested_trial_or_test_ride', weight: 20, label: 'Requested test ride' },
        { signalId: 'asked_pricing_or_discounts', weight: 15, label: 'Inquired on-road pricing' },
      ],
      draft: {
        channel: 'whatsapp' as const,
        subject: 'Your Vayu Prithvi 110 Test Ride Confirmation',
        message: 'Namaste Rahul, thank you for visiting Vayu Motors Indiranagar. Your Prithvi 110 test ride is confirmed. On-road price is ₹76,500 with 68 kmpl mileage.',
        status: 'approved' as const,
      },
      outcome: {
        type: 'purchase' as const,
        reason: 'Purchased Prithvi 110 Scarlet Red with cash down payment',
        value: 76500,
      },
    },
    {
      id: 'conv-demo-002',
      storeId: 'store-indiranagar-01',
      status: 'completed' as const,
      source: 'transcript_import' as const,
      rawTranscript:
        '[00:00:03] Advisor: Welcome back Rahul! Good to see you again.\n[00:00:08] Customer: Yes, I wanted to check accessory packages and extended warranty terms for my Prithvi 110.\n[00:00:14] Advisor: We have the Pro Commuter accessory kit including crash guard and helmet lock.',
      shopperId: shopper1?.id,
      basis: 'explicit_customer_id' as const,
      intentScore: 88,
      intentBand: 'high',
      intentConfidence: 'high',
      summary: 'Returning customer inquiring about extended warranty and commuter accessories.',
      questions: [{ question: 'What are the accessory packages and extended warranty terms?' }],
      objections: [],
      productInterests: [{ productRef: 'vayu-commuter-110', text: 'Vayu Prithvi 110', basis: 'explicit' }],
      contributingSignals: [
        { signalId: 'returning_visit', weight: 8, label: 'Returning store visitor' },
        { signalId: 'asked_warranty_or_maintenance', weight: 10, label: 'Inquired warranty coverage' },
      ],
      draft: {
        channel: 'email' as const,
        subject: 'Vayu Motors - Pro Commuter Accessories Details',
        message: 'Dear Rahul, thank you for returning to Vayu Motors. Here are the brochure details for the Pro Commuter kit.',
        status: 'approved' as const,
      },
      outcome: {
        type: 'purchase' as const,
        reason: 'Added Pro Commuter accessory bundle and helmet package',
        value: 6500,
      },
    },
    {
      id: 'conv-demo-003',
      storeId: 'store-koramangala-02',
      status: 'completed' as const,
      source: 'audio_upload' as const,
      rawTranscript:
        '[00:00:03] Advisor: Hello! Welcome to Vayu Motors Koramangala. Interested in our electric Vidyut scooter?\n[00:00:10] Customer: Yes, but charging takes 4.5 hours at home, which seems too long for my busy routine.\n[00:00:18] Advisor: We have 55-minute fast charging at 45 public hubs across Bengaluru.\n[00:00:25] Customer: Still, I am worried about lack of fast chargers on Outer Ring Road near my office.',
      shopperId: shopper2?.id,
      basis: 'explicit_customer_id' as const,
      intentScore: 52,
      intentBand: 'medium',
      intentConfidence: 'medium',
      summary: 'Customer considering Vidyut EV scooter with concern over home and public charging speeds.',
      questions: [{ question: 'How long does charging take?' }],
      objections: [{ type: 'charging_time', customerQuote: 'charging takes 4.5 hours at home, which seems too long' }],
      productInterests: [{ productRef: 'vayu-electric-vidyut', text: 'Vayu Vidyut EV', basis: 'explicit' }],
      contributingSignals: [
        { signalId: 'asked_charging_or_range', weight: 15, label: 'Inquired electric charging and range' },
        { signalId: 'stated_objection_range_or_charging', weight: -10, label: 'Concern regarding charging infrastructure' },
      ],
      draft: {
        channel: 'none' as const,
        subject: null,
        message: null,
        status: 'draft' as const,
        blockedReason: 'Consent policy: customer declined follow-up contact',
      },
      outcome: {
        type: 'missed_conversion' as const,
        reason: 'Worried about lack of fast chargers on Outer Ring Road',
        value: undefined,
      },
    },
    {
      id: 'conv-demo-004',
      storeId: 'store-indiranagar-01',
      status: 'completed' as const,
      source: 'audio_upload' as const,
      rawTranscript:
        '[00:00:02] Advisor: Namaste, can I help you choose a bike today?\n[00:00:07] Customer: The Agni 125 is listed at ₹95,000 on road. That feels steep compared to second-hand options.\n[00:00:14] Advisor: It includes front disc brake, CBS, and 5 years warranty coverage.\n[00:00:20] Customer: Let me think about it and look around other dealerships.',
      shopperId: shopper3?.id,
      basis: 'anonymous_session' as const,
      intentScore: 35,
      intentBand: 'low',
      intentConfidence: 'high',
      summary: 'Walk-in customer comparing Agni 125 pricing with pre-owned motorcycles.',
      questions: [{ question: 'What is included in the on-road price?' }],
      objections: [{ type: 'price_sensitivity', customerQuote: 'That feels steep compared to second-hand options' }],
      productInterests: [{ productRef: 'vayu-commuter-125', text: 'Vayu Agni 125', basis: 'explicit' }],
      contributingSignals: [
        { signalId: 'stated_browsing_only', weight: -20, label: 'Browsing and comparing dealerships' },
        { signalId: 'stated_price_sensitivity', weight: -15, label: 'Price sensitivity relative to budget' },
      ],
      draft: {
        channel: 'call_task' as const,
        subject: 'Follow-up Call Task: Agni 125 exchange valuation offer',
        message: 'Call customer with pre-owned exchange bonus of ₹3,000 on Agni 125.',
        status: 'rejected' as const,
      },
      outcome: {
        type: 'missed_conversion' as const,
        reason: 'Price higher than pre-owned vehicle options',
        value: undefined,
      },
    },
    {
      id: 'conv-demo-005',
      storeId: 'store-koramangala-02',
      status: 'completed' as const,
      source: 'audio_upload' as const,
      rawTranscript:
        '[00:00:03] Advisor: Good afternoon! Ready for the test ride on the Vayu 160R?\n[00:00:08] Customer: Yes, just rode it around the block. Acceleration and dual-channel ABS feel phenomenal!\n[00:00:15] Advisor: On-road price is ₹1,32,000 with zero down-payment festive financing.\n[00:00:21] Customer: Sign me up, let us process the booking form right now.',
      shopperId: shopper1?.id,
      basis: 'explicit_customer_id' as const,
      intentScore: 92,
      intentBand: 'high',
      intentConfidence: 'high',
      summary: 'High-intent test ride conversion on Vayu 160R premium commuter.',
      questions: [{ question: 'What financing options are available?' }],
      objections: [],
      productInterests: [{ productRef: 'vayu-urban-160', text: 'Vayu Vayu 160R', basis: 'explicit' }],
      contributingSignals: [
        { signalId: 'stated_timeline_immediate', weight: 25, label: 'Immediate booking readiness' },
        { signalId: 'positive_test_ride_feedback', weight: 20, label: 'Phenomenal ride experience' },
        { signalId: 'asked_financing', weight: 15, label: 'Inquired zero-down financing' },
      ],
      draft: {
        channel: 'email' as const,
        subject: 'Your Vayu 160R Booking Confirmation & Delivery Schedule',
        message: 'Congratulations Rahul! Your booking for Vayu 160R in Blazing Orange is confirmed. Vehicle delivery is scheduled for Tuesday.',
        status: 'approved' as const,
      },
      outcome: {
        type: 'purchase' as const,
        reason: 'Booked Vayu 160R Blazing Orange with zero-down finance package',
        value: 132000,
      },
    },
    {
      id: 'conv-demo-006',
      storeId: 'store-indiranagar-01',
      status: 'completed' as const,
      source: 'audio_upload' as const,
      rawTranscript:
        '[00:00:02] Customer: Hi, what time do you close today?\n[00:00:05] Advisor: We are open until 8:30 PM this evening. Looking for any specific model?\n[00:00:09] Customer: No, just passing by. Thank you!',
      shopperId: undefined,
      basis: 'anonymous_session' as const,
      intentScore: 20,
      intentBand: 'abstained',
      intentConfidence: 'low',
      summary: 'Brief inquiry regarding showroom timings without model interest.',
      questions: [{ question: 'What time do you close today?' }],
      objections: [],
      productInterests: [],
      contributingSignals: [
        { signalId: 'abstained_thin_dialogue', weight: 0, label: 'Insufficient customer dialogue to assess purchase intent' },
      ],
      draft: {
        channel: 'none' as const,
        subject: null,
        message: null,
        status: 'draft' as const,
        blockedReason: 'Thin dialogue: no actionable purchase signals detected',
      },
      outcome: undefined,
    },
  ];

  for (const demo of demoConversations) {
    const existingConv = await repos.conversations.findById(demo.id);
    if (!existingConv) {
      // 1. Create conversation
      await repos.conversations.createConversation({
        id: demo.id,
        orgId,
        storeId: demo.storeId,
        status: demo.status,
        source: demo.source,
        isDemo: true,
      });

      // 2. Add transcript segments
      const lines = demo.rawTranscript.split('\n');
      const segments = lines.map((l, idx) => {
        const isAdv = l.includes('Advisor:');
        return {
          id: `seg-${demo.id}-${idx}`,
          index: idx,
          speaker: isAdv ? ('advisor' as const) : ('customer' as const),
          text: l.replace(/\[\d\d:\d\d:\d\d\]\s+(Advisor|Customer):\s+/, ''),
          startMs: idx * 5000,
          endMs: (idx + 1) * 5000,
          confidence: 1.0,
        };
      });

      await repos.conversations.createTranscriptWithSegments({
        orgId,
        conversationId: demo.id,
        version: 1,
        rawText: demo.rawTranscript,
        segments,
      });

      // 3. Link shopper if present
      if (demo.shopperId) {
        await repos.shoppers.linkConversation({
          orgId,
          conversationId: demo.id,
          shopperId: demo.shopperId,
          basis: demo.basis,
          authorizer: 'advisor-neha-12',
        });
      }

      // 4. Save workflow run
      const workflowRun = await repos.workflows.createWorkflowRun({
        orgId,
        conversationId: demo.id,
        idempotencyKey: `idem-${demo.id}-v1`,
        version: 1,
        state: 'COMPLETED',
        stepResults: {
          retrieval: { state: 'SUCCEEDED', durationMs: 45 },
          floor_coach: {
            state: 'SUCCEEDED',
            durationMs: 230,
            output: {
              suggestions: [
                { topic: 'Mileage and warranty specifications', guidance: 'Highlight 68 kmpl real world mileage and 5 years warranty.' },
              ],
              unresolvedQuestions: demo.id === 'conv-demo-003' ? ['Exact outer ring road fast charging points'] : [],
            },
          },
          signal_analyst: {
            state: 'SUCCEEDED',
            durationMs: 280,
            output: {
              summary: demo.summary,
              questionsAsked: demo.questions,
              objections: demo.objections,
              productInterests: demo.productInterests,
              intentAssessment: {
                score: demo.intentScore,
                band: demo.intentBand,
                confidence: demo.intentConfidence,
                contributingSignals: demo.contributingSignals,
              },
            },
          },
          followup_optimizer: {
            state: 'SUCCEEDED',
            durationMs: 190,
          },
        },
        resultSummary: { intentScore: demo.intentScore, intentBand: demo.intentBand },
        durationMs: 745,
      });

      // 5. Follow-up draft
      if (demo.draft) {
        await repos.drafts.createDraft({
          orgId,
          conversationId: demo.id,
          channel: demo.draft.channel,
          subject: demo.draft.subject,
          message: demo.draft.message,
          factsUsed: [{ fact: '68 kmpl mileage cited from vehicle catalog' }],
          recommendedAction: 'Send personalized follow-up communication',
          reason: 'Customer requested vehicle pricing and availability',
          status: demo.draft.status,
          blockedReason: demo.draft.blockedReason,
        });
      }

      // 6. Outcome if recorded
      if (demo.outcome) {
        await repos.outcomes.createOutcome({
          orgId,
          conversationId: demo.id,
          shopperId: demo.shopperId,
          type: demo.outcome.type,
          reason: demo.outcome.reason,
          value: demo.outcome.value,
          recordedBy: 'advisor-neha-12',
        });

        // 7. Store event
        await repos.storeEvents.recordEvent({
          orgId,
          storeId: demo.storeId,
          conversationId: demo.id,
          shopperId: demo.shopperId,
          type: demo.outcome.type === 'purchase' ? 'PURCHASE_RECORDED' : 'MISSED_CONVERSION_RECORDED',
          source: 'manual',
          metadata: { reason: demo.outcome.reason, value: demo.outcome.value },
        });
      }

      // 8. Usage events
      await repos.usageEvents.recordUsage({
        orgId,
        conversationId: demo.id,
        workflowRunId: workflowRun.id,
        agent: 'floor_coach',
        model: 'anthropic/claude-3.5-sonnet',
        promptTokens: 450,
        completionTokens: 150,
        totalTokens: 600,
        latencyMs: 230,
        costCents: 0.12,
      });

      await repos.usageEvents.recordUsage({
        orgId,
        conversationId: demo.id,
        workflowRunId: workflowRun.id,
        agent: 'signal_analyst',
        model: 'anthropic/claude-3.5-sonnet',
        promptTokens: 580,
        completionTokens: 210,
        totalTokens: 790,
        latencyMs: 280,
        costCents: 0.16,
      });
    }
  }

  return {
    orgId,
    productCount: productsToSeed.length,
    shopperCount: shoppersToSeed.length,
    conversationCount: demoConversations.length,
  };
}

