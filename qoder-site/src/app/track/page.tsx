import AuthGate from "@/components/auth-gate";
import Tracker from "@/components/tracker";

export default function TrackPage() {
  return (
    <AuthGate>
      <Tracker />
    </AuthGate>
  );
}
