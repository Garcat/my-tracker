import AuthGate from "@/components/auth-gate";
import Tracker from "@/components/tracker";

export default function Home() {
  return (
    <AuthGate>
      <Tracker />
    </AuthGate>
  );
}
