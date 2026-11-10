import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('konfigurasi deployment', () => {
  it('netlify.toml: build, publish dist, SPA redirect', () => {
    const t = read('netlify.toml');
    expect(t).toMatch(/command\s*=\s*"npm run build"/);
    expect(t).toMatch(/publish\s*=\s*"dist"/);
    expect(t).toMatch(/from\s*=\s*"\/\*"/);
    expect(t).toMatch(/to\s*=\s*"\/index\.html"/);
    expect(t).toMatch(/status\s*=\s*200/);
  });
  it('manifest PWA sesuai spesifikasi', () => {
    const v = read('vite.config.ts');
    expect(v).toContain("name: 'HOME TABLE'");
    expect(v).toContain("short_name: 'Home Table'");
    expect(v).toContain('#7A9278');
    expect(v).toContain('#FFFCF7');
    expect(v).toContain("display: 'standalone'");
    expect(existsSync(join(root, 'public/icons/icon-192.png'))).toBe(true);
    expect(existsSync(join(root, 'public/icons/icon-512.png'))).toBe(true);
  });
  it('tidak ada rahasia di kode klien (tanpa prefiks VITE_ untuk kunci)', () => {
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
    for (const f of walk(join(root, 'src')).filter((x) => /\.(ts|tsx)$/.test(x) && !x.includes('/test/'))) {
      const s = readFileSync(f, 'utf8');
      expect(s, f).not.toMatch(/VITE_\w*(KEY|SECRET|TOKEN)/i);
      expect(s, f).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
    }
    expect(read('.env.example')).toContain('YOUTUBE_API_KEY');
    expect(read('.env.example')).not.toMatch(/^VITE_/m);
  });
  it('.gitignore mengecualikan .env dan node_modules', () => {
    const g = read('.gitignore');
    expect(g).toMatch(/node_modules/);
    expect(g).toMatch(/\.env/);
  });
});
