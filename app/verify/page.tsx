import PageShell from "@/components/layout/PageShell";
import VerifyScreen from "@/components/seal/VerifyScreen";
import { NAV } from "@/lib/nav";

export const metadata = {
  title: "Verify a seal — Seal",
  description: "Check whether a file has been timestamped on BOT Chain. No wallet needed.",
};

export default function Verify() {
  return (
    <PageShell
      nav={NAV}
      title="Verify a seal"
      description="Drop the file, or paste its digest. No wallet needed to check."
    >
      <VerifyScreen />
    </PageShell>
  );
}
