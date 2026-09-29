import ChangePasswordPanel from '../components/ChangePasswordPanel';
import { useChangePassword } from '../hooks/useChangePassword';

export default function ChangePasswordScreen() {
  const model = useChangePassword();
  return <ChangePasswordPanel model={model} />;
}
