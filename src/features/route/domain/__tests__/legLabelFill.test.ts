import { contrastRatio } from '@/shared/theme';

import { LEG_LABEL_FILL } from '../routeDisplay';

describe('LEG_LABEL_FILL', () => {
  it.each(Object.entries(LEG_LABEL_FILL))('%s keeps white 13pt text at WCAG AA (≥ 4.5:1)', (_type, fill) => {
    expect(contrastRatio('#FFFFFF', fill)).toBeGreaterThanOrEqual(4.5);
  });
});
