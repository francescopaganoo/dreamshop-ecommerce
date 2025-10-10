// Store temporaneo in memoria per i dati degli ordini Klarna
// In produzione, usa Redis o un database per persistenza

interface StoredOrderData {
  orderData: unknown;
  pointsToRedeem: number;
  pointsDiscount: number;
}

interface StoreEntry {
  data: StoredOrderData;
  timestamp: number;
}

class OrderDataStore {
  private store: Map<string, StoreEntry>;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor() {
    this.store = new Map();
    this.cleanupInterval = null;
    this.startCleanup();
  }

  private startCleanup() {
    // Pulisci i dati vecchi ogni 5 minuti
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const thirtyMinutes = 30 * 60 * 1000;

      for (const [key, value] of this.store.entries()) {
        if (now - value.timestamp > thirtyMinutes) {
          console.log('[ORDER-STORE] Pulizia dati scaduti:', key);
          this.store.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }

  set(dataId: string, data: StoredOrderData): void {
    this.store.set(dataId, {
      data,
      timestamp: Date.now()
    });
    console.log('[ORDER-STORE] Dati salvati:', dataId);
  }

  get(dataId: string): StoredOrderData | null {
    const entry = this.store.get(dataId);

    if (!entry) {
      console.error('[ORDER-STORE] Dati non trovati:', dataId);
      return null;
    }

    // Verifica che i dati non siano scaduti (30 minuti)
    const now = Date.now();
    const thirtyMinutes = 30 * 60 * 1000;

    if (now - entry.timestamp > thirtyMinutes) {
      console.error('[ORDER-STORE] Dati scaduti:', dataId);
      this.store.delete(dataId);
      return null;
    }

    console.log('[ORDER-STORE] Dati recuperati:', dataId);
    return entry.data;
  }

  delete(dataId: string): boolean {
    const deleted = this.store.delete(dataId);
    if (deleted) {
      console.log('[ORDER-STORE] Dati eliminati:', dataId);
    }
    return deleted;
  }

  generateId(): string {
    return `klarna_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
export const orderDataStore = new OrderDataStore();
