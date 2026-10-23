import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(__dirname, '../../..');
const HEX = /#[0-9A-Fa-f]{8}\b|#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b/;

/** 例外：`'widget'` runtime 不能 import 模組，色碼只能寫在檔案內。 */
const ALLOWED = new Set(['features/navigation/liveActivity/NavigationLiveActivity.tsx']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

function isComment(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
}

describe('色碼只能出現在 shared/theme', () => {
  it('其他檔案一律引用 token', () => {
    const offenders = sourceFiles(SRC).flatMap(file => {
      const rel = relative(SRC, file);
      if (rel.startsWith('shared/theme/') || ALLOWED.has(rel)) return [];
      return readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, index) => (!isComment(line) && HEX.test(line) ? [`${rel}:${index + 1}  ${line.trim()}`] : []));
    });
    expect(offenders).toEqual([]);
  });
});
