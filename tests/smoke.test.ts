import { describe, it, expect } from 'vitest';
import config from '../next.config';

describe('build configuration', () => {
  it('exports a fully static site', () => {
    expect(config.output).toBe('export');
  });

  it('disables image optimization so no runtime function is needed', () => {
    expect(config.images?.unoptimized).toBe(true);
  });
});
