import { createRepositories } from '../database/repositories/index.js';
import { seedDatabase } from '../database/seed.js';
import { MockEmbeddingProvider } from '../rag/embeddings/MockEmbeddingProvider.js';
import { KnowledgeStore } from '../rag/retrieval/KnowledgeStore.js';
import { seedKnowledgeBase } from '../rag/seedKnowledge.js';
import { ExperimentService } from '../experiments/ExperimentService.js';
import { AuthService } from '../auth/AuthService.js';

async function runDemoSeed() {
  console.log('================================================================================');
  console.log(' StoreSignal AI — One-Command Showroom Demo Seeder (§15, §19)');
  console.log('================================================================================');
  console.log('Seeding physical showroom environment for Vayu Motors (Bengaluru, KA)...');

  const repos = createRepositories();
  const orgId = 'org-vayu-motors-dev';

  // 1. Seed Products, Shoppers, Conversations, Workflows, Telemetry
  const result = await seedDatabase(repos);
  console.log(`✓ Products seeded: ${result.productCount} vehicle models`);
  console.log(`✓ Shopper profiles seeded: ${result.shopperCount} customer records`);
  console.log(`✓ Real showroom dialogues seeded: ${result.conversationCount} conversations`);

  // 2. Seed Knowledge Documents & RAG chunks with deliberate gaps
  const embeddingProvider = new MockEmbeddingProvider();
  const knowledgeStore = new KnowledgeStore(embeddingProvider);
  await seedKnowledgeBase(knowledgeStore, orgId);
  console.log('✓ Knowledge Base seeded: 6 vehicle specification manuals with deliberate gaps');

  // 3. Seed A/B Experiments
  const experimentService = new ExperimentService(repos);
  await experimentService.seedDemoExperiments(orgId);
  console.log('✓ Campaign Experiments seeded: 2 running experiments with outcome events');

  // 4. Seed Default Users with RBAC roles
  const authService = new AuthService(repos);
  await authService.seedDefaultUsers(orgId);
  console.log('✓ Auth & RBAC accounts seeded:');
  console.log('  • Admin:   admin@storesignal.ai   / AdminPassword123!   (Role: admin)');
  console.log('  • Manager: manager@storesignal.ai / ManagerPassword123! (Role: manager, Indiranagar)');
  console.log('  • Advisor: advisor@storesignal.ai / AdvisorPassword123! (Role: advisor, Indiranagar)');

  console.log('--------------------------------------------------------------------------------');
  console.log('✅ DEMO ENVIRONMENT SEEDED SUCCESSFULLY!');
  console.log('Run "npm run dev" and navigate to http://localhost:5173 to explore the platform.');
  console.log('================================================================================');
}

runDemoSeed().catch((err) => {
  console.error('Failed to seed demo data:', err);
  process.exit(1);
});
