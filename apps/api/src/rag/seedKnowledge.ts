import type { KnowledgeStore } from './retrieval/KnowledgeStore.js';

export async function seedKnowledgeBase(
  store: KnowledgeStore,
  orgId = 'org-vayu-motors-dev'
): Promise<number> {
  const kbId = 'kb-vayu-motors-default';

  const documents = [
    {
      filename: 'vayu_motorcycle_specs.md',
      fileType: 'md',
      content: `
# Vayu Motors Product Lineup & Specifications

## Vayu Prithvi 110 (Commuter Motorcycle)
- Category: Daily Commuter
- Engine Displacement: 109.7 cc Single Cylinder, 4-stroke
- Max Power: 8.4 bhp @ 7500 rpm
- Certified Fuel Efficiency / Mileage: 68 kmpl real-world average
- Fuel Tank Capacity: 10 Litres
- Kerb Weight: 112 kg | Seat Height: 790 mm
- Ex-Showroom Price Range: ₹72,000 to ₹78,000
- Standard Warranty: 5 Years or 70,000 km
- Available Colors: Midnight Black, Electric Blue, Scarlet Red

## Vayu Agni 125 (Executive Commuter)
- Category: Premium Commuter
- Engine Displacement: 124.8 cc
- Max Power: 11.2 bhp @ 7500 rpm
- Certified Fuel Efficiency / Mileage: 58 kmpl
- Kerb Weight: 118 kg
- Braking: Front Disc with Synchronized Braking System (SBS)
- Ex-Showroom Price Range: ₹88,000 to ₹95,000
- Standard Warranty: 5 Years or 70,000 km

## Vayu Vidyut S1 (Electric Scooter)
- Battery Pack: 3.8 kWh Lithium-Ion (IP67 Rated)
- Certified Range: 135 km on single charge (Eco Mode)
- Real-World Range: 105 km in City Ride Mode
- Top Speed: 85 kmph
- Home Charging Time: 4.5 hours (0 to 100% via standard 15A socket)
- Ex-Showroom Price Range: ₹1,15,000 to ₹1,28,000
- Battery Warranty: 5 Years or 60,000 km
- Features: Reverse mode, Regenerative braking, Bluetooth navigation
      `.trim(),
    },
    {
      filename: 'vayu_service_schedule.csv',
      fileType: 'csv',
      content: `
Model,Service Type,Interval Odometer,Interval Days,Labour Charge,Engine Oil Cost
Vayu Prithvi 110,1st Free Service,1000 km,30 days,Free,₹350
Vayu Prithvi 110,2nd Free Service,4000 km,120 days,Free,₹350
Vayu Prithvi 110,3rd Free Service,8000 km,240 days,Free,₹350
Vayu Prithvi 110,Periodic Paid Service,12000 km,360 days,₹450,₹350
Vayu Agni 125,1st Free Service,1000 km,30 days,Free,₹420
Vayu Agni 125,Periodic Paid Service,12000 km,360 days,₹550,₹420
Vayu Vidyut S1,1st Free General Inspection,1500 km,60 days,Free,₹0
Vayu Vidyut S1,Annual Inspection,10000 km,365 days,₹600,₹0
      `.trim(),
    },
    {
      filename: 'vayu_showroom_faqs.md',
      fileType: 'md',
      content: `
# Vayu Motors Frequently Asked Questions (FAQ)

## Showroom Test Rides
Customers with a valid permanent Indian two-wheeler driving licence are eligible for free test rides on all models. Helmet is mandatory and provided at the showroom.

## Home Charging Setup for Vayu Vidyut S1
A portable 750W home charger is bundled with every Vidyut S1 scooter. It plugs into any standard 3-pin 15A household socket.
Notice on Accessories: The portable home charger comes with a 1-year replacement warranty.

## Exchange Policy & RTO Registration
Old two-wheelers of any brand can be evaluated at our showroom exchange desk. Showroom handover happens within 48 hours of vehicle registration.
      `.trim(),
    },
    {
      filename: 'vayu_warranty_policy.md',
      fileType: 'md',
      content: `
# Vayu Motors Official Warranty Policy

## Vehicle Warranty Terms
Every petrol motorcycle comes with 5 Years or 70,000 km warranty covering engine, transmission, and chassis against manufacturing defects.
Consumables such as brake pads, tires, bulbs, and cables are not covered under warranty.

## Deliberate Policy Clause on Electricals
Notice on Electrical Equipment: The portable home charger for the electric vehicle series carries a 2-year manufacturer warranty from the date of vehicle delivery.
      `.trim(),
    },
    {
      filename: 'vayu_return_exchange.txt',
      fileType: 'txt',
      content: `
VAYU MOTORS CANCELLATION AND EXCHANGE POLICY
1. Pre-Registration Booking Cancellation: Bookings can be cancelled prior to RTO registration with a flat processing fee of ₹1,000 deducted.
2. Post-Registration: Once RTO registration is issued, vehicles cannot be returned or cancelled under motor vehicle laws.
3. Showroom Defect Exchange: Any mechanical defect identified within 7 days will be repaired under priority warranty at zero customer cost.
      `.trim(),
    },
    {
      filename: 'vayu_availability.md',
      fileType: 'md',
      content: `
# Color Availability and Delivery Timelines

- Vayu Prithvi 110: All colors (Midnight Black, Electric Blue, Scarlet Red) in ready stock in Bengaluru and Mumbai.
- Vayu Agni 125: Blazing Orange delivery timeline is 7 to 10 days. Titanium Grey in ready stock.
- Vayu Vidyut S1: Cyber Cyan waiting period is 14 days due to high demand.
      `.trim(),
    },
  ];

  for (const doc of documents) {
    await store.addDocument({
      orgId,
      knowledgeBaseId: kbId,
      filename: doc.filename,
      fileType: doc.fileType,
      content: doc.content,
      isDemo: true,
    });
  }

  return documents.length;
}
