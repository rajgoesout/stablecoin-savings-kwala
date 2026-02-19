import { isAddress } from 'viem';
import { sepolia } from 'wagmi/chains';

const rawVaultAddress = process.env.NEXT_PUBLIC_TREASURY_VAULT_ADDRESS;
const rawNairaAddress = process.env.NEXT_PUBLIC_NAIRA_TOKEN_ADDRESS;
const rawUsdcAddress = process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS;
const rawAavePoolAddress = process.env.NEXT_PUBLIC_AAVE_POOL_ADDRESS;

export const TARGET_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_TARGET_CHAIN_ID ?? sepolia.id,
);
export const USE_MOCK_AAVE =
  process.env.NEXT_PUBLIC_USE_MOCK_AAVE === 'true';

export const VAULT_DEPLOY_BLOCK = BigInt(
  process.env.NEXT_PUBLIC_VAULT_DEPLOY_BLOCK ?? 0,
);

export const NAIRA_PER_USDC = BigInt(
  process.env.NEXT_PUBLIC_NAIRA_PER_USDC ?? 1350,
);

export const TREASURY_VAULT_ADDRESS =
  rawVaultAddress && isAddress(rawVaultAddress)
    ? (rawVaultAddress as `0x${string}`)
    : undefined;

export const NAIRA_TOKEN_ADDRESS =
  rawNairaAddress && isAddress(rawNairaAddress)
    ? (rawNairaAddress as `0x${string}`)
    : undefined;

export const USDC_TOKEN_ADDRESS =
  rawUsdcAddress && isAddress(rawUsdcAddress)
    ? (rawUsdcAddress as `0x${string}`)
    : undefined;

export const AAVE_POOL_ADDRESS =
  rawAavePoolAddress && isAddress(rawAavePoolAddress)
    ? (rawAavePoolAddress as `0x${string}`)
    : undefined;

export const erc20Abi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
] as const;

export const treasuryVaultAbi = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'event',
    name: 'FundsReceived',
    anonymous: false,
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'nairaAmount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'FundsSupplied',
    anonymous: false,
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'usdcAmount', type: 'uint256', indexed: false },
    ],
  },
] as const;

export const aavePoolAbi = [
  {
    type: 'function',
    name: 'getReserveData',
    stateMutability: 'view',
    inputs: [{ name: 'asset', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'configuration', type: 'uint256' },
          { name: 'liquidityIndex', type: 'uint128' },
          { name: 'currentLiquidityRate', type: 'uint128' },
          { name: 'variableBorrowIndex', type: 'uint128' },
          { name: 'currentVariableBorrowRate', type: 'uint128' },
          { name: 'currentStableBorrowRate', type: 'uint128' },
          { name: 'lastUpdateTimestamp', type: 'uint40' },
          { name: 'id', type: 'uint16' },
          { name: 'aTokenAddress', type: 'address' },
          { name: 'stableDebtTokenAddress', type: 'address' },
          { name: 'variableDebtTokenAddress', type: 'address' },
          { name: 'interestRateStrategyAddress', type: 'address' },
          { name: 'accruedToTreasury', type: 'uint128' },
          { name: 'unbacked', type: 'uint128' },
          { name: 'isolationModeTotalDebt', type: 'uint128' },
        ],
      },
    ],
  },
] as const;

export const mockAavePoolAbi = [
  {
    type: 'function',
    name: 'getPosition',
    stateMutability: 'view',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'user', type: 'address' },
    ],
    outputs: [
      { name: 'principal', type: 'uint256' },
      { name: 'currentBalance', type: 'uint256' },
      { name: 'currentYield', type: 'uint256' },
      { name: 'lastAccruedAt', type: 'uint64' },
    ],
  },
  {
    type: 'function',
    name: 'getMockAprBps',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;
