import EmergencyContactsPanel from '../components/EmergencyContactsPanel';
import { useEmergencyContacts } from '../hooks/useEmergencyContacts';

export default function EmergencyContactsScreen() {
  return <EmergencyContactsPanel model={useEmergencyContacts()} />;
}
