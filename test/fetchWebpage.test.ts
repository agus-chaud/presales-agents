import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAndValidateUrl } from '../src/tools/implementations/fetchWebpage.js';

describe('fetchWebpage URL validation behavior', () => {
  it('should allow public https urls', () => {
    const result = normalizeAndValidateUrl('https://example.com/about');
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.url.hostname, 'example.com');
    }
  });

  it('should reject localhost and private network targets', () => {
    const localhost = normalizeAndValidateUrl('http://localhost:3000/status');
    assert.equal(localhost.ok, false);

    const privateIpv4 = normalizeAndValidateUrl('http://192.168.1.10/admin');
    assert.equal(privateIpv4.ok, false);
  });

  it('should reject non-http protocols', () => {
    const result = normalizeAndValidateUrl('file:///etc/passwd');
    assert.equal(result.ok, false);
  });
});
