import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(__dirname, '../../..');

const RULES: { name: string; pattern: RegExp; hint: string; allow?: string[] }[] = [
  { name: 'fontSize 字面值', pattern: /fontSize: \d/, hint: '改用 TYPE.*' },
  { name: 'borderRadius 字面值', pattern: /borderRadius: \d/, hint: '改用 SHAPE.*' },
  { name: '舊式陰影', pattern: /shadow(Color|Opacity|Radius|Offset):|\belevation: \d/, hint: '改用 boxShadow: ELEVATION.*' },
  { name: '舊式按壓回饋', pattern: /android_ripple|pressed && styles\./, hint: '改用 PressableScale' },
  {
    name: '裸 Pressable',
    pattern: /<Pressable[\s>]/,
    hint: '改用 PressableScale（全螢幕背景遮罩除外）',
    allow: ['features/place/components/CategoryNameModal.tsx', 'shared/ui/actions/MoreActionsModal.tsx', 'shared/ui/PressableScaleBase.tsx'],
  },
  { name: '字重 500／800', pattern: /fontWeight: '(500|800)'/, hint: '字重只有 400／600／700' },
];

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

describe.each(RULES)('樣式字面值：$name', ({ pattern, hint, allow = [] }) => {
  it(`shared/theme 以外一律${hint}`, () => {
    const offenders = sourceFiles(SRC).flatMap(file => {
      const rel = relative(SRC, file);
      if (rel.startsWith('shared/theme/') || allow.includes(rel)) return [];
      return readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, index) => (!isComment(line) && pattern.test(line) ? [`${rel}:${index + 1}  ${line.trim()}`] : []));
    });
    expect(offenders).toEqual([]);
  });
});
