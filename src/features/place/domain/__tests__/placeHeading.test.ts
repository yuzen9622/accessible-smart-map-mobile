import { buildPlaceHeading } from '../placeHeading';

const base = { typeLabel: null, distanceText: null };

describe('buildPlaceHeading', () => {
  it('uses the name as title and the formatted address in the subtitle', () => {
    expect(
      buildPlaceHeading({ ...base, name: '台北101', address: '7, 信義路五段, 西村里, 信義區, 臺北市, 11049, 臺灣', typeLabel: '景點', distanceText: '40 m' }),
    ).toEqual({ title: '台北101', subtitle: '景點 · 40 m · 臺北市信義區信義路五段7號' });
  });

  it('strips a leading place name before formatting', () => {
    expect(buildPlaceHeading({ ...base, name: '安侯建業', address: '安侯建業, 7, 信義路五段, 信義區, 臺北市, 臺灣' })).toEqual({
      title: '安侯建業',
      subtitle: '臺北市信義區信義路五段7號',
    });
  });

  it('uses the formatted address as title without repeating it when there is no name (reverse geocoded point)', () => {
    expect(buildPlaceHeading({ ...base, name: null, address: '7, 信義路五段, 信義區, 臺北市, 臺灣', distanceText: '1.2 km' })).toEqual({
      title: '臺北市信義區信義路五段7號',
      subtitle: '1.2 km',
    });
  });

  it('returns a null subtitle when nothing is known', () => {
    expect(buildPlaceHeading({ ...base, name: '某地', address: null })).toEqual({ title: '某地', subtitle: null });
  });
});
