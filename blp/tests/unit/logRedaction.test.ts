import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { redactLog, ensureNoPii } from '@haizel/observability';

describe('log redaction', () => {
  it('redacts SSN patterns', () => {
    const result = redactLog('borrower ssn 123-45-6789');
    assert.equal(result.includes('***REDACTED***'), true);
  });

  it('throws when PII detected', () => {
    assert.throws(() => ensureNoPii('123-45-6789'));
  });
});
