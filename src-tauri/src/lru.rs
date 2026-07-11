//! A tiny access-ordered LRU key list. The audio cache uses it to decide which
//! downloaded track files to evict. Pure (no I/O) so it's unit-testable.

/// Tracks up to `cap` keys in most-recently-used order (back = newest).
pub struct Lru {
    cap: usize,
    order: Vec<String>,
}

impl Lru {
    pub fn new(cap: usize) -> Self {
        Lru {
            cap,
            order: Vec::new(),
        }
    }

    /// Marks `id` as most-recently-used (no-op if absent).
    pub fn touch(&mut self, id: &str) {
        if let Some(i) = self.order.iter().position(|x| x == id) {
            let v = self.order.remove(i);
            self.order.push(v);
        }
    }

    /// Inserts (or refreshes) `id` and returns any keys evicted for capacity.
    pub fn insert(&mut self, id: String) -> Vec<String> {
        if self.order.iter().any(|x| x == &id) {
            self.touch(&id);
        } else {
            self.order.push(id);
        }
        let mut evicted = Vec::new();
        while self.order.len() > self.cap {
            evicted.push(self.order.remove(0));
        }
        evicted
    }

    #[cfg(test)]
    pub fn contains(&self, id: &str) -> bool {
        self.order.iter().any(|x| x == id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn evicts_least_recently_used_first() {
        let mut lru = Lru::new(2);
        assert!(lru.insert("a".into()).is_empty());
        assert!(lru.insert("b".into()).is_empty());
        // Over capacity: 'a' (oldest) is evicted.
        assert_eq!(lru.insert("c".into()), vec!["a".to_string()]);
        assert!(lru.contains("b") && lru.contains("c") && !lru.contains("a"));

        // Touch 'b' so 'c' becomes the oldest, then insert 'd'.
        lru.touch("b");
        assert_eq!(lru.insert("d".into()), vec!["c".to_string()]);
        assert!(lru.contains("b") && lru.contains("d") && !lru.contains("c"));
    }

    #[test]
    fn reinserting_refreshes_without_evicting() {
        let mut lru = Lru::new(2);
        lru.insert("a".into());
        lru.insert("b".into());
        // Re-inserting an existing key just refreshes it — no growth, no eviction.
        assert!(lru.insert("a".into()).is_empty());
        assert!(lru.contains("a") && lru.contains("b"));
    }
}
