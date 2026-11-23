import { describe, it, expect } from 'vitest';
import { redactSecrets } from '../src/generator/ai-generator.js';

describe('redactSecrets', () => {
  it('redacts API key patterns', () => {
    const input = 'config.api_key = "sk-abc123xyz789";';
    const result = redactSecrets(input);
    expect(result).toContain('[REDACTED]');
    expect(result).not.toContain('sk-abc123xyz789');
  });

  it('redacts password patterns', () => {
    const input = 'password: "super-secret-password"';
    const result = redactSecrets(input);
    expect(result).toContain('[REDACTED]');
    expect(result).not.toContain('super-secret-password');
  });

  it('redacts JWT tokens', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const result = redactSecrets(`token = "${jwt}"`);
    expect(result).toContain('[REDACTED]');
  });

  it('redacts AWS access keys', () => {
    const input = 'AKIAIOSFODNN7EXAMPLE is my key';
    const result = redactSecrets(input);
    expect(result).toContain('[REDACTED]');
  });

  it('leaves normal code unchanged', () => {
    const input = 'function hello() { return "world"; }';
    const result = redactSecrets(input);
    expect(result).toBe(input);
  });

  it('handles empty string', () => {
    expect(redactSecrets('')).toBe('');
  });
});
