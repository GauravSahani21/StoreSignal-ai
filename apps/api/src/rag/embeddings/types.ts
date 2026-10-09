export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
  readonly dimension: number;
  readonly model: string;
}
