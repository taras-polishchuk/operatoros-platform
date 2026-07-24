import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const homepagePath = resolve(import.meta.dirname, '..', '..', 'homepage', 'index.html');

async function homepage(): Promise<string> {
  return readFile(homepagePath, 'utf8');
}

describe('homepage maintained claims and accessibility', () => {
  it('has the basic accessible document and control labels', async () => {
    const html = await homepage();
    expect(html).toContain('<html lang="en">');
    expect(html).toMatch(/<meta name="viewport"/u);
    expect(html).toMatch(/<meta name="description"/u);
    expect(html).toContain('class="skip-link"');
    expect(html).toContain('aria-label="Primary"');
    expect(html).toContain('aria-label="Toggle light and dark theme"');
    expect(html).not.toMatch(/<img(?![^>]*\balt=)[^>]*>/gu);
    expect(html).not.toMatch(/<button(?![^>]*(?:aria-label|>[^<]+<))[^>]*>/gu);
  });

  it('does not reintroduce unsupported or stale public claims', async () => {
    const html = await homepage();
    expect(html).not.toContain('3,850');
    expect(html).not.toMatch(/CLI\s*[·|]\s*API\s*[·|]\s*SDK/u);
    expect(html).not.toContain('✓ run_ref:');
    expect(html).not.toContain('run_0042');
    expect(html).not.toContain('record_0042');
    expect(html).toContain('3,602–4,009');
    expect(html).toContain('in-process dispatcher');
    expect(html).toContain('not a deployed or production-ready hosted service');
    expect(html).toContain('publication pending');
  });

  it('links footer resources to their actual repository documents', async () => {
    const html = await homepage();
    expect(html).toContain('blob/main/CHANGELOG.md');
    expect(html).toContain('blob/main/SECURITY.md');
    expect(html).toContain('blob/main/LICENSE');
    expect(html).not.toMatch(/href="#docs">(?:Changelog|Security|License)/u);
  });
});
