
// Simple mock implementation of a vector search engine
// In a real application, this would be replaced with a proper vector DB like Faiss

interface Document {
  id: string;
  content: string;
  metadata?: Record<string, any>;
  embedding?: number[];
}

export class MockVectorSearchEngine {
  private documents: Document[] = [];
  private initialized: boolean = false;

  constructor() {
    console.log("Initializing mock vector search engine");
  }

  // Add documents to the index
  public addDocuments(docs: Document[]): void {
    this.documents.push(...docs);
    this.initialized = true;
    console.log(`Added ${docs.length} documents to vector engine. Total: ${this.documents.length}`);
  }

  // Very simple search implementation using string matching
  // Real vector search would use embedding similarity
  public search(query: string, limit: number = 3): Document[] {
    if (!this.initialized || this.documents.length === 0) {
      console.warn("Vector engine not initialized or no documents available");
      return [];
    }

    const queryTerms = query.toLowerCase().split(' ');
    
    // Calculate a simple relevance score for each document
    const scoredDocs = this.documents.map(doc => {
      const content = doc.content.toLowerCase();
      
      // Count how many query terms appear in the document
      let score = queryTerms.reduce((count, term) => {
        return content.includes(term) ? count + 1 : count;
      }, 0);
      
      // Normalize by query length
      score = score / queryTerms.length;
      
      return { doc, score };
    });
    
    // Sort by score and return top results
    return scoredDocs
      .sort((a, b) => b.score - a.score)
      .filter(item => item.score > 0)
      .slice(0, limit)
      .map(item => item.doc);
  }

  // Check if the engine has been initialized
  public isInitialized(): boolean {
    return this.initialized;
  }
}

// Singleton instance
const vectorEngine = new MockVectorSearchEngine();

// Initialize with some sample data
export const initializeVectorEngine = (data: any) => {
  if (vectorEngine.isInitialized()) {
    return;
  }

  // Convert various data sources into searchable documents
  const documents: Document[] = [];

  // Process metrics
  if (data.metrics && Array.isArray(data.metrics)) {
    data.metrics.forEach((metric: any) => {
      documents.push({
        id: `metric_${metric.id}`,
        content: `${metric.label}: ${metric.value}`,
        metadata: { type: 'metric', ...metric }
      });
    });
  }

  // Process charts
  if (data.charts && Array.isArray(data.charts)) {
    data.charts.forEach((chart: any) => {
      // Convert chart data to textual description
      let chartContent = `Chart ${chart.title || chart.id} of type ${chart.type}`;
      
      if (chart.data && Array.isArray(chart.data)) {
        const dataPoints = chart.data.map((point: any) => {
          if (typeof point === 'object') {
            return Object.entries(point)
              .map(([key, value]) => `${key}: ${value}`)
              .join(', ');
          }
          return String(point);
        }).join('; ');
        
        chartContent += ` with data points: ${dataPoints}`;
      }
      
      documents.push({
        id: `chart_${chart.id}`,
        content: chartContent,
        metadata: { type: 'chart', ...chart }
      });
    });
  }

  // Add any additional relevant data
  if (documents.length > 0) {
    vectorEngine.addDocuments(documents);
  }
};

export default vectorEngine;
