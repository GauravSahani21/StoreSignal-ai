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
import {
  type IDraftRepository,
  MemoryDraftRepository,
} from './DraftRepository.js';
import {
  type IWorkflowEventRepository,
  MemoryWorkflowEventRepository,
} from './WorkflowEventRepository.js';
import {
  type IWorkflowRepository,
  MemoryWorkflowRepository,
} from './WorkflowRepository.js';

export interface Repositories {
  conversations: IConversationRepository;
  consents: IConsentRepository;
  products: IProductRepository;
  shoppers: IShopperRepository;
  agentRuns: IAgentRunRepository;
  drafts: IDraftRepository;
  workflowEvents: IWorkflowEventRepository;
  workflows: IWorkflowRepository;
}

export function createRepositories(): Repositories {
  return {
    conversations: new MemoryConversationRepository(),
    consents: new MemoryConsentRepository(),
    products: new MemoryProductRepository(),
    shoppers: new MemoryShopperRepository(),
    agentRuns: new MemoryAgentRunRepository(),
    drafts: new MemoryDraftRepository(),
    workflowEvents: new MemoryWorkflowEventRepository(),
    workflows: new MemoryWorkflowRepository(),
  };
}

export * from './types.js';
export * from './ConversationRepository.js';
export * from './ConsentRepository.js';
export * from './ProductRepository.js';
export * from './ShopperRepository.js';
export * from './AgentRunRepository.js';
export * from './DraftRepository.js';
export * from './WorkflowEventRepository.js';
export * from './WorkflowRepository.js';
