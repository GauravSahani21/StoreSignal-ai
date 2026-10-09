import { randomUUID } from 'node:crypto';
import type {
  Experiment,
  ExperimentAssignment,
  ExperimentEvent,
  ExperimentStatus,
  ExperimentTargetType,
  ExperimentVariant,
} from '../../experiments/types.js';

export interface CreateExperimentParams {
  orgId: string;
  name: string;
  hypothesis: string;
  targetType: ExperimentTargetType;
  eligibilityRules?: Experiment['eligibilityRules'];
  trafficAllocationPct?: number;
  minSampleSize?: number;
}

export interface CreateVariantParams {
  orgId: string;
  experimentId: string;
  key: string;
  name: string;
  description?: string;
  weight?: number;
  config?: Record<string, unknown>;
  isControl?: boolean;
}

export interface SaveAssignmentParams {
  orgId: string;
  experimentId: string;
  variantId: string;
  variantKey: string;
  entityType: 'shopper' | 'conversation';
  entityId: string;
}

export interface RecordEventParams {
  orgId: string;
  experimentId: string;
  variantId: string;
  assignmentId?: string;
  entityType: 'shopper' | 'conversation';
  entityId: string;
  eventType: 'exposure' | 'send' | 'response' | 'conversion' | 'cost_recorded';
  value?: number;
  metadata?: Record<string, unknown>;
}

export interface IExperimentRepository {
  createExperiment(params: CreateExperimentParams): Promise<Experiment>;
  getExperimentById(id: string): Promise<Experiment | null>;
  listExperiments(orgId: string, status?: ExperimentStatus): Promise<Experiment[]>;
  updateExperiment(id: string, updates: Partial<Experiment>): Promise<Experiment | null>;
  createVariant(params: CreateVariantParams): Promise<ExperimentVariant>;
  getVariantsByExperimentId(experimentId: string): Promise<ExperimentVariant[]>;
  getAssignment(
    orgId: string,
    experimentId: string,
    entityType: string,
    entityId: string
  ): Promise<ExperimentAssignment | null>;
  saveAssignment(params: SaveAssignmentParams): Promise<ExperimentAssignment>;
  recordEvent(params: RecordEventParams): Promise<ExperimentEvent>;
  getEventsByExperimentId(experimentId: string): Promise<ExperimentEvent[]>;
  importEventsCsv(orgId: string, experimentId: string, csvContent: string): Promise<{ importedCount: number; errors: string[] }>;
}

export class MemoryExperimentRepository implements IExperimentRepository {
  private experiments: Map<string, Experiment> = new Map();
  private variants: Map<string, ExperimentVariant> = new Map();
  private assignments: Map<string, ExperimentAssignment> = new Map();
  private events: Map<string, ExperimentEvent> = new Map();

  async createExperiment(params: CreateExperimentParams): Promise<Experiment> {
    const now = new Date().toISOString();
    const experiment: Experiment = {
      id: `exp-${randomUUID()}`,
      orgId: params.orgId,
      name: params.name,
      hypothesis: params.hypothesis,
      targetType: params.targetType,
      status: 'draft',
      eligibilityRules: params.eligibilityRules ?? {},
      trafficAllocationPct: params.trafficAllocationPct ?? 100,
      minSampleSize: params.minSampleSize ?? 30,
      createdAt: now,
      updatedAt: now,
    };
    this.experiments.set(experiment.id, experiment);
    return experiment;
  }

  async getExperimentById(id: string): Promise<Experiment | null> {
    return this.experiments.get(id) || null;
  }

  async listExperiments(orgId: string, status?: ExperimentStatus): Promise<Experiment[]> {
    return Array.from(this.experiments.values())
      .filter((e) => e.orgId === orgId && (!status || e.status === status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async updateExperiment(id: string, updates: Partial<Experiment>): Promise<Experiment | null> {
    const existing = this.experiments.get(id);
    if (!existing) return null;
    const updated: Experiment = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.experiments.set(id, updated);
    return updated;
  }

  async createVariant(params: CreateVariantParams): Promise<ExperimentVariant> {
    const variant: ExperimentVariant = {
      id: `var-${randomUUID()}`,
      orgId: params.orgId,
      experimentId: params.experimentId,
      key: params.key,
      name: params.name,
      description: params.description,
      weight: params.weight ?? 50,
      config: params.config ?? {},
      isControl: Boolean(params.isControl),
      createdAt: new Date().toISOString(),
    };
    this.variants.set(variant.id, variant);
    return variant;
  }

  async getVariantsByExperimentId(experimentId: string): Promise<ExperimentVariant[]> {
    return Array.from(this.variants.values())
      .filter((v) => v.experimentId === experimentId)
      .sort((a, b) => (b.isControl ? 1 : 0) - (a.isControl ? 1 : 0));
  }

  async getAssignment(
    orgId: string,
    experimentId: string,
    entityType: string,
    entityId: string
  ): Promise<ExperimentAssignment | null> {
    const key = `${orgId}:${experimentId}:${entityType}:${entityId}`;
    return this.assignments.get(key) || null;
  }

  async saveAssignment(params: SaveAssignmentParams): Promise<ExperimentAssignment> {
    const key = `${params.orgId}:${params.experimentId}:${params.entityType}:${params.entityId}`;
    const existing = this.assignments.get(key);
    if (existing) return existing;

    const assignment: ExperimentAssignment = {
      id: `asgn-${randomUUID()}`,
      orgId: params.orgId,
      experimentId: params.experimentId,
      variantId: params.variantId,
      variantKey: params.variantKey,
      entityType: params.entityType,
      entityId: params.entityId,
      assignedAt: new Date().toISOString(),
    };
    this.assignments.set(key, assignment);
    return assignment;
  }

  async recordEvent(params: RecordEventParams): Promise<ExperimentEvent> {
    const event: ExperimentEvent = {
      id: `ev-${randomUUID()}`,
      orgId: params.orgId,
      experimentId: params.experimentId,
      variantId: params.variantId,
      assignmentId: params.assignmentId,
      entityType: params.entityType,
      entityId: params.entityId,
      eventType: params.eventType,
      value: params.value,
      metadata: params.metadata ?? {},
      createdAt: new Date().toISOString(),
    };
    this.events.set(event.id, event);
    return event;
  }

  async getEventsByExperimentId(experimentId: string): Promise<ExperimentEvent[]> {
    return Array.from(this.events.values()).filter((e) => e.experimentId === experimentId);
  }

  async importEventsCsv(
    orgId: string,
    experimentId: string,
    csvContent: string
  ): Promise<{ importedCount: number; errors: string[] }> {
    const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length <= 1) {
      return { importedCount: 0, errors: ['CSV content is empty or contains only headers.'] };
    }

    const header = lines[0]!.toLowerCase().split(',').map((h) => h.trim());
    const variantKeyIdx = header.indexOf('variant_key');
    const entityTypeIdx = header.indexOf('entity_type');
    const entityIdIdx = header.indexOf('entity_id');
    const eventTypeIdx = header.indexOf('event_type');
    const valueIdx = header.indexOf('value');

    if (variantKeyIdx === -1 || entityIdIdx === -1 || eventTypeIdx === -1) {
      return {
        importedCount: 0,
        errors: ['Missing required CSV headers: variant_key, entity_id, event_type'],
      };
    }

    const variants = await this.getVariantsByExperimentId(experimentId);
    const variantMap = new Map<string, string>(); // key -> id
    for (const v of variants) {
      variantMap.set(v.key, v.id);
    }

    let importedCount = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i]!.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      if (row.length < 3) continue;

      const variantKey = row[variantKeyIdx];
      const entityId = row[entityIdIdx];
      const eventType = row[eventTypeIdx] as ExperimentEvent['eventType'];
      const entityType =
        (entityTypeIdx !== -1 && row[entityTypeIdx] === 'conversation'
          ? 'conversation'
          : 'shopper') as 'shopper' | 'conversation';
      const rawValue = valueIdx !== -1 && row[valueIdx] ? parseFloat(row[valueIdx]!) : undefined;

      if (!variantKey || !variantMap.has(variantKey)) {
        errors.push(`Row ${i}: Unknown or missing variant_key "${variantKey}"`);
        continue;
      }
      if (!entityId) {
        errors.push(`Row ${i}: Missing entity_id`);
        continue;
      }

      const validEvents: ExperimentEvent['eventType'][] = [
        'exposure',
        'send',
        'response',
        'conversion',
        'cost_recorded',
      ];
      if (!eventType || !validEvents.includes(eventType)) {
        errors.push(`Row ${i}: Invalid event_type "${eventType}"`);
        continue;
      }

      await this.recordEvent({
        orgId,
        experimentId,
        variantId: variantMap.get(variantKey)!,
        entityType,
        entityId,
        eventType,
        value: !isNaN(rawValue as number) ? rawValue : undefined,
      });

      importedCount++;
    }

    return { importedCount, errors };
  }
}
