import { EmbeddingProvider } from '@/lib/types';

export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'local-embedding';
  readonly name = 'Local Bag-of-Words & Semantic Embedding Engine';

  // Generates normalized fixed-length vector from text features
  async embed(text: string): Promise<number[]> {
    const vectorLength = 128;
    const vector = new Array(vectorLength).fill(0);
    const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      let hash = 0;
      for (let j = 0; j < word.length; j++) {
        hash = (hash << 5) - hash + word.charCodeAt(j);
        hash |= 0;
      }
      const idx = Math.abs(hash) % vectorLength;
      vector[idx] += 1;
    }

    // Normalize vector (L2 norm)
    let sumSq = 0;
    for (let i = 0; i < vectorLength; i++) {
      sumSq += vector[i] * vector[i];
    }
    const norm = Math.sqrt(sumSq) || 1;
    return vector.map(v => v / norm);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(t => this.embed(t)));
  }

  static cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dot / denominator;
  }
}

export const embeddingProvider: EmbeddingProvider = new LocalEmbeddingProvider();
