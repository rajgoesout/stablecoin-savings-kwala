import { ConnectButton } from '@rainbow-me/rainbowkit';
import type { NextPage } from 'next';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { formatUnits, parseUnits } from 'viem';
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from 'wagmi';

import {
  erc20Abi,
  NAIRA_TOKEN_ADDRESS,
  TARGET_CHAIN_ID,
  TREASURY_VAULT_ADDRESS,
} from '../lib/contracts';
import styles from '../styles/App.module.css';

const formatAmount = (value: bigint | undefined, decimals: number, precision = 2) => {
  if (value === undefined) return '--';
  const asNum = Number(formatUnits(value, decimals));
  if (!Number.isFinite(asNum)) return '--';
  return asNum.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: precision,
  });
};

const Home: NextPage = () => {
  const [amountInput, setAmountInput] = useState('');
  const [statusText, setStatusText] = useState('Ready to deposit into TreasuryVault.');

  const { address, chainId, isConnected } = useAccount();
  const isWrongNetwork = isConnected && chainId !== TARGET_CHAIN_ID;

  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const publicClient = usePublicClient({ chainId: TARGET_CHAIN_ID });
  const { isPending: isWriting, writeContractAsync } = useWriteContract();

  const tokenConfigReady = Boolean(NAIRA_TOKEN_ADDRESS && TREASURY_VAULT_ADDRESS);

  const { data: tokenDecimalsData } = useReadContract({
    abi: erc20Abi,
    address: NAIRA_TOKEN_ADDRESS,
    functionName: 'decimals',
    chainId,
    query: {
      enabled: Boolean(NAIRA_TOKEN_ADDRESS && chainId),
    },
  });

  const tokenDecimals = Number(tokenDecimalsData ?? 18);

  const { data: tokenSymbolData } = useReadContract({
    abi: erc20Abi,
    address: NAIRA_TOKEN_ADDRESS,
    functionName: 'symbol',
    chainId,
    query: {
      enabled: Boolean(NAIRA_TOKEN_ADDRESS && chainId),
    },
  });

  const tokenSymbol = tokenSymbolData ?? 'NAIRA';

  const { data: balanceData, refetch: refetchBalance } = useReadContract({
    abi: erc20Abi,
    address: NAIRA_TOKEN_ADDRESS,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId,
    query: {
      enabled: Boolean(NAIRA_TOKEN_ADDRESS && address && chainId),
    },
  });

  const { data: allowanceData, refetch: refetchAllowance } = useReadContract({
    abi: erc20Abi,
    address: NAIRA_TOKEN_ADDRESS,
    functionName: 'allowance',
    args:
      address && TREASURY_VAULT_ADDRESS
        ? [address, TREASURY_VAULT_ADDRESS]
        : undefined,
    chainId,
    query: {
      enabled: Boolean(NAIRA_TOKEN_ADDRESS && TREASURY_VAULT_ADDRESS && address && chainId),
    },
  });

  const parsedAmount = useMemo(() => {
    try {
      if (!amountInput || Number(amountInput) <= 0) return undefined;
      return parseUnits(amountInput, tokenDecimals);
    } catch {
      return undefined;
    }
  }, [amountInput, tokenDecimals]);

  const hasEnoughBalance =
    parsedAmount !== undefined && balanceData !== undefined
      ? balanceData >= parsedAmount
      : false;

  const needsApproval =
    parsedAmount !== undefined && allowanceData !== undefined
      ? allowanceData < parsedAmount
      : true;

  const isBusy = isWriting || isSwitching;

  const canSubmit =
    tokenConfigReady &&
    isConnected &&
    !isWrongNetwork &&
    !isBusy &&
    Boolean(publicClient) &&
    parsedAmount !== undefined &&
    hasEnoughBalance;

  const onDeposit = async (event: FormEvent) => {
    event.preventDefault();

    if (
      !canSubmit ||
      !parsedAmount ||
      !NAIRA_TOKEN_ADDRESS ||
      !TREASURY_VAULT_ADDRESS ||
      !publicClient
    ) {
      return;
    }

    try {
      if (needsApproval) {
        setStatusText('Approve NAIRA spending in your wallet...');
        const approveHash = await writeContractAsync({
          abi: erc20Abi,
          address: NAIRA_TOKEN_ADDRESS,
          functionName: 'approve',
          args: [TREASURY_VAULT_ADDRESS, parsedAmount],
        });
        setStatusText(`Approval submitted: ${approveHash.slice(0, 10)}... confirming.`);
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        await refetchAllowance();
      }

      setStatusText('Confirm deposit transaction in wallet...');
      const depositHash = await writeContractAsync({
        abi: [
          {
            type: 'function',
            name: 'deposit',
            stateMutability: 'nonpayable',
            inputs: [{ name: 'amount', type: 'uint256' }],
            outputs: [],
          },
        ],
        address: TREASURY_VAULT_ADDRESS,
        functionName: 'deposit',
        args: [parsedAmount],
      });

      setStatusText(`Deposit submitted: ${depositHash.slice(0, 10)}... waiting for confirmation.`);
      await publicClient.waitForTransactionReceipt({ hash: depositHash });
      await refetchAllowance();
      await refetchBalance();
      setAmountInput('');
      setStatusText('Deposit confirmed successfully.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Transaction failed.';
      setStatusText(message);
    }
  };

  return (
    <div className={styles.pageWrap}>
      <Head>
        <title>KoboNest | Deposit</title>
        <meta
          content="Deposit NAIRA into TreasuryVault and track your stablecoin savings position."
          name="description"
        />
      </Head>

      <main className={styles.layout}>
        <header className={styles.topBar}>
          <div>
            <Image
              alt="KoboNest"
              className={styles.brandLogo}
              height={72}
              priority
              src="/kwala-logo.png"
              width={248}
            />
            <h1 className={styles.pageTitle}>KoboNest</h1>
            <p className={styles.pageSubtitle}>NAIRA stablecoin savings demo</p>
          </div>
          <div className={styles.topBarActions}>
            <Link className={styles.secondaryLink} href="/position">
              Portfolio
            </Link>
            <ConnectButton />
          </div>
        </header>

        <section className={styles.card}>
          <div className={styles.sectionHeader}>
            <h2>Deposit NAIRA</h2>
            <p>Network: {TARGET_CHAIN_ID}</p>
          </div>

          {!tokenConfigReady && (
            <p className={styles.warningText}>
              Set `NEXT_PUBLIC_NAIRA_TOKEN_ADDRESS` and `NEXT_PUBLIC_TREASURY_VAULT_ADDRESS` in env.
            </p>
          )}
          {isWrongNetwork && (
            <div className={styles.warningBox}>
              <p>Wrong network connected. Switch to chain id {TARGET_CHAIN_ID}.</p>
              <button
                className={styles.secondaryButton}
                onClick={() => switchChain({ chainId: TARGET_CHAIN_ID })}
                type="button"
              >
                Switch Network
              </button>
            </div>
          )}

          <form className={styles.depositForm} onSubmit={onDeposit}>
            <label className={styles.fieldLabel} htmlFor="amount">
              Amount ({tokenSymbol})
            </label>
            <input
              className={styles.amountInput}
              id="amount"
              inputMode="decimal"
              min="0"
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="0.00"
              step="any"
              type="number"
              value={amountInput}
            />

            <div className={styles.metricsRow}>
              <span>Wallet balance (selected network)</span>
              <strong>{formatAmount(balanceData, tokenDecimals)} {tokenSymbol}</strong>
            </div>

            <button className={styles.primaryButton} disabled={!canSubmit} type="submit">
              {isBusy ? 'Processing...' : needsApproval ? 'Approve & Deposit' : 'Deposit'}
            </button>

            <button className={styles.disabledButton} disabled type="button">
              Withdraw
            </button>

            {parsedAmount !== undefined && !hasEnoughBalance && (
              <p className={styles.warningText}>Insufficient wallet balance for this deposit.</p>
            )}

            <p className={styles.statusText}>{statusText}</p>
          </form>
        </section>
      </main>
    </div>
  );
};

export default Home;
