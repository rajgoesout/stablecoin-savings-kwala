import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { arbitrum, base, mainnet, optimism, polygon, sepolia } from 'wagmi/chains';

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';

export const config = getDefaultConfig({
  appName: 'Kwala AutoSave',
  projectId: walletConnectProjectId,
  chains: [
    sepolia,
    base,
    mainnet,
    polygon,
    optimism,
    arbitrum,
  ],
  ssr: true,
});
