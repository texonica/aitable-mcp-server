import { describe, it, expect, vi } from 'vitest';
import { AITableService } from './aitableService.js';

// Mock fetch
const mockFetch = vi.fn();

describe('AITableService', () => {
  it('should throw an error when no API key is provided', () => {
    expect(() => new AITableService('')).toThrow('No API key provided');
  });

  it('should initialize correctly with an API key', () => {
    const service = new AITableService('test-api-key', 'https://api.aitable.ai', mockFetch);
    expect(service).toBeInstanceOf(AITableService);
  });

  it('should use the environment variable if no API key is provided in the constructor', () => {
    process.env.AITABLE_API_KEY = 'env-api-key';
    const service = new AITableService(undefined, 'https://api.aitable.ai', mockFetch);
    expect(service).toBeInstanceOf(AITableService);
    delete process.env.AITABLE_API_KEY;
  });
}); 