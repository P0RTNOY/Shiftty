const crypto = require('crypto');

module.exports = {
  randomUUID: () => crypto.randomUUID(),
  digestStringAsync: async () => 'mock-hash',
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
};
