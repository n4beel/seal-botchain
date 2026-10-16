"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain, useBalance } from "wagmi";
import { formatUnits } from "viem";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Button from "./Button";
import { activeBotChain, isBotChainId } from "@/lib/botchain/chain";

function truncate(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const menuContentStyle = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border-default)",
  borderRadius: "2px",
} as const;

const menuItemClass =
  "flex items-center gap-3 px-4 py-2.5 text-[13px] cursor-pointer outline-none transition-colors";

/**
 * Connect state for the whole app: connect, wrong-network, and connected-with-balance.
 *
 * Rendered in the header, and again inside `BotChainGate` so a user who lands on a transacting
 * screen can connect without hunting for it.
 */
export default function ConnectButton() {
  const { address, isConnected, chainId, connector } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { data: balance } = useBalance({
    address,
    query: { enabled: Boolean(address) && isBotChainId(chainId) },
  });

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const handleSwitch = useCallback(() => {
    switchChain({ chainId: activeBotChain.id });
  }, [switchChain]);

  if (!mounted) {
    return (
      <button
        className="w-full px-3 py-1.5 text-[11px] font-medium tracking-[0.02em] uppercase"
        style={{
          borderRadius: "2px",
          border: "1px solid var(--border-default)",
          color: "var(--text-secondary)",
          background: "transparent",
        }}
        disabled
      >
        Connect Wallet
      </button>
    );
  }

  if (isPending) {
    return (
      <Button variant="ghost" size="sm" loading className="w-full">
        Connecting
      </Button>
    );
  }

  // Connected but pointed at some other network. Nothing else should render until this is fixed,
  // otherwise the user signs a transaction against the wrong chain.
  //
  // Which wallet, and a way out, both matter here. With more than one EVM extension installed —
  // Phantom also injects one — wagmi reconnects to whichever was last authorised, which may not be
  // the one the user meant. Without the name and the disconnect this state reads as "not connected"
  // and there is nothing to click but a switch that changes the wrong wallet's network.
  if (isConnected && !isBotChainId(chainId)) {
    return (
      <div className="w-full flex flex-col gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={handleSwitch}
          loading={isSwitching}
          style={{ borderColor: "var(--warning)", color: "var(--warning)" }}
        >
          Switch to {activeBotChain.name}
        </Button>
        <div className="flex items-center justify-between gap-2 px-0.5">
          <span
            className="text-[10px] font-mono truncate"
            style={{ color: "var(--text-tertiary)" }}
            title={address}
          >
            {connector?.name ?? "Connected"}
            {address ? ` · ${truncate(address)}` : ""}
          </span>
          <button
            onClick={() => disconnect()}
            className="text-[10px] uppercase tracking-[0.04em] flex-shrink-0"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-tertiary)",
              cursor: "pointer",
            }}
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  if (isConnected && address) {
    return (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors"
            style={{ borderRadius: "2px", border: "1px solid var(--border-default)" }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: "var(--success)" }}
            />
            <span
              className="font-mono text-[12px] truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {truncate(address)}
            </span>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            className="mt-1 w-52 overflow-hidden z-50"
            style={menuContentStyle}
          >
            {balance && (
              <div
                className="px-4 py-2.5 text-[12px] font-mono"
                style={{ color: "var(--text-tertiary)" }}
              >
                {Number(formatUnits(balance.value, balance.decimals)).toFixed(4)}{" "}
                {balance.symbol}
              </div>
            )}
            <DropdownMenu.Separator
              style={{ height: "1px", background: "var(--border-subtle)" }}
            />
            <DropdownMenu.Item
              className={menuItemClass}
              style={{ color: "var(--text-secondary)" }}
              onClick={() => navigator.clipboard.writeText(address)}
            >
              Copy address
            </DropdownMenu.Item>
            <DropdownMenu.Separator
              style={{ height: "1px", background: "var(--border-subtle)" }}
            />
            <DropdownMenu.Item
              className={menuItemClass}
              style={{ color: "var(--danger)" }}
              onClick={() => disconnect()}
            >
              Disconnect
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    );
  }

  // Not connected. EIP-6963 discovery means each installed wallet appears as its own connector, so
  // there is no need to hand-maintain a wallet list.
  if (connectors.length === 1) {
    return (
      <Button
        size="sm"
        className="w-full"
        onClick={() => connect({ connector: connectors[0], chainId: activeBotChain.id })}
      >
        Connect Wallet
      </Button>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button size="sm" className="w-full">
          Connect Wallet
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="mt-1 w-52 overflow-hidden z-50"
          style={menuContentStyle}
        >
          {connectors.map((connector) => (
            <DropdownMenu.Item
              key={connector.uid}
              className={menuItemClass}
              style={{ color: "var(--text-secondary)" }}
              onClick={() => connect({ connector, chainId: activeBotChain.id })}
            >
              {connector.icon && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={connector.icon}
                  alt=""
                  width={16}
                  height={16}
                  className="rounded-sm"
                />
              )}
              {connector.name}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
