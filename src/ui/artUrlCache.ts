type Entry = {
  promise: Promise<string>;
  url?: string;
  negativeUntil?: number;
};

/** A bounded object-URL cache that temporarily retains failed loads. */
export class ArtUrlCache {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly capacity: number,
    private readonly negativeTtlMs: number,
    private readonly revoke: (url: string) => void,
  ) {}

  get(key: string, load: () => Promise<string>): Promise<string> {
    const existing = this.entries.get(key);
    if (existing && (!existing.negativeUntil || existing.negativeUntil > Date.now())) {
      this.touch(key, existing);
      return existing.promise;
    }
    if (existing) this.entries.delete(key);

    const entry: Entry = { promise: Promise.resolve("") };
    entry.promise = load().then(
      (url) => {
        entry.url = url;
        if (this.entries.get(key) !== entry) this.revoke(url);
        return url;
      },
      (error: unknown) => {
        entry.negativeUntil = Date.now() + this.negativeTtlMs;
        return Promise.reject(error);
      },
    );
    this.entries.set(key, entry);
    this.evict();
    return entry.promise;
  }

  invalidateNegatives(): void {
    for (const [key, entry] of this.entries) {
      if (entry.negativeUntil) this.entries.delete(key);
    }
  }

  private touch(key: string, entry: Entry): void {
    this.entries.delete(key);
    this.entries.set(key, entry);
  }

  private evict(): void {
    while (this.entries.size > this.capacity) {
      const key = this.entries.keys().next().value as string;
      const entry = this.entries.get(key);
      this.entries.delete(key);
      if (entry?.url) this.revoke(entry.url);
    }
  }
}
