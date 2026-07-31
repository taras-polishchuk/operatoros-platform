import { describe, it, expect } from 'vitest';
import { validatePathInside } from '../src/index.js';

describe('validatePathInside helper', () => {
  describe('rejects traversal attacks', () => {
    it('blocks ../etc/passwd', () => {
      expect(() => validatePathInside('/tmp', '/tmp/../etc/passwd')).toThrow('PATH_OUTSIDE_BASE');
    });
    it('blocks ../../escape', () => {
      expect(() => validatePathInside('/var/data', '/var/data/../../etc/shadow')).toThrow(
        'PATH_OUTSIDE_BASE',
      );
    });
    it('blocks /etc/passwd (direct absolute path outside base)', () => {
      expect(() => validatePathInside('/home/user/snapshots', '/etc/passwd')).toThrow(
        'PATH_OUTSIDE_BASE',
      );
    });
    it('blocks /usr/bin/env (sibling directory)', () => {
      expect(() => validatePathInside('/home/user', '/usr/bin/env')).toThrow('PATH_OUTSIDE_BASE');
    });
    it('blocks /var/log/auth.log (looks similar but not same base)', () => {
      expect(() => validatePathInside('/var/data', '/var/log/auth.log')).toThrow(
        'PATH_OUTSIDE_BASE',
      );
    });
  });

  describe('accepts valid paths', () => {
    it('returns absolute path when candidate is inside base', () => {
      const result = validatePathInside('/tmp', '/tmp/foo.json');
      expect(result).toBe('/tmp/foo.json');
    });
    it('accepts baseDir itself', () => {
      const result = validatePathInside('/tmp', '/tmp');
      expect(result).toBe('/tmp');
    });
    it('resolves paths inside base (absolute form after resolve)', () => {
      // The helper resolves both base and candidate against process.cwd(),
      // so to test a "nested" path we give it an absolute candidate under base.
      const result = validatePathInside('/var/data', '/var/data/snapshots/file.json');
      expect(result).toMatch(/\/var\/data\/snapshots\/file\.json$/);
    });
  });
});
