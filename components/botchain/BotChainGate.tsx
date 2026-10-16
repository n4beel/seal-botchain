"use client";

import { useAccount, useChainId, useSwitchChain } from "wagmi";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import ConnectButton from "@/components/ui/ConnectButton";
import { activeBotChain, faucetUrl, isBotChainId } from "@/lib/botchain/chain";
import { isDeployed } from "@/lib/botchain/deployment";

/**
 * The preconditions every on-chain screen shares, in one place.
 *
 * Each of these is a state a user can genuinely land in, and each has a different answer.
 * Rendering a form to someone on the wrong network, or one pointed at a contract address that is
 * all zeroes, produces a failure the user cannot diagnose — so nothing renders until the path is
 * real.
 *
 * Wrap only the parts of a page that transact. A read-only view — verifying a record, reading a
 * public certificate — should render for a visitor with no wallet at all, so it goes outside.
 */
export default function BotChainGate({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected) {
    // The connect control renders here rather than a pointer at the header. On a phone the header
    // is cramped, so "connect from the top right" asked the user to hunt for the wallet before
    // they could do the one thing the screen wanted.
    return (
      <Notice title="Wallet not connected">
        <p className="mb-4">Connect an EVM wallet to use {activeBotChain.name}.</p>
        <div style={{ maxWidth: "220px" }}>
          <ConnectButton />
        </div>
      </Notice>
    );
  }

  if (!isBotChainId(chainId)) {
    return (
      <Notice title="Wrong network">
        <p className="mb-4">
          Your wallet is on another network. Switch to {activeBotChain.name} to continue.
        </p>
        <Button
          size="sm"
          variant="ghost"
          loading={isPending}
          onClick={() => switchChain({ chainId: activeBotChain.id })}
          style={{ borderColor: "var(--warning)", color: "var(--warning)" }}
        >
          Switch to {activeBotChain.name}
        </Button>
      </Notice>
    );
  }

  if (!isDeployed(chainId)) {
    const faucet = faucetUrl(chainId);
    return (
      <Notice title="Contract not deployed">
        <p className="mb-3">
          No contract address is configured for {activeBotChain.name}. Deploy with{" "}
          <code style={{ color: "var(--text-secondary)" }}>contracts/script/Deploy.s.sol</code>,
          then set the{" "}
          <code style={{ color: "var(--text-secondary)" }}>NEXT_PUBLIC_CONTRACT_{chainId}</code>{" "}
          and{" "}
          <code style={{ color: "var(--text-secondary)" }}>
            NEXT_PUBLIC_DEPLOY_BLOCK_{chainId}
          </code>{" "}
          variables the script prints.
        </p>
        {faucet && (
          <p style={{ color: "var(--text-tertiary)" }}>
            Test funds:{" "}
            <a href={faucet} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
              {faucet}
            </a>
          </p>
        )}
      </Notice>
    );
  }

  return <>{children}</>;
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full" style={{ maxWidth: "480px" }}>
      <Panel>
        <p
          className="text-[11px] uppercase tracking-[0.04em] mb-2"
          style={{ color: "var(--text-secondary)" }}
        >
          {title}
        </p>
        <div className="text-[12px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
          {children}
        </div>
      </Panel>
    </div>
  );
}
