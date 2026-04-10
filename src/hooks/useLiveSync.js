import { useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

const WS_URL = 'wss://stream.binance.com:9443/stream?streams=btcusdt@ticker/ethusdt@ticker/solusdt@ticker/bnbusdt@ticker/xrpusdt@ticker/dogeusdt@ticker';
const WS_SYMBOL_MAP = {
  BTCUSDT: 'BTC',
  ETHUSDT: 'ETH',
  SOLUSDT: 'SOL',
  BNBUSDT: 'BNB',
  XRPUSDT: 'XRP',
  DOGEUSDT: 'DOGE',
};
const FALLBACK_SYMBOLS = {
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
const FALLBACK_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,toncoin,solana,dogecoin,litecoin,ripple,binancecoin,matic-network,usd-coin,tether&vs_currencies=usd&include_24hr_change=true';

function mapFallbackPrices(data) {
  return Object.entries(data || {}).map(([id, value]) => ({
    symbol: FALLBACK_SYMBOLS[id] || id.toUpperCase(),
    price: value.usd,
    change: value.usd_24h_change ?? 0,
    source: 'fallback',
  }));
}

export function useLiveMarketPrices() {
  const [prices, setPrices] = useState([]);
  const [status, setStatus] = useState('loading');
  const [lastUpdated, setLastUpdated] = useState(null);
  const socketRef = useRef(null);
  const reconnectRef = useRef(null);
  const fallbackRef = useRef(null);
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;

    const fetchFallback = async () => {
      const response = await fetch(FALLBACK_URL);
      if (!response.ok) throw new Error('Fallback API error');
      const data = await response.json();
      setPrices(mapFallbackPrices(data));
      setStatus('live');
      setLastUpdated(new Date());
    };

    const connect = () => {
      const socket = new WebSocket(WS_URL);
      socketRef.current = socket;

      socket.onopen = async () => {
        setStatus('live');
        clearInterval(fallbackRef.current);
        fallbackRef.current = null;
        await fetchFallback();
      };

      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        const ticker = payload?.data;
        const symbol = WS_SYMBOL_MAP[ticker?.s];
        if (!symbol) return;

        setPrices((prev) => {
          const nextItem = {
            symbol,
            price: Number(ticker.c || 0),
            change: Number(ticker.P || 0),
            source: 'websocket',
          };
          const existing = prev.find((item) => item.symbol === symbol);
          const next = existing
            ? prev.map((item) => item.symbol === symbol ? nextItem : item)
            : [...prev, nextItem];
          return next.sort((a, b) => a.symbol.localeCompare(b.symbol));
        });
        setStatus('live');
        setLastUpdated(new Date());
      };

      socket.onerror = async () => {
        setStatus('error');
        await fetchFallback();
        if (!fallbackRef.current) {
          fallbackRef.current = setInterval(fetchFallback, 60000);
        }
      };

      socket.onclose = () => {
        if (unmountedRef.current) return;
        reconnectRef.current = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      unmountedRef.current = true;
      clearTimeout(reconnectRef.current);
      clearInterval(fallbackRef.current);
      socketRef.current?.close();
    };
  }, []);

  return { prices, status, lastUpdated };
}

export function useLivePriceMap() {
  const { prices, status, lastUpdated } = useLiveMarketPrices();
  const map = useMemo(() => Object.fromEntries(prices.map((item) => [item.symbol, item])), [prices]);
  return { prices, map, status, lastUpdated };
}

export function useRealtimeEntityList(entityName, options = {}) {
  const { query = {}, sort = '-updated_date', limit = 50, enabled = true } = options;
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled || !entityName) {
      setLoading(false);
      return;
    }

    let unsubscribe = null;

    const load = async () => {
      const sdk = base44.entities[entityName];
      if (!sdk) {
        setData([]);
        setLoading(false);
        return;
      }
      const rows = Object.keys(query).length > 0
        ? await sdk.filter(query, sort, limit)
        : await sdk.list(sort, limit);
      setData(rows || []);
      setLoading(false);
    };

    load();
    unsubscribe = base44.entities[entityName].subscribe(() => load());

    return () => unsubscribe?.();
  }, [entityName, enabled, sort, limit, JSON.stringify(query)]);

  return { data, loading };
}

export function useRealtimeAgentStatus(bots = []) {
  const [agentStatus, setAgentStatus] = useState({});

  useEffect(() => {
    const buildStatus = async () => {
      const [automations, improvements] = await Promise.all([
        base44.entities.BotAutomation.list('-updated_date', 100),
        base44.entities.BotImprovement.list('-created_date', 100),
      ]);

      const next = {};
      bots.forEach((bot) => {
        const botAutomations = automations.filter((item) => item.bot_id === bot.id);
        const latestImprovement = improvements.find((item) => (item.goal || '').toLowerCase().includes((bot.name || '').toLowerCase()));
        next[bot.id] = {
          status: botAutomations.some((item) => item.status === 'active') ? 'active' : 'idle',
          lastRunAt: botAutomations[0]?.last_run_at || latestImprovement?.created_date || null,
          runCount: botAutomations.reduce((sum, item) => sum + (item.run_count || 0), 0),
        };
      });
      setAgentStatus(next);
    };

    if (!bots.length) {
      setAgentStatus({});
      return;
    }

    buildStatus();
    const unsubscribeAutomation = base44.entities.BotAutomation.subscribe(() => buildStatus());
    const unsubscribeImprovement = base44.entities.BotImprovement.subscribe(() => buildStatus());

    return () => {
      unsubscribeAutomation?.();
      unsubscribeImprovement?.();
    };
  }, [JSON.stringify(bots.map((bot) => bot.id))]);

  return agentStatus;
}