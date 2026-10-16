import PageShell from "@/components/layout/PageShell";
import SealScreen from "@/components/seal/SealScreen";
import { NAV } from "@/lib/nav";

export default function Home() {
  return (
    <PageShell
      nav={NAV}
      title="Seal a file"
      description="Your browser hashes the file. The hash goes on BOT Chain with a timestamp. The file never leaves your machine."
    >
      <SealScreen />
    </PageShell>
  );
}
