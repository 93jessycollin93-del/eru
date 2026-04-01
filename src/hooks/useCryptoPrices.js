import { useState, useEffect, useRef } from 'react';

const BASE_PRICES = {
  TON: 5.82, STARS: 0.013, BTC: 67420, ETH: 3480, USDT: 1.00,
  USDC: 1.00, BNB: 580, SOL: 178, DOGE: 0.138, MATIC: 0.82,
  LTC: 82, XRP: 0.52,
};

function jitter(val, pct = 0.003) {
  return val * (1 + (Math.random() - 0.5) * pct);
}

export function useCryptoPrices() {
  const [prices, setPrices] = useState(() =>
    Object.entries(BASE_PRICES).map(([symbol, base]) => ({
      symbol, price: base, change: (Math.random() - 0.5) * 8, base,
    }))
  );
  const ref = useRef(prices);
  ref.current = prices;

  useEffect(() => {
    const interval = setInterval(() => {
      setPrices(prev =>
        prev.map(p => {
          const newPrice = jitter(p.price);
          const change = ((newPrice - p.base) / p.base) * 100;
          return { ...p, price: newPrice, change };
        })
      );
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return prices;
}

export function usePriceMap() {
  const prices = useCryptoPrices();
  const map = {};
  prices.forEach(p => { map[p.symbol] = p; });
  return map;
}