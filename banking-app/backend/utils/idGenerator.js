const crypto = require('crypto');

/**
 * Timestamp-only IDs (`PREFIX-${Date.now()}`) collide whenever two requests land in the same
 * millisecond, which happens routinely under concurrent/parallel load (e.g. parallel test workers
 * hitting /register or /transfer at once), producing UNIQUE constraint failures. Appending a random
 * suffix keeps IDs sortable/timestamp-prefixed while making same-millisecond collisions negligible.
 */
function generateId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

module.exports = { generateId };
