import { parseEnvironment } from '../environment';

describe('parseEnvironment', () => {
  it('parses a fully available response', () => {
    const result = parseEnvironment({
      weather: { status: 'ok', temperature: 28.5, precipitationProbability: 20, condition: '多雲' },
      airQuality: { status: 'ok', pm25: 12, quality: '良好', advice: '適合戶外活動' },
    });
    expect(result).toEqual({
      weather: { status: 'ok', temperature: 28.5, precipitationProbability: 20, condition: '多雲' },
      airQuality: { status: 'ok', pm25: 12, quality: '良好', advice: '適合戶外活動' },
    });
  });

  it('degrades each source independently', () => {
    const result = parseEnvironment({
      weather: { status: 'unavailable', reason: 'upstream_http_error' },
      airQuality: { status: 'ok', pm25: 40, quality: '普通', advice: null },
    });
    expect(result.weather.status).toBe('unavailable');
    expect(result.weather.temperature).toBeNull();
    expect(result.airQuality.status).toBe('ok');
    expect(result.airQuality.pm25).toBe(40);
  });

  it('never throws on malformed input', () => {
    expect(parseEnvironment(null)).toEqual({
      weather: { status: 'unavailable', temperature: null, precipitationProbability: null, condition: null },
      airQuality: { status: 'unavailable', pm25: null, quality: null, advice: null },
    });
    expect(parseEnvironment('not an object')).toEqual({
      weather: { status: 'unavailable', temperature: null, precipitationProbability: null, condition: null },
      airQuality: { status: 'unavailable', pm25: null, quality: null, advice: null },
    });
  });
});
