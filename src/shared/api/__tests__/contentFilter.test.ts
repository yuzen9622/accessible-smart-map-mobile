import { ApiError } from '../fetch';
import { isObjectionableContentError } from '../contentFilter';

it('recognizes the backend content filter rejection', () => {
  const error = new ApiError('Invalid request.', 400, 'VALIDATION_FAILED', {
    reason: 'VALIDATION_FAILED',
    errors: [{ path: 'comment', message: 'OBJECTIONABLE_CONTENT', code: 'VALIDATION_CUSTOM' }],
  });
  expect(isObjectionableContentError(error)).toBe(true);
});

it('ignores other validation failures and non-API errors', () => {
  const tooLong = new ApiError('Invalid request.', 400, 'VALIDATION_FAILED', {
    errors: [{ path: 'comment', message: 'Too big', code: 'VALIDATION_TOO_BIG' }],
  });
  expect(isObjectionableContentError(tooLong)).toBe(false);
  expect(isObjectionableContentError(new Error('OBJECTIONABLE_CONTENT'))).toBe(false);
});
