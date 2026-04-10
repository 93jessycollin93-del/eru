import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { logger } from '@/lib/logger';
import { fetchUserGold, awardGold } from '@/lib/economyApi';
import { STARTER_CARDS, ELEMENT_COLORS } from '../components/cards/StarterCards';
import CardDisplay from '../components/cards/CardDisplay';
import BattleView from '../components/cards/BattleView';
import { Sword, Trophy, Package, Layers, Coins, ShoppingCart } from 'lucide-react';
import Marketplace from '../components/cards/Marketplace';

const TOURNAMENT_ROUNDS = [
  { id: 1, name: 'Novice Challenger', difficulty: 1, faction: 'Ember Clan',    prize: { gold: 50,  discover: true } },
  { id: 2, name: 'Adept Warrior',     difficulty: 2, faction: 'Stone Legion',  prize: { gold: 100, discover: true } },
  { id: 3, name: 'Grand Master',      difficulty: 3, faction: 'Tide Order',    prize: { gold: 250, discover: true } },
];

const TABS = [
  { id: 'collection', label: 'Collection', icon: Package },
  { id: 'deck',       label: 'Deck',       icon: Layers },
  { id: 'tournament', label: 'Tournament', icon: Trophy },
  { id: 'market',     label: 'Market',     icon: ShoppingCart },
];

export default function CardArena() {
  const [tab, setTab] = useState('collection');
  const [cards, setCards] = useState([]);
  const [deck, setDeck] = useState([]);
  const [gold, setGold] = useState(0);
  const [goldLoading, setGoldLoading] = useState(true);
  const [tournamentRound, setTournamentRound] = useState(0);
  const [battling, setBattling] = useState(false);
  const [currentRound, setCurrentRound] = useState(null);
  const [roundResults, setRoundResults] = useState([]);
  const [discoveredCard, setDiscoveredCard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCards();
    loadGold();
  }, []);

  const loadGold = async () => {
    try {
      setGoldLoading(true);
      const balance = await fetchUserGold();
      setGold(balance);
    } catch (err) {
      logger.error('Failed to load gold:', err);
      toast.error('Unable to load gold balance');
    } finally {
      setGoldLoading(false);
    }
  };

  const loadCards = async () => {
    try {
      setLoading(true);
      const owned = await base44.entities.Card.list('-created_date', 100);
      const ownedIds = new Set(owned.map(c => c.name));
      const starters = STARTER_CARDS.filter(c => !ownedIds.has(c.name));
      setCards([...owned, ...starters]);
      if (owned.length === 0) setDeck(STARTER_CARDS.slice(0, 5));
      else setDeck(owned.slice(0, 5));
    } catch (err) {
      logger.error('Failed to load cards:', err);
      toast.error('Unable to load your card collection');
      // Fall back to starter cards so the UI is still usable.
      setCards([...STARTER_CARDS]);
      setDeck(STARTER_CARDS.slice(0, 5));
    } finally {
      setLoading(false);
    }
  };

  const saveGold = async (amount) => {
    setGold(amount);
    // Backend handles persistence via awardGold/deductGold
  };

  const toggleDeckCard = (card) => {
    setDeck(prev => {
      const has = prev.find(c => c.id === card.id);
      if (has) return prev.filter(c => c.id !== card.id);
      if (prev.length >= 5) return [...prev.slice(1), card];
      return [...prev, card];
    });
  };

  const startTournament = () => {
    setTournamentRound(1);
    setRoundResults([]);
    setCurrentRound(TOURNAMENT_ROUNDS[0]);
    setBattling(true);
  };

  const handleBattleEnd = async (won, aiBoardPower, aiDeck) => {
    const round = TOURNAMENT_ROUNDS[tournamentRound - 1];
    const newResults = [...roundResults, { round: tournamentRound, won }];
    setRoundResults(newResults);

    if (won) {
      // Award gold via secure backend endpoint
      try {
        const newGold = await awardGold(round.prize.gold, `Tournament round ${tournamentRound} win`, {
          round: tournamentRound,
          difficulty: round.difficulty
        });
        setGold(newGold);
      } catch (err) {
        logger.error('Failed to award gold:', err);
        toast.error('Unable to award tournament prize');
        return;
      }

      const discoverChance = 0.4 + (tournamentRound - 1) * 0.1;
      if (Math.random() < discoverChance && round.prize.discover) {
        const factionPool = STARTER_CARDS.filter(c => c.faction === round.faction);
        const discovered = factionPool[Math.floor(Math.random() * factionPool.length)];
        if (discovered) {
          const saved = await base44.entities.Card.create({
            ...discovered,
            id: undefined,
            quantity: 1,
          });
          setDiscoveredCard({ ...discovered, saved: true });
          setCards(prev => [...prev, saved]);
        }
      }

      if (tournamentRound >= 3) {
        setBattling(false);
        setTournamentRound(4);
      } else {
        setTimeout(() => {
          const nextRound = tournamentRound + 1;
          setTournamentRound(nextRound);
          setCurrentRound(TOURNAMENT_ROUNDS[nextRound - 1]);
          setBattling(true);
          setDiscoveredCard(null);
        }, discoveredCard ? 3000 : 2000);
      }
    } else {
      setBattling(false);
      setTournamentRound(0);
    }
  };

  const resetTournament = () => {
    setTournamentRound(0);
    setBattling(false);
    setCurrentRound(null);
    setRoundResults([]);
    setDiscoveredCard(null);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Sword className="w-5 h-5 text-primary" /> Card Arena
          </h2>
          <p className="text-[10px] text-muted-foreground">Deck · Battle · Tournament</p>
        </div>
        <div className="flex items-center gap-1.5 bg-yellow-400/10 border border-yellow-400/20 rounded-xl px-3 py-1.5">
          <Coins className="w-3.5 h-3.5 text-yellow-400" />
          <span className="text-sm font-bold text-yellow-400">{gold.toLocaleString()}</span>
        </div>
      </div>

      <div className="flex border-b border-border">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2
              ${tab === t.id ? 'text-primary border-primary' : 'text-muted-foreground border-transparent'}`}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'collection' && (
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-3">{cards.length} Cards Owned</p>
            {loading ? (
              <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <div className="flex flex-wrap gap-2 justify-center">
                {cards.map(card => (
                  <CardDisplay key={card.id} card={card} size="md"
                    selected={deck.some(c => c.id === card.id)}
                    onClick={toggleDeckCard} />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'deck' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Active Deck <span className="text-muted-foreground font-normal text-xs">({deck.length}/5)</span></p>
              <button onClick={() => setDeck([])} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
            </div>

            {deck.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Tap cards in Collection to add them</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 justify-center">
                {deck.map(card => (
                  <CardDisplay key={card.id} card={card} size="md" selected glowing
                    onClick={toggleDeckCard} />
                ))}
              </div>
            )}

            {deck.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-3">
                <p className="text-xs font-semibold mb-2">Deck Stats</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-secondary rounded-lg p-2">
                    <p className="text-sm font-bold text-red-400">{deck.reduce((s, c) => s + c.power, 0)}</p>
                    <p className="text-[9px] text-muted-foreground">Total Power</p>
                  </div>
                  <div className="bg-secondary rounded-lg p-2">
                    <p className="text-sm font-bold text-blue-400">{deck.reduce((s, c) => s + c.guard, 0)}</p>
                    <p className="text-[9px] text-muted-foreground">Total Guard</p>
                  </div>
                  <div className="bg-secondary rounded-lg p-2">
                    <p className="text-sm font-bold text-yellow-400">{(deck.reduce((s, c) => s + c.cost, 0) / deck.length).toFixed(1)}</p>
                    <p className="text-[9px] text-muted-foreground">Avg Cost</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {[...new Set(deck.map(c => c.element))].map(el => (
                    <span key={el} className={`text-[10px] px-2 py-0.5 rounded-full bg-secondary ${ELEMENT_COLORS[el]?.text}`}>
                      {ELEMENT_COLORS[el]?.icon} {el}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'tournament' && (
          <div className="space-y-4">
            {tournamentRound === 0 && (
              <>
                <div className="bg-gradient-to-br from-yellow-900/30 to-amber-900/20 border border-yellow-500/30 rounded-2xl p-4 text-center">
                  <Trophy className="w-10 h-10 text-yellow-400 mx-auto mb-2" />
                  <h3 className="text-base font-bold text-yellow-400">Grand Tournament</h3>
                  <p className="text-xs text-muted-foreground mt-1">Defeat 3 AI opponents in sequence. Difficulty escalates. Prizes await.</p>
                </div>

                <div className="space-y-2">
                  {TOURNAMENT_ROUNDS.map((r, i) => (
                    <div key={r.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm font-bold text-muted-foreground">{i + 1}</div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{r.name}</p>
                        <p className="text-[10px] text-muted-foreground">{r.faction} · Difficulty {'⭐'.repeat(r.difficulty)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-yellow-400 font-bold">{r.prize.gold}g</p>
                        <p className="text-[9px] text-primary">+ card discovery</p>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={startTournament}
                  disabled={deck.length < 3}
                  className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-40">
                  <Sword className="w-4 h-4" />
                  {deck.length < 3 ? `Build a deck first (${deck.length}/3 min)` : 'Enter Tournament'}
                </button>
              </>
            )}

            {battling && currentRound && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-primary">Round {tournamentRound}/3</p>
                  <p className="text-xs text-muted-foreground">vs {currentRound.name}</p>
                </div>
                <BattleView
                  playerCards={[...deck]}
                  opponentName={currentRound.name}
                  difficulty={currentRound.difficulty}
                  onBattleEnd={handleBattleEnd}
                />
              </div>
            )}

            <AnimatePresence>
              {discoveredCard && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center"
                  onClick={() => setDiscoveredCard(null)}>
                  <div className="bg-card border border-primary/40 rounded-2xl p-6 text-center max-w-xs mx-4" onClick={e => e.stopPropagation()}>
                    <p className="text-xs text-primary uppercase tracking-widest mb-1">Card Discovered!</p>
                    <p className="text-sm font-semibold mb-4">Added to your collection</p>
                    <div className="flex justify-center mb-4">
                      <CardDisplay card={discoveredCard} size="lg" glowing />
                    </div>
                    <button onClick={() => setDiscoveredCard(null)} className="w-full py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold">Collect</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {tournamentRound === 4 && !battling && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="text-center space-y-4">
                <div className="bg-gradient-to-br from-yellow-900/40 to-amber-900/30 border border-yellow-500/40 rounded-2xl p-6">
                  <p className="text-4xl mb-2">🏆</p>
                  <p className="text-xl font-bold text-yellow-400">Tournament Champion!</p>
                  <p className="text-sm text-muted-foreground mt-1">You conquered all 3 opponents</p>
                  <p className="text-2xl font-bold text-yellow-300 mt-3">+400 Gold</p>
                </div>
                <button onClick={resetTournament} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold">
                  Play Again
                </button>
              </motion.div>
            )}

            {tournamentRound === 0 && roundResults.length > 0 && roundResults[roundResults.length - 1]?.won === false && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-center space-y-4">
                <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-6">
                  <p className="text-4xl mb-2">💀</p>
                  <p className="text-xl font-bold text-red-400">Defeated</p>
                  <p className="text-sm text-muted-foreground mt-1">Reached Round {roundResults.length}</p>
                </div>
                <button onClick={resetTournament} className="w-full py-3 bg-secondary border border-border rounded-xl font-semibold text-sm">
                  Try Again
                </button>
              </motion.div>
            )}
          </div>
        )}

        {tab === 'market' && (
          <Marketplace gold={gold} onGoldChange={saveGold} />
        )}
      </div>
    </div>
  );
}