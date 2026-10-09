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
import {
  type IOutcomeRepository,
  MemoryOutcomeRepository,
} from './OutcomeRepository.js';
import {
  type IStoreEventRepository,
  MemoryStoreEventRepository,
} from './StoreEventRepository.js';
import {
  type IAuditLogRepository,
  MemoryAuditLogRepository,
} from './AuditLogRepository.js';
import {
  type IUsageEventRepository,
  MemoryUsageEventRepository,
} from './UsageEventRepository.js';
import {
  type IExperimentRepository,
  MemoryExperimentRepository,
} from './ExperimentRepository.js';
import {
  type IUserRepository,
  MemoryUserRepository,
} from './UserRepository.js';

export interface Repositories {
  conversations: IConversationRepository;
  consents: IConsentRepository;
  products: IProductRepository;
  shoppers: IShopperRepository;
  agentRuns: IAgentRunRepository;
  drafts: IDraftRepository;
  workflowEvents: IWorkflowEventRepository;
  workflows: IWorkflowRepository;
  outcomes: IOutcomeRepository;
  storeEvents: IStoreEventRepository;
  auditLogs: IAuditLogRepository;
  usageEvents: IUsageEventRepository;
  experiments: IExperimentRepository;
  users: IUserRepository;
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
    outcomes: new MemoryOutcomeRepository(),
    storeEvents: new MemoryStoreEventRepository(),
    auditLogs: new MemoryAuditLogRepository(),
    usageEvents: new MemoryUsageEventRepository(),
    experiments: new MemoryExperimentRepository(),
    users: new MemoryUserRepository(),
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
export * from './OutcomeRepository.js';
export * from './StoreEventRepository.js';
export * from './AuditLogRepository.js';
export * from './UsageEventRepository.js';
export * from './ExperimentRepository.js';
export * from './UserRepository.js';
