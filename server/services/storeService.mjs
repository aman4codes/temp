import crypto from 'crypto';

// In-memory store for shared items
const sharedItems = new Map();
let totalPurgedCount = 0;

export const storeService = {
  get(code) {
    return sharedItems.get(code);
  },

  set(code, itemData) {
    sharedItems.set(code, itemData);
  },

  delete(code) {
    const deleted = sharedItems.delete(code);
    if (deleted) {
      totalPurgedCount++;
    }
    return deleted;
  },

  has(code) {
    return sharedItems.has(code);
  },

  entries() {
    return sharedItems.entries();
  },

  getActiveCount() {
    return sharedItems.size;
  },

  getTotalPurgedCount() {
    return totalPurgedCount;
  },

  generateUniqueCode() {
    let code;
    let attempts = 0;
    do {
      code = Math.floor(100000 + Math.random() * 900000).toString();
      attempts++;
      if (attempts > 100) {
        code = crypto.randomBytes(3).toString('hex').toUpperCase();
        break;
      }
    } while (sharedItems.has(code));
    return code;
  }
};
