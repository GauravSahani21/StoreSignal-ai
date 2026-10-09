import {
  type IConversationRepository,
  MemoryConversationRepository,
} from './ConversationRepository.js';
import {
  type IConsentRepository,
  MemoryConsentRepository,
} from './ConsentRepository.js';
import {
  type IProductRepository,
  MemoryProductRepository,
} from './ProductRepository.js';
import {
  type IShopperRepository,
  MemoryShopperRepository,
} from './ShopperRepository.js';
import {
  type IAgentRunRepository,
  MemoryAgentRunRepository,
} from './AgentRunRepository.js';

export interface Repositories {
  conversations: IConversationRepository;
  consents: IConsentRepository;
  products: IProductRepository;
  shoppers: IShopperRepository;
  agentRuns: IAgentRunRepository;
}

export function createRepositories(): Repositories {
  return {
    conversations: new MemoryConversationRepository(),
    consents: new MemoryConsentRepository(),
    products: new MemoryProductRepository(),
    shoppers: new MemoryShopperRepository(),
    agentRuns: new MemoryAgentRunRepository(),
  };
}

export * from './types.js';
export * from './ConversationRepository.js';
export * from './ConsentRepository.js';
export * from './ProductRepository.js';
export * from './ShopperRepository.js';
export * from './AgentRunRepository.js';
