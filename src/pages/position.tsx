import { ConnectButton } from '@rainbow-me/rainbowkit';
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatUnits } from 'viem';
import { useAccount, useBlockNumber, usePublicClient, useReadContract } from 'wagmi';

import {
  AAVE_POOL_ADDRESS,
  aavePoolAbi,
  erc20Abi,
  NAIRA_PER_USDC,
  NAIRA_TOKEN_ADDRESS,
  TARGET_CHAIN_ID,
  TREASURY_VAULT_ADDRESS,
  treasuryVaultAbi,
  USDC_TOKEN_ADDRESS,
  VAULT_DEPLOY_BLOCK,
} from '../lib/contracts';
import styles from '../styles/App.module.css';

type DepositActivity = {
  amount: bigint;
  txHash: `0x${string}`;
  block: bigint;
};

type SupplyActivity = {
  amount: bigint;
};

const USDC_DECIMALS = 6;
const NAIRA_DECIMALS = 6;

const formatNumber = (value: number, precision = 2) =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: precision,
  });

const Position: NextPage = () => {
  const [activities, setActivities] = useState<DepositActivity[]>([]);
  const [supplies, setSupplies] = useState<SupplyActivity[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [lastSyncedBlock, setLastSyncedBlock] = useState<bigint | null>(null);

  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: TARGET_CHAIN_ID });
  const { data: blockNumber } = useBlockNumber({
    chainId: TARGET_CHAIN_ID,
    watch: true,
  });

  const tokenConfigReady = Boolean(
    NAIRA_TOKEN_ADDRESS && TREASURY_VAULT_ADDRESS && USDC_TOKEN_ADDRESS && AAVE_POOL_ADDRESS,
  );

  const { data: tokenSymbolData } = useReadContract({
    abi: erc20Abi,
    address: NAIRA_TOKEN_ADDRESS,
    functionName: 'symbol',
    query: {
      enabled: Boolean(NAIRA_TOKEN_ADDRESS),
    },
  });

  const tokenSymbol = tokenSymbolData ?? 'NAIRA';

  const { data: reserveData } = useReadContract({
    abi: aavePoolAbi,
    address: AAVE_POOL_ADDRESS,
    functionName: 'getReserveData',
    args: USDC_TOKEN_ADDRESS ? [USDC_TOKEN_ADDRESS] : undefined,
    chainId: TARGET_CHAIN_ID,
    query: {
      enabled: Boolean(AAVE_POOL_ADDRESS && USDC_TOKEN_ADDRESS),
    },
  });

  const aTokenAddress = reserveData?.aTokenAddress as `0x${string}` | undefined;

  const { data: aTokenBalance } = useReadContract({
    abi: erc20Abi,
    address: aTokenAddress,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: TARGET_CHAIN_ID,
    query: {
      enabled: Boolean(aTokenAddress && address),
    },
  });

  useEffect(() => {
    setActivities([]);
    setSupplies([]);
    setLastSyncedBlock(null);
  }, [address]);

  useEffect(() => {
    const load = async () => {
      if (!publicClient || !address || !TREASURY_VAULT_ADDRESS) {
        setActivities([]);
        setSupplies([]);
        setLastSyncedBlock(null);
        return;
      }

      setIsLoadingActivity(true);

      try {
        const latestBlock = blockNumber ?? (await publicClient.getBlockNumber());
        const fromBlock =
          lastSyncedBlock === null ? VAULT_DEPLOY_BLOCK : lastSyncedBlock + BigInt(1);

        if (fromBlock > latestBlock) {
          return;
        }

        const maxRange = BigInt(9000);
        const depositLogs: Array<any> = [];
        const supplyLogs: Array<any> = [];

        let cursor = fromBlock;
        while (cursor <= latestBlock) {
          const toBlock =
            cursor + maxRange - BigInt(1) < latestBlock
              ? cursor + maxRange - BigInt(1)
              : latestBlock;

          const [depositChunk, supplyChunk] = await Promise.all([
            publicClient.getLogs({
              address: TREASURY_VAULT_ADDRESS,
              event: treasuryVaultAbi[1],
              args: { user: address },
              fromBlock: cursor,
              toBlock,
            }),
            publicClient.getLogs({
              address: TREASURY_VAULT_ADDRESS,
              event: treasuryVaultAbi[2],
              args: { user: address },
              fromBlock: cursor,
              toBlock,
            }),
          ]);

          depositLogs.push(...depositChunk);
          supplyLogs.push(...supplyChunk);
          cursor = toBlock + BigInt(1);
        }

        const rows: DepositActivity[] = depositLogs
          .map((log) => {
            const amount = log.args.nairaAmount;
            if (amount === undefined) return null;

            return {
              amount,
              txHash: log.transactionHash,
              block: log.blockNumber,
            };
          })
          .filter((item): item is DepositActivity => item !== null)
          .reverse();

        setActivities((prev) => {
          const combined = [...rows, ...prev];
          const seen = new Set<string>();
          return combined.filter((item) => {
            const key = `${item.txHash}-${item.block.toString()}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        });

        setSupplies((prev) => {
          const next = supplyLogs
            .map((log) => {
              const amount = log.args.usdcAmount;
              if (amount === undefined) return null;
              return { amount };
            })
            .filter((item): item is SupplyActivity => item !== null);
          return [...prev, ...next];
        });

        setLastSyncedBlock(latestBlock);
      } finally {
        setIsLoadingActivity(false);
      }
    };

    void load();
  }, [address, publicClient, blockNumber, lastSyncedBlock]);

  const totalDepositedNaira = useMemo(
    () => activities.reduce((sum, row) => sum + row.amount, BigInt(0)),
    [activities],
  );

  const principalUsdc = useMemo(
    () => supplies.reduce((sum, row) => sum + row.amount, BigInt(0)),
    [supplies],
  );
  const currentUsdcBalance = aTokenBalance ?? BigInt(0);
  const yieldUsdc =
    currentUsdcBalance > principalUsdc ? currentUsdcBalance - principalUsdc : BigInt(0);

  const totalBalanceNaira = currentUsdcBalance * NAIRA_PER_USDC;
  const yieldNaira = yieldUsdc * NAIRA_PER_USDC;
  const aprPercent = Number(reserveData?.currentLiquidityRate ?? BigInt(0)) / 1e25;

  return (
    <div className={styles.pageWrap}>
      <Head>
        <title>Kwala AutoSave | Position</title>
        <meta content="Track your NAIRA deposits and Aave yield." name="description" />
      </Head>

      <main className={styles.layout}>
        <header className={styles.topBar}>
          <div>
            <p className={styles.brandLabel}>Kwala</p>
            <h1 className={styles.pageTitle}>My Position</h1>
            <p className={styles.pageSubtitle}>Balances are live from Aave + on-chain events.</p>
          </div>
          <div className={styles.topBarActions}>
            <Link className={styles.secondaryLink} href="/">
              New Deposit
            </Link>
            <ConnectButton />
          </div>
        </header>

        <section className={styles.card}>
          <div className={styles.sectionHeader}>
            <h2>Position Tracking</h2>
            <p>Network: {chainId ?? TARGET_CHAIN_ID}</p>
          </div>

          {!tokenConfigReady && (
            <p className={styles.warningText}>
              Set vault, NAIRA, USDC, and Aave pool addresses in env vars.
            </p>
          )}

          {!isConnected && <p className={styles.warningText}>Connect your wallet to load your position.</p>}

          <div className={styles.metricsPanel}>
            <div className={styles.metricsRow}>
              <span>Total Deposited</span>
              <strong>
                {formatNumber(Number(formatUnits(totalDepositedNaira, NAIRA_DECIMALS)))} {tokenSymbol}
              </strong>
            </div>
            <div className={styles.metricsRow}>
              <span>Current Yield</span>
              <strong>
                {formatNumber(Number(formatUnits(yieldNaira, NAIRA_DECIMALS)))} {tokenSymbol}
              </strong>
            </div>
            <div className={styles.metricsRow}>
              <span>Total Balance</span>
              <strong>
                {formatNumber(Number(formatUnits(totalBalanceNaira, NAIRA_DECIMALS)))} {tokenSymbol}
              </strong>
            </div>
            <div className={styles.metricsRow}>
              <span>APR (Aave Live)</span>
              <strong>{formatNumber(aprPercent, 2)}%</strong>
            </div>
            <div className={styles.metricsRow}>
              <span>Aave Balance (USDC)</span>
              <strong>{formatNumber(Number(formatUnits(currentUsdcBalance, USDC_DECIMALS)))} USDC</strong>
            </div>
          </div>

          <div className={styles.toggleRow}>
            <span>Auto-Invest</span>
            <label className={styles.switch}>
              <input disabled type="checkbox" />
              <span className={styles.slider} />
            </label>
          </div>

          <div className={styles.buttonRow}>
            <button className={styles.disabledButton} disabled type="button">
              Withdraw (Disabled)
            </button>
          </div>

          <div className={styles.activityList}>
            <h3>Activity</h3>
            {isLoadingActivity && <p className={styles.statusText}>Loading on-chain deposits...</p>}
            {!isLoadingActivity && activities.length === 0 && (
              <p className={styles.statusText}>No deposit activity found for this wallet yet.</p>
            )}
            {!isLoadingActivity &&
              activities.map((item) => (
                <div className={styles.activityItem} key={`${item.txHash}-${item.block.toString()}`}>
                  <span>
                    Deposited {formatNumber(Number(formatUnits(item.amount, NAIRA_DECIMALS)))} {tokenSymbol}
                  </span>
                  <small>
                    tx {item.txHash.slice(0, 8)}...{item.txHash.slice(-6)}
                  </small>
                </div>
              ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Position;
