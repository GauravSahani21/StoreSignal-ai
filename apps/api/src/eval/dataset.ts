import type { GoldenTestCase } from './types.js';

export const GOLDEN_DATASET: GoldenTestCase[] = [
  // 1. High Intent: Commuter 110 Daily Work Commute
  {
    id: 'tc-001',
    name: 'Prithvi 110 High-Mileage Daily Commuter',
    category: 'high_intent',
    description: 'Daily office commuter seeking fuel economy, requesting on-road price and test ride.',
    transcript:
      '[00:00:02] Advisor: Namaste! Looking for a reliable daily commuter motorcycle?\n' +
      '[00:00:06] Customer: Yes, I travel 35 km daily to Whitefield. What is the mileage of the Prithvi 110?\n' +
      '[00:00:12] Advisor: Real-world mileage is 68 kmpl with synchronized braking and a 5-year warranty.\n' +
      '[00:00:18] Customer: Excellent, I want to book a test ride today and know the on-road price with cash down payment.',
    consentGranted: true,
    expected: {
      intentBand: 'high',
      minIntentScore: 70,
      expectedSignals: ['stated_timeline_near_term', 'requested_trial_or_test_ride', 'asked_pricing_or_discounts'],
      shouldGenerateDraft: true,
      expectedDraftChannel: 'whatsapp',
    },
  },

  // 2. High Intent: Premium 160R Immediate Booking
  {
    id: 'tc-002',
    name: 'Vayu 160R Immediate Test Ride Booking',
    category: 'high_intent',
    description: 'Customer tested performance motorcycle and wants immediate booking on festive zero-down finance.',
    transcript:
      '[00:00:02] Advisor: Welcome to Vayu Motors! How was your test ride on the Vayu 160R?\n' +
      '[00:00:08] Customer: It was phenomenal! Dual-channel ABS and throttle response are top notch.\n' +
      '[00:00:14] Advisor: On-road price is ₹1,32,000 with zero down-payment festive financing.\n' +
      '[00:00:20] Customer: Sign me up, let us process the paperwork right now.',
    consentGranted: true,
    expected: {
      intentBand: 'high',
      minIntentScore: 75,
      expectedSignals: ['stated_timeline_immediate', 'positive_test_ride_feedback'],
      shouldGenerateDraft: true,
      expectedDraftChannel: 'email',
    },
  },

  // 3. Returning Visitor: Commuter Accessories
  {
    id: 'tc-003',
    name: 'Returning Shopper Pro-Commuter Accessories',
    category: 'returning_visitor',
    description: 'Second store visit by identified owner to install safety accessories and extended warranty.',
    transcript:
      '[00:00:03] Advisor: Welcome back Rahul! Good to see you again at Vayu Motors Indiranagar.\n' +
      '[00:00:08] Customer: Thank you! I want to check the Pro Commuter accessory bundle and extended warranty for my Prithvi 110.\n' +
      '[00:00:14] Advisor: We have the crash guard, helmet lock, and all-weather seat cover in stock.\n' +
      '[00:00:20] Customer: Great, please send me the invoice breakdown and warranty certificate.',
    consentGranted: true,
    shopper: {
      id: 'shp-ret-101',
      externalCustomerId: 'CUST-IND-101',
      isReturningVisitor: true,
      visitCount: 2,
    },
    expected: {
      intentBand: 'high',
      minIntentScore: 70,
      expectedSignals: ['returning_visit'],
      shouldGenerateDraft: true,
      expectedDraftChannel: 'email',
    },
  },

  // 4. Returning Visitor: Upgrading from 110 to 160R
  {
    id: 'tc-004',
    name: 'Returning Visitor Vehicle Upgrade',
    category: 'returning_visitor',
    description: 'Repeat showroom visitor evaluating exchange valuation and upgrading to higher displacement.',
    transcript:
      '[00:00:02] Advisor: Namaste Rahul, welcome back. Are you looking to upgrade today?\n' +
      '[00:00:07] Customer: Yes, I am considering trading in my commuter for the Vayu 160R if the exchange bonus works out.\n' +
      '[00:00:14] Advisor: We have an exchange valuation desk and a festive bonus of ₹5,000.\n' +
      '[00:00:21] Customer: Let us calculate the exchange difference and delivery timeline.',
    consentGranted: true,
    shopper: {
      id: 'shp-ret-102',
      externalCustomerId: 'CUST-IND-101',
      isReturningVisitor: true,
      visitCount: 3,
    },
    expected: {
      intentBand: 'high',
      minIntentScore: 70,
      expectedSignals: ['returning_visit', 'asked_pricing_or_discounts'],
      shouldGenerateDraft: true,
    },
  },

  // 5. Price Objection: Agni 125 vs Pre-Owned Market
  {
    id: 'tc-005',
    name: 'Price Sensitivity on Agni 125 vs Pre-Owned',
    category: 'price_objection',
    description: 'Customer compares showroom on-road price with second-hand alternatives and hesitates.',
    transcript:
      '[00:00:03] Advisor: Namaste! Can I help you look at the Agni 125?\n' +
      '[00:00:08] Customer: The Agni 125 on-road price of ₹95,000 feels too steep compared to second-hand bikes.\n' +
      '[00:00:15] Advisor: It comes with 5 years warranty, Synchronized Braking, and 58 kmpl mileage.\n' +
      '[00:00:22] Customer: Still, I need to check my budget and compare with other dealerships first.',
    consentGranted: true,
    expected: {
      intentBand: 'low',
      maxIntentScore: 45,
      expectedSignals: ['stated_browsing_only', 'stated_price_sensitivity'],
      expectedObjections: ['price_sensitivity'],
      shouldGenerateDraft: true,
      expectedDraftChannel: 'call_task',
    },
  },

  // 6. Range Anxiety & Home Charging Objection on Vidyut EV
  {
    id: 'tc-006',
    name: 'Electric Vidyut Charging Duration Objection',
    category: 'range_anxiety_objection',
    description: 'Customer hesitates due to 4.5-hour home charging and public charging availability.',
    transcript:
      '[00:00:03] Advisor: Welcome to Vayu Motors Koramangala. Interested in our electric Vidyut scooter?\n' +
      '[00:00:10] Customer: I like the design, but charging takes 4.5 hours at home, which seems too long for my routine.\n' +
      '[00:00:18] Advisor: We have 55-minute fast charging stations across 45 hubs in Bengaluru.\n' +
      '[00:00:25] Customer: Still, I am worried about lack of fast chargers near my office on Outer Ring Road.',
    consentGranted: true,
    expected: {
      intentBand: 'medium',
      minIntentScore: 40,
      maxIntentScore: 65,
      expectedSignals: ['asked_charging_or_range', 'stated_objection_range_or_charging'],
      expectedObjections: ['charging_time'],
      shouldGenerateDraft: true,
    },
  },

  // 7. Battery Degradation Fear on Electric Vidyut
  {
    id: 'tc-007',
    name: 'Electric Scooter Battery Degradation Hesitation',
    category: 'range_anxiety_objection',
    description: 'Customer worried about battery life after 3 years and replacement cost.',
    transcript:
      '[00:00:02] Advisor: Hello! Have you checked out our electric Vidyut scooter?\n' +
      '[00:00:06] Customer: What happens to the battery after 3 years? Replacement costs might be huge.\n' +
      '[00:00:12] Advisor: The Vidyut battery has a 3-year or 40,000 km warranty with IP67 water and dust resistance.\n' +
      '[00:00:19] Customer: I am still concerned about Indian monsoon waterlogging and battery life.',
    consentGranted: true,
    expected: {
      intentBand: 'medium',
      expectedObjections: ['battery_life'],
      shouldGenerateDraft: true,
    },
  },

  // 8. Model Comparison: Commuter 110 vs Commuter 125
  {
    id: 'tc-008',
    name: 'Head-to-Head Comparison: Prithvi 110 vs Agni 125',
    category: 'model_comparison',
    description: 'Customer actively comparing fuel economy vs overtaking power between two commuter models.',
    transcript:
      '[00:00:02] Advisor: Welcome! Which models are you considering today?\n' +
      '[00:00:06] Customer: I am confused between Prithvi 110 and Agni 125. How do mileage and power compare?\n' +
      '[00:00:13] Advisor: Prithvi 110 gives 68 kmpl mileage with 8.4 bhp, while Agni 125 gives 58 kmpl with 11.2 bhp for better highway overtaking.\n' +
      '[00:00:21] Customer: That is helpful. Can I test ride both back-to-back to feel the difference?',
    consentGranted: true,
    expected: {
      intentBand: 'high',
      minIntentScore: 70,
      expectedSignals: ['requested_trial_or_test_ride'],
      shouldGenerateDraft: true,
    },
  },

  // 9. Model Comparison: Commuter 125 vs Urban 160R
  {
    id: 'tc-009',
    name: 'Comparison: Agni 125 vs Vayu 160R Performance',
    category: 'model_comparison',
    description: 'Shopper weighing commuting economy against sportier riding dynamics.',
    transcript:
      '[00:00:03] Advisor: Namaste! Looking for daily travel or spirited weekend riding?\n' +
      '[00:00:08] Customer: A bit of both. Is the price jump from Agni 125 to Vayu 160R worth it for weekend highway trips?\n' +
      '[00:00:16] Advisor: The Vayu 160R provides 17.5 bhp, mono-shock rear suspension, and single-channel ABS for highway stability.\n' +
      '[00:00:24] Customer: Send me the EMI options and brochure for both so I can decide this weekend.',
    consentGranted: true,
    expected: {
      intentBand: 'high',
      minIntentScore: 65,
      shouldGenerateDraft: true,
    },
  },

  // 10. Deliberate Knowledge Gap: Off-Road Adventure Suspension (MUST ABSTAIN)
  {
    id: 'tc-010',
    name: 'Deliberate Gap: Uncataloged Adventure Tourer Specs',
    category: 'deliberate_knowledge_gap',
    description: 'Customer asks for Himalayan off-road suspension travel not in vehicle catalog.',
    transcript:
      '[00:00:02] Advisor: Welcome to Vayu Motors! How can I assist you?\n' +
      '[00:00:06] Customer: Does Vayu Motors offer a 250cc Himalayan adventure tourer with 220mm ground clearance?\n' +
      '[00:00:13] Advisor: Our current catalog features the Prithvi 110, Agni 125, Vayu 160R, and electric Vidyut. We do not have a 250cc adventure motorcycle.\n' +
      '[00:00:20] Customer: What about custom off-road suspension kits for Ladakh trips?',
    consentGranted: true,
    expected: {
      intentBand: 'medium',
      isDeliberateGap: true,
      expectedUnresolvedTopics: ['250cc adventure', 'off-road suspension kit'],
      shouldGenerateDraft: true,
    },
  },

  // 11. Deliberate Knowledge Gap: CNG Engine Conversion Kit (MUST ABSTAIN)
  {
    id: 'tc-011',
    name: 'Deliberate Gap: Retrofit CNG Dual-Fuel Kit',
    category: 'deliberate_knowledge_gap',
    description: 'Customer asks for CNG dual fuel retrofit kit not supported by OEM warranty.',
    transcript:
      '[00:00:03] Advisor: Hello! What queries do you have regarding our motorcycles?\n' +
      '[00:00:07] Customer: Can I install an aftermarket CNG kit on the Prithvi 110 and maintain factory warranty?\n' +
      '[00:00:14] Advisor: Let me check our warranty policies regarding third-party fuel conversions.\n' +
      '[00:00:21] Customer: Also let me know if your service center does the RTO approval for CNG fitment.',
    consentGranted: true,
    expected: {
      intentBand: 'medium',
      isDeliberateGap: true,
      expectedUnresolvedTopics: ['CNG kit', 'RTO approval'],
      shouldGenerateDraft: true,
    },
  },

  // 12. Deliberate Knowledge Gap: State Subsidy in Kerala (MUST ABSTAIN)
  {
    id: 'tc-012',
    name: 'Deliberate Gap: Out-of-State EV Government Subsidy',
    category: 'deliberate_knowledge_gap',
    description: 'Inquiring about Kerala state EV subsidies in a Bengaluru showroom.',
    transcript:
      '[00:00:02] Advisor: Namaste! Are you looking into the electric Vidyut scooter?\n' +
      '[00:00:06] Customer: Yes, but I will register it in Kochi. What is the Kerala government electric subsidy amount?\n' +
      '[00:00:13] Advisor: We have current Karnataka state road tax exemptions on file, but Kerala state specific subsidy details are not in our portal.\n' +
      '[00:00:20] Customer: Please confirm the exact Kerala subsidy rebate with your zonal manager.',
    consentGranted: true,
    expected: {
      intentBand: 'medium',
      isDeliberateGap: true,
      expectedUnresolvedTopics: ['Kerala subsidy'],
      shouldGenerateDraft: true,
    },
  },

  // 13. Thin Dialogue: Water Inquiry (MUST ABSTAIN)
  {
    id: 'tc-013',
    name: 'Thin Dialogue: Casual Showroom Water Request',
    category: 'thin_dialogue',
    description: 'Passerby asking for drinking water without commercial intent.',
    transcript:
      '[00:00:02] Customer: Excuse me, is there drinking water available here?\n' +
      '[00:00:05] Advisor: Yes, right by the customer lounge. Please help yourself.\n' +
      '[00:00:08] Customer: Thank you!',
    consentGranted: true,
    expected: {
      intentBand: 'abstained',
      maxIntentScore: 30,
      shouldGenerateDraft: false,
    },
  },

  // 14. Thin Dialogue: Showroom Closing Hours (MUST ABSTAIN)
  {
    id: 'tc-014',
    name: 'Thin Dialogue: Showroom Hours Inquiry',
    category: 'thin_dialogue',
    description: 'Inquiring about showroom closing time without model discussion.',
    transcript:
      '[00:00:02] Customer: Hi, what time does the showroom close today?\n' +
      '[00:00:05] Advisor: We are open until 8:30 PM this evening. Looking for any specific model?\n' +
      '[00:00:09] Customer: No, just passing by. Thank you!',
    consentGranted: true,
    expected: {
      intentBand: 'abstained',
      maxIntentScore: 30,
      shouldGenerateDraft: false,
    },
  },

  // 15. Window Shopper: Killing Time
  {
    id: 'tc-015',
    name: 'Window Shopper: Waiting for Friend',
    category: 'window_shopper',
    description: 'Customer explicitly stating they are browsing casually while waiting for someone.',
    transcript:
      '[00:00:02] Advisor: Hello! Welcome to Vayu Motors. Can I show you our latest models?\n' +
      '[00:00:07] Customer: No thanks, I am just killing time waiting for my friend next door at the coffee shop.\n' +
      '[00:00:13] Advisor: No problem, feel free to browse our showroom display.\n' +
      '[00:00:17] Customer: Sure, thanks.',
    consentGranted: true,
    expected: {
      intentBand: 'low',
      maxIntentScore: 35,
      expectedSignals: ['stated_browsing_only'],
      shouldGenerateDraft: false,
    },
  },

  // 16. Consent Declined: Customer Forbids Follow-Up Contact (MUST GATING)
  {
    id: 'tc-016',
    name: 'Consent Declined: Follow-Up Blocked',
    category: 'consent_declined',
    description: 'Customer interested in Agni 125 but explicitly declines follow-up contact and phone calls.',
    transcript:
      '[00:00:02] Advisor: Namaste! Here is the brochure for the Agni 125.\n' +
      '[00:00:07] Customer: Looks good, but please do NOT call me or message me on WhatsApp. I do not consent to contact.\n' +
      '[00:00:14] Advisor: We respect your privacy completely. We will not reach out.\n' +
      '[00:00:19] Customer: Perfect, I will walk back in if I decide to buy.',
    consentGranted: false, // Consent NOT granted
    expected: {
      intentBand: 'medium',
      shouldGenerateDraft: false, // Must be blocked!
      expectedDraftChannel: 'none',
    },
  },

  // 17. Financing Inquiry: Zero Down-Payment Festive Scheme
  {
    id: 'tc-017',
    name: 'Festive Financing & EMI Calculation',
    category: 'financing_inquiry',
    description: 'Active inquiry into monthly EMI, interest rates, and loan tenure on Agni 125.',
    transcript:
      '[00:00:03] Advisor: Namaste! Interested in our festive finance offers on the Agni 125?\n' +
      '[00:00:08] Customer: Yes, what is the EMI for a 24-month tenure with ₹15,000 down payment?\n' +
      '[00:00:15] Advisor: Monthly EMI comes to approximately ₹3,850 with our partner bank at 8.9% interest.\n' +
      '[00:00:22] Customer: That fits my monthly budget. Can we run a credit pre-qualification right now?',
    consentGranted: true,
    expected: {
      intentBand: 'high',
      minIntentScore: 70,
      expectedSignals: ['asked_pricing_or_discounts'],
      shouldGenerateDraft: true,
    },
  },

  // 18. Exchange Valuation Inquiry: Trading Old 100cc Scooter
  {
    id: 'tc-018',
    name: 'Pre-Owned Vehicle Exchange Valuation',
    category: 'medium_intent',
    description: 'Customer exploring exchange valuation for an 8-year-old scooter toward Prithvi 110.',
    transcript:
      '[00:00:02] Advisor: Welcome to Vayu Motors! Looking to replace your existing two-wheeler?\n' +
      '[00:00:07] Customer: Yes, I have a 2016 100cc scooter. How much exchange valuation can I get against the Prithvi 110?\n' +
      '[00:00:15] Advisor: Typical valuation is ₹12,000 to ₹16,000 plus a ₹3,000 manufacturer exchange bonus.\n' +
      '[00:00:23] Customer: Let me bring the vehicle tomorrow for physical inspection and valuation.',
    consentGranted: true,
    expected: {
      intentBand: 'high',
      minIntentScore: 65,
      shouldGenerateDraft: true,
    },
  },

  // 19. College Student Looking for Lightweight Commuter
  {
    id: 'tc-019',
    name: 'College Student Lightweight Maneuverability',
    category: 'medium_intent',
    description: 'Student checking curb weight and ease of handling in Bengaluru city traffic.',
    transcript:
      '[00:00:03] Advisor: Hello! Looking for a bike for college commutes?\n' +
      '[00:00:07] Customer: Yes, college is near MG Road. Is the Prithvi 110 lightweight and easy to park?\n' +
      '[00:00:14] Advisor: Kerb weight is just 109 kg with a low 785 mm seat height, making it very nimble in traffic.\n' +
      '[00:00:21] Customer: My parents will need to co-sign the booking. Please email me the brochure and color options.',
    consentGranted: true,
    expected: {
      intentBand: 'high',
      minIntentScore: 60,
      shouldGenerateDraft: true,
      expectedDraftChannel: 'email',
    },
  },

  // 20. Fleet Inquiry: Corporate Delivery Courier Fleet
  {
    id: 'tc-020',
    name: 'Corporate Fleet Commercial Inquiries',
    category: 'high_intent',
    description: 'Delivery logistics company looking to purchase 5 units of Prithvi 110 for parcel fleet.',
    transcript:
      '[00:00:02] Advisor: Good morning! How can we assist your business today?\n' +
      '[00:00:06] Customer: We manage a quick-commerce delivery hub and need 5 fuel-efficient bikes for delivery riders.\n' +
      '[00:00:13] Advisor: Prithvi 110 is ideal with 68 kmpl mileage, heavy-duty rear carrier, and low maintenance.\n' +
      '[00:00:20] Customer: Please prepare a commercial quotation for 5 units with fleet corporate discount.',
    consentGranted: true,
    expected: {
      intentBand: 'high',
      minIntentScore: 75,
      shouldGenerateDraft: true,
    },
  },

  // 21. Service Center Complaint Walk-In (Not a Sales Lead)
  {
    id: 'tc-021',
    name: 'Service Center Inquiry & Warranty Repair Walk-In',
    category: 'low_intent',
    description: 'Existing customer asking where to get their first scheduled service done.',
    transcript:
      '[00:00:02] Advisor: Namaste! How can I help you today?\n' +
      '[00:00:05] Customer: My bike completed 1,000 km. Is the first free service done here or at the workshop in Domlur?\n' +
      '[00:00:12] Advisor: Our authorized service center is located 500 meters behind this showroom on 12th Main.\n' +
      '[00:00:17] Customer: Great, thanks for directing me.',
    consentGranted: true,
    expected: {
      intentBand: 'abstained',
      maxIntentScore: 35,
      shouldGenerateDraft: false,
    },
  },

  // 22. Heavy Price Negotiation on Commuter 125
  {
    id: 'tc-022',
    name: 'Aggressive Cash Discount Negotiation',
    category: 'price_objection',
    description: 'Customer willing to buy Agni 125 today only if given a ₹5,000 cash discount and free helmet.',
    transcript:
      '[00:00:02] Advisor: Welcome! Ready to finalize the Agni 125?\n' +
      '[00:00:06] Customer: Only if you give me ₹5,000 direct cash discount and throw in a free ISI helmet. Another dealer offered me that.\n' +
      '[00:00:15] Advisor: Our pricing is fixed by the manufacturer, but we can offer the Pro Commuter kit at 50% discount.\n' +
      '[00:00:23] Customer: That is not good enough. Match their cash discount or I will buy from the other dealer.',
    consentGranted: true,
    expected: {
      intentBand: 'medium',
      expectedObjections: ['price_sensitivity'],
      shouldGenerateDraft: true,
      expectedDraftChannel: 'call_task',
    },
  },
];
