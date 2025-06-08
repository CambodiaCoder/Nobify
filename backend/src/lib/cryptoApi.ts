import axios from 'axios';
import NodeCache from 'node-cache';
import { CoinGeckoPrices, AirdropData, CoinGeckoCoin } from '../types/crypto';

// Cache configurations
const priceCache = new NodeCache({ stdTTL: 60, checkperiod: 30 }); // Cache prices for 1 minute
const coinListCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 }); // Cache coin list for 1 hour
const airdropCache = new NodeCache({ stdTTL: 300, checkperiod: 60 }); // Cache airdrops for 5 minutes

const COINGECKO_API_URL = process.env.COINGECKO_API_URL || 'https://api.coingecko.com/api/v3';
const COINMARKETCAP_API_URL = process.env.COINMARKETCAP_API_URL || 'https://pro-api.coinmarketcap.com/v1';

// Rate limiting
let lastApiCall = 0;
const API_RATE_LIMIT = 1000; // 1 second between calls for free tier

// Enhanced price data interface
export interface EnhancedPriceData {
  usd: number;
  usd_24h_change: number;
  usd_24h_vol: number;
  usd_market_cap: number;
  last_updated_at: number;
}

export interface CoinInfo {
  id: string;
  symbol: string;
  name: string;
}

// Symbol to CoinGecko ID mapping for common tokens
const SYMBOL_TO_ID_MAP: Record<string, string> = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'BNB': 'binancecoin',
  'ADA': 'cardano',
  'SOL': 'solana',
  'XRP': 'ripple',
  'DOT': 'polkadot',
  'DOGE': 'dogecoin',
  'AVAX': 'avalanche-2',
  'SHIB': 'shiba-inu',
  'MATIC': 'matic-network',
  'LTC': 'litecoin',
  'UNI': 'uniswap',
  'LINK': 'chainlink',
  'ATOM': 'cosmos',
  'XLM': 'stellar',
  'BCH': 'bitcoin-cash',
  'ALGO': 'algorand',
  'VET': 'vechain',
  'ICP': 'internet-computer',
  'FIL': 'filecoin',
  'TRX': 'tron',
  'ETC': 'ethereum-classic',
  'XMR': 'monero',
  'HBAR': 'hedera-hashgraph',
  'APE': 'apecoin',
  'NEAR': 'near',
  'FLOW': 'flow',
  'MANA': 'decentraland',
  'SAND': 'the-sandbox'
};

// Rate limiting helper
async function rateLimitedApiCall(): Promise<void> {
  const now = Date.now();
  const timeSinceLastCall = now - lastApiCall;

  if (timeSinceLastCall < API_RATE_LIMIT) {
    const waitTime = API_RATE_LIMIT - timeSinceLastCall;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  lastApiCall = Date.now();
}

// Get all coins list for symbol resolution
async function getCoinsList(): Promise<CoinInfo[]> {
  const cacheKey = 'coins_list';
  const cachedList = coinListCache.get(cacheKey) as CoinInfo[] | undefined;

  if (cachedList) {
    return cachedList;
  }

  try {
    await rateLimitedApiCall();
    console.log('Fetching coins list from CoinGecko API');

    const response = await axios.get(`${COINGECKO_API_URL}/coins/list`, {
      timeout: 10000
    });

    const coinsList: CoinInfo[] = response.data.map((coin: any) => ({
      id: coin.id,
      symbol: coin.symbol.toUpperCase(),
      name: coin.name
    }));

    coinListCache.set(cacheKey, coinsList);
    return coinsList;
  } catch (error) {
    console.error('Error fetching coins list:', error);
    return [];
  }
}

// Resolve token symbols to CoinGecko IDs
async function resolveSymbolsToIds(symbols: string[]): Promise<Record<string, string>> {
  const symbolToIdMap: Record<string, string> = {};
  const unknownSymbols: string[] = [];

  // First, try to resolve using the static mapping
  for (const symbol of symbols) {
    const upperSymbol = symbol.toUpperCase();
    if (SYMBOL_TO_ID_MAP[upperSymbol]) {
      symbolToIdMap[upperSymbol] = SYMBOL_TO_ID_MAP[upperSymbol];
    } else {
      unknownSymbols.push(upperSymbol);
    }
  }

  // For unknown symbols, search in the coins list
  if (unknownSymbols.length > 0) {
    try {
      const coinsList = await getCoinsList();

      for (const symbol of unknownSymbols) {
        const coin = coinsList.find(c => c.symbol === symbol);
        if (coin) {
          symbolToIdMap[symbol] = coin.id;
        } else {
          console.warn(`Could not resolve symbol: ${symbol}`);
        }
      }
    } catch (error) {
      console.error('Error resolving symbols:', error);
    }
  }

  return symbolToIdMap;
}

export async function getAirdrops(): Promise<AirdropData[]> {
  const cacheKey = 'airdrops';
  const cachedAirdrops = airdropCache.get(cacheKey) as AirdropData[] | undefined;

  if (cachedAirdrops) {
    console.log('Fetching airdrops from cache');
    return cachedAirdrops;
  }

  let airdrops: AirdropData[] = [];
  try {
    await rateLimitedApiCall();
    console.log('Fetching airdrops from CoinGecko API');

    const response = await axios.get(`${COINGECKO_API_URL}/search/trending`, {
      timeout: 10000
    });

    airdrops = response.data.coins.map((coin: { item: CoinGeckoCoin }) => ({
      id: coin.item.id,
      name: coin.item.name,
      symbol: coin.item.symbol,
      thumb: coin.item.thumb,
      description: `Trending coin: ${coin.item.name}`,
      status: 'active',
      value: 'N/A',
      endDate: 'N/A'
    }));

    airdropCache.set(cacheKey, airdrops);
    return airdrops;
  } catch (error) {
    console.error('Error fetching airdrops:', error);
    return [];
  }
}

// Enhanced price fetching with comprehensive data
export async function getPrices(tokenSymbols: string[]): Promise<Record<string, EnhancedPriceData>> {
  if (tokenSymbols.length === 0) {
    return {};
  }

  // Normalize symbols to uppercase
  const normalizedSymbols = tokenSymbols.map(s => s.toUpperCase());
  const cacheKey = `enhanced_prices_${normalizedSymbols.sort().join(',')}`;
  const cachedPrices = priceCache.get(cacheKey) as Record<string, EnhancedPriceData> | undefined;

  if (cachedPrices) {
    console.log('Fetching enhanced prices from cache');
    return cachedPrices;
  }

  try {
    // Resolve symbols to CoinGecko IDs
    const symbolToIdMap = await resolveSymbolsToIds(normalizedSymbols);
    const coinIds = Object.values(symbolToIdMap);

    if (coinIds.length === 0) {
      console.warn('No valid coin IDs found for symbols:', normalizedSymbols);
      return {};
    }

    await rateLimitedApiCall();
    console.log('Fetching enhanced prices from CoinGecko API for:', coinIds);

    const response = await axios.get(`${COINGECKO_API_URL}/simple/price`, {
      params: {
        ids: coinIds.join(','),
        vs_currencies: 'usd',
        include_24hr_change: 'true',
        include_24hr_vol: 'true',
        include_market_cap: 'true',
        include_last_updated_at: 'true'
      },
      timeout: 15000
    });

    const priceData = response.data;
    const enhancedPrices: Record<string, EnhancedPriceData> = {};

    // Map the response back to symbols
    for (const [symbol, coinId] of Object.entries(symbolToIdMap)) {
      const coinData = priceData[coinId];
      if (coinData) {
        enhancedPrices[symbol.toLowerCase()] = {
          usd: coinData.usd || 0,
          usd_24h_change: coinData.usd_24h_change || 0,
          usd_24h_vol: coinData.usd_24h_vol || 0,
          usd_market_cap: coinData.usd_market_cap || 0,
          last_updated_at: coinData.last_updated_at || Math.floor(Date.now() / 1000)
        };
      } else {
        console.warn(`No price data found for ${symbol} (${coinId})`);
      }
    }

    priceCache.set(cacheKey, enhancedPrices);
    return enhancedPrices;
  } catch (error) {
    console.error('Error fetching enhanced prices:', error);

    // Return fallback data structure for failed requests
    const fallbackPrices: Record<string, EnhancedPriceData> = {};
    for (const symbol of normalizedSymbols) {
      fallbackPrices[symbol.toLowerCase()] = {
        usd: 0,
        usd_24h_change: 0,
        usd_24h_vol: 0,
        usd_market_cap: 0,
        last_updated_at: Math.floor(Date.now() / 1000)
      };
    }
    return fallbackPrices;
  }
}

// Backward compatibility function for existing code
export async function getSimplePrices(tokenSymbols: string[]): Promise<CoinGeckoPrices> {
  const enhancedPrices = await getPrices(tokenSymbols);
  const simplePrices: CoinGeckoPrices = {};

  for (const [symbol, data] of Object.entries(enhancedPrices)) {
    simplePrices[symbol] = {
      usd: data.usd,
      usd_24h_change: data.usd_24h_change
    };
  }

  return simplePrices;
}

// Get historical price for a specific date (useful for transaction cost basis)
export async function getHistoricalPrice(
  tokenSymbol: string,
  date: Date
): Promise<number | null> {
  try {
    const symbolToIdMap = await resolveSymbolsToIds([tokenSymbol.toUpperCase()]);
    const coinId = symbolToIdMap[tokenSymbol.toUpperCase()];

    if (!coinId) {
      console.warn(`Could not resolve symbol: ${tokenSymbol}`);
      return null;
    }

    // Format date as DD-MM-YYYY for CoinGecko API
    const formattedDate = date.toLocaleDateString('en-GB');

    await rateLimitedApiCall();
    console.log(`Fetching historical price for ${tokenSymbol} on ${formattedDate}`);

    const response = await axios.get(`${COINGECKO_API_URL}/coins/${coinId}/history`, {
      params: {
        date: formattedDate,
        localization: false
      },
      timeout: 15000
    });

    const price = response.data?.market_data?.current_price?.usd;
    return price || null;
  } catch (error) {
    console.error(`Error fetching historical price for ${tokenSymbol}:`, error);
    return null;
  }
}

// Batch price updates with error handling and retry logic
export async function batchUpdatePrices(
  tokenSymbols: string[],
  maxRetries: number = 3
): Promise<Record<string, EnhancedPriceData>> {
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt < maxRetries) {
    try {
      const prices = await getPrices(tokenSymbols);

      // Check if we got valid data for at least some tokens
      const validPrices = Object.values(prices).filter(p => p.usd > 0);
      if (validPrices.length > 0) {
        return prices;
      }

      throw new Error('No valid price data received');
    } catch (error) {
      lastError = error as Error;
      attempt++;

      if (attempt < maxRetries) {
        const backoffTime = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`Price fetch attempt ${attempt} failed, retrying in ${backoffTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    }
  }

  console.error(`Failed to fetch prices after ${maxRetries} attempts:`, lastError);

  // Return fallback data
  const fallbackPrices: Record<string, EnhancedPriceData> = {};
  for (const symbol of tokenSymbols) {
    fallbackPrices[symbol.toLowerCase()] = {
      usd: 0,
      usd_24h_change: 0,
      usd_24h_vol: 0,
      usd_market_cap: 0,
      last_updated_at: Math.floor(Date.now() / 1000)
    };
  }
  return fallbackPrices;
}

// Get price alerts data (price targets, significant changes)
export async function getPriceAlerts(
  tokenSymbols: string[],
  thresholdPercentage: number = 5
): Promise<Array<{
  symbol: string;
  currentPrice: number;
  change24h: number;
  isSignificantChange: boolean;
  alertType: 'gain' | 'loss' | 'stable';
}>> {
  try {
    const prices = await getPrices(tokenSymbols);
    const alerts = [];

    for (const [symbol, data] of Object.entries(prices)) {
      const change24h = Math.abs(data.usd_24h_change);
      const isSignificantChange = change24h >= thresholdPercentage;

      let alertType: 'gain' | 'loss' | 'stable' = 'stable';
      if (isSignificantChange) {
        alertType = data.usd_24h_change > 0 ? 'gain' : 'loss';
      }

      alerts.push({
        symbol: symbol.toUpperCase(),
        currentPrice: data.usd,
        change24h: data.usd_24h_change,
        isSignificantChange,
        alertType
      });
    }

    return alerts;
  } catch (error) {
    console.error('Error generating price alerts:', error);
    return [];
  }
}

// Clear all caches (useful for testing or manual refresh)
export function clearPriceCaches(): void {
  priceCache.flushAll();
  coinListCache.flushAll();
  airdropCache.flushAll();
  console.log('All price caches cleared');
}

// Get cache statistics
export function getCacheStats(): {
  priceCache: { keys: number; hits: number; misses: number };
  coinListCache: { keys: number; hits: number; misses: number };
  airdropCache: { keys: number; hits: number; misses: number };
} {
  return {
    priceCache: {
      keys: priceCache.keys().length,
      hits: priceCache.getStats().hits,
      misses: priceCache.getStats().misses
    },
    coinListCache: {
      keys: coinListCache.keys().length,
      hits: coinListCache.getStats().hits,
      misses: coinListCache.getStats().misses
    },
    airdropCache: {
      keys: airdropCache.keys().length,
      hits: airdropCache.getStats().hits,
      misses: airdropCache.getStats().misses
    }
  };
}