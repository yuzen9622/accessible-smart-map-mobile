import { fireEvent, render } from '@testing-library/react-native';

import GoogleSignInButton from '../GoogleSignInButton';

it('keeps the branded appearance and invokes sign-in from the accessible button', async () => {
  const onPress = jest.fn();
  const view = await render(<GoogleSignInButton label="使用 Google 繼續" onPress={onPress} />);
  const button = view.getByRole('button', { name: '使用 Google 繼續' });

  expect(button).toBeEnabled();
  expect(button).toHaveStyle({ height: 48, borderRadius: 12, backgroundColor: '#FFFFFF', borderColor: '#DADCE0' });
  expect(view.getByText('使用 Google 繼續')).toHaveStyle({ fontSize: 19, fontWeight: '600', color: '#1F1F1F' });
  await fireEvent.press(button);
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('blocks sign-in while disabled and allows it again when re-enabled', async () => {
  const onPress = jest.fn();
  const view = await render(<GoogleSignInButton label="使用 Google 繼續" onPress={onPress} disabled />);
  const button = view.getByRole('button', { name: '使用 Google 繼續' });

  expect(button).toBeDisabled();
  expect(button).toHaveStyle({ opacity: 0.5 });
  await fireEvent.press(button);
  expect(onPress).not.toHaveBeenCalled();

  await view.rerender(<GoogleSignInButton label="使用 Google 繼續" onPress={onPress} />);
  expect(view.getByRole('button', { name: '使用 Google 繼續' })).toBeEnabled();
  await fireEvent.press(view.getByRole('button', { name: '使用 Google 繼續' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});
