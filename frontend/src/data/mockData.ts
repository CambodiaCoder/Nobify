import { Airdrop, Token, Alert, User } from '../types';

export const mockUser: User = {
  id: '1',
  name: 'Alex Johnson',
  email: 'alex@example.com',
  profileImage: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=150',
  portfolioValue: 15420.68,
  portfolioChange24h: 2.4,
  portfolioChange7d: -1.2
};

export const mockTokens: Token[] = [
  {
    id: '1',
    name: 'Bitcoin',
    symbol: 'BTC',
    logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png',
    amount: 0.5,
    price: 24500.32,
    value: 12250.16,
    change24h: 2.1,
    change7d: -3.4,
    history: Array.from({ length: 30 }, (_, i) => ({
      timestamp: Date.now() - (29 - i) * 24 * 60 * 60 * 1000,
      price: 24000 + Math.random() * 3000
    }))
  },
  {
    id: '2',
    name: 'Ethereum',
    symbol: 'ETH',
    logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    amount: 2.3,
    price: 1380.45,
    value: 3175.03,
    change24h: 3.2,
    change7d: 1.5,
    history: Array.from({ length: 30 }, (_, i) => ({
      timestamp: Date.now() - (29 - i) * 24 * 60 * 60 * 1000,
      price: 1300 + Math.random() * 200
    }))
  },
  {
    id: '3',
    name: 'Solana',
    symbol: 'SOL',
    logo: 'https://cryptologos.cc/logos/solana-sol-logo.png',
    amount: 12,
    price: 32.87,
    value: 394.44,
    change24h: 5.8,
    change7d: 12.4,
    history: Array.from({ length: 30 }, (_, i) => ({
      timestamp: Date.now() - (29 - i) * 24 * 60 * 60 * 1000,
      price: 30 + Math.random() * 10
    }))
  },
  {
    id: '4',
    name: 'Arbitrum',
    symbol: 'ARB',
    logo: 'https://cryptologos.cc/logos/arbitrum-arb-logo.png',
    amount: 500,
    price: 1.22,
    value: 610,
    change24h: -2.5,
    change7d: -5.1,
    history: Array.from({ length: 30 }, (_, i) => ({
      timestamp: Date.now() - (29 - i) * 24 * 60 * 60 * 1000,
      price: 1.1 + Math.random() * 0.3
    }))
  },
  {
    id: '5',
    name: 'Cardano',
    symbol: 'ADA',
    logo: 'https://cryptologos.cc/logos/cardano-ada-logo.png',
    amount: 1200,
    price: 0.32,
    value: 384,
    change24h: 1.4,
    change7d: -2.8,
    history: Array.from({ length: 30 }, (_, i) => ({
      timestamp: Date.now() - (29 - i) * 24 * 60 * 60 * 1000,
      price: 0.3 + Math.random() * 0.1
    }))
  }
];

export const mockAirdrops: Airdrop[] = [
  {
    id: '1',
    name: 'Jupiter',
    symbol: 'JUP',
    logo: '',
    status: 'active',
    eligibility: true,
    deadline: '2025-05-15T23:59:59Z',
    estimatedValue: 120,
    description: 'Jupiter is rewarding users who have used their platform with an airdrop of JUP tokens.'
  },
  {
    id: '2',
    name: 'ZKsync',
    symbol: 'ZKS',
    logo: 'https://cryptologos.cc/logos/zksync-logo.png',
    status: 'upcoming',
    eligibility: true,
    deadline: '2025-06-01T23:59:59Z',
    estimatedValue: 250,
    description: 'ZKsync is airdropping tokens to early users and testers of their Layer 2 scaling solution.'
  },
  {
    id: '3',
    name: 'LayerZero',
    symbol: 'LZ',
    logo: 'https://cryptologos.cc/logos/layerzero-logo.png',
    status: 'completed',
    eligibility: true,
    deadline: '2025-04-01T23:59:59Z',
    estimatedValue: 180,
    description: 'LayerZero rewarded users who bridged assets through their protocol with an airdrop.'
  },
  {
    id: '4',
    name: 'Celestia',
    symbol: 'TIA',
    logo: 'https://cryptologos.cc/logos/celestia-tia-logo.png',
    status: 'upcoming',
    eligibility: false,
    deadline: '2025-05-30T23:59:59Z',
    estimatedValue: 75,
    description: 'Celestia is launching a token airdrop for early adopters of their data availability layer.'
  },
  {
    id: '5',
    name: 'Starknet',
    symbol: 'STRK',
    logo: 'https://cryptologos.cc/logos/starknet-strk-logo.png',
    status: 'missed',
    eligibility: true,
    deadline: '2025-03-15T23:59:59Z',
    estimatedValue: 200,
    description: 'Starknet distributed tokens to users who interacted with dApps on their L2 network.'
  }
];

export const mockAlerts: Alert[] = [
  {
    id: '1',
    type: 'price',
    title: 'BTC exceeds price threshold',
    description: 'Bitcoin has surpassed your set threshold of $24,000',
    timestamp: Date.now() - 5 * 60 * 1000,
    read: false,
    priority: 'high',
    relatedAsset: {
      id: '1',
      name: 'Bitcoin',
      symbol: 'BTC'
    }
  },
  {
    id: '2',
    type: 'airdrop',
    title: 'Jupiter airdrop deadline approaching',
    description: 'The Jupiter airdrop deadline is in 2 days. Make sure to claim your tokens.',
    timestamp: Date.now() - 2 * 60 * 60 * 1000,
    read: true,
    priority: 'medium',
    relatedAsset: {
      id: '1',
      name: 'Jupiter',
      symbol: 'JUP'
    }
  },
  {
    id: '3',
    type: 'news',
    title: 'New airdrop announced: Celestia',
    description: 'Celestia has announced a new airdrop for users of their protocol.',
    timestamp: Date.now() - 1 * 24 * 60 * 60 * 1000,
    read: false,
    priority: 'medium',
    relatedAsset: {
      id: '4',
      name: 'Celestia',
      symbol: 'TIA'
    }
  },
  {
    id: '4',
    type: 'price',
    title: 'SOL price increase',
    description: 'Solana has increased by 5.8% in the last 24 hours.',
    timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000,
    read: true,
    priority: 'low',
    relatedAsset: {
      id: '3',
      name: 'Solana',
      symbol: 'SOL'
    }
  }
];