import { useState, useEffect, useRef } from 'react';

// CoinGecko free API - no key required
const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,toncoin,solana,dogecoin,litecoin,ripple,binancecoin,matic-network,usd-coin,tether&vs_currencies=usd&include_24hr_change=true';

const ID_MAP = {
  bitcoin: 'BTC',
  ethereum: 'ETH',
  toncoin: 'TON',
  solana: 'SOL',
  dogecoin: 'DOGE',
  litecoin: 'LTC',
  ripple: 'XRP',
  binancecoin: 'BNB',
  'matic-network': 'MATIC',
  'usd-coin': 'USDC',
  tether: 'USDT',
};

export function useRealPrices() {
  const [prices, setPrices] = useState([]);
  const [status, setStatus] = useState('loading'); // 'loading' | 'live' | 'error'
  const [lastUpdated, setLastUpdated] = useState(null);
  const timerRef = useRef(null);

  const fetch_ = async () => {
    try {
      const res = await fetch(COINGECKO_URL);
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      const mapped = Object.entries(data).map(([id, v]) => ({
        symbol: ID_MAP[id] || id.toUpperCase(),
        price: v.usd,
        change: v.usd_24h_change ?? 0,
      }));
      setPrices(mapped);
      setStatus('live');
      setLastUpdated(new Date());
    } catch {
      setStatus('error');
    }
  };

  useEffect(() => {
    fetch_();
    timerRef.current = setInterval(fetch_, 60_000); // refresh every 60s
    return () => clearInterval(timerRef.current);
  }, []);

  return { prices, status, lastUpdated };
}

export function useRealPriceMap() {
  const { prices, status, lastUpdated } = useRealPrices();
  const map = {};
  prices.forEach(p => { map[p.symbol] = p; });
  return { map, status, lastUpdated };
}