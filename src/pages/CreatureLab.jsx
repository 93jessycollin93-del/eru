import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { ELEMENT_COLORS, RARITY_STYLES } from '../components/cards/StarterCards';
import CardDisplay from '../components/cards/CardDisplay';
import { FlaskConical, Plus, Dna, Zap, Loader2, ChevronDown } from 'lucide-react';

const ELEMENTS = ['fire', 'water', 'earth', 'wind', 'shadow', 'light'];
const RARITIES = ['common', 'rare', 'epic', 'legendary'];
const FACTIONS = ['Ember Clan', 'Tide Order', 'Stone Legion', 'Gale Court', 'Void Syndicate', 'Dawn Conclave'];
const ABILITIES = ['burn', 'frost', 'poison', 'shield', 'combo', 'clash', 'summon', 'heal'];

function breedCard(parent1, parent2) {
  const elements = [parent1.element, parent2.element];
  const element = elements[Math.random() < 0.5 ? 0 : 1];
  const rarityOrder = { common: 1, rare: 2, epic: 3, legendary: 4 };
  const maxRarity = Math.max(rarityOrder[parent1.rarity], rarityOrder[parent2.rarity]);
  const bonusRarity = Math.random() < 0.15 ? 1 : 0;
  const finalRarityVal = Math.min(4, maxRarity + bonusRarity);
  const rarityMap = { 1: 'common', 2: 'rare', 3: 'epic', 4: 'legendary' };
  const rarity = rarityMap[finalRarityVal];

  const power = Math.round((parent1.power_base + parent2.power_base) / 2 + Math.random() * 2);
  const guard = Math.round((parent1.guard_base + parent2.guard_base) / 2 + Math.random() * 1.5);
  const cost = Math.max(1, Math.min(7, Math.round((power + guard) / 2.5)));
  const ability = ABILITIES[Math.floor(Math.random() * ABILITIES.length)];
  const abilityValue = Math.floor(Math.random() * 3) + 1;
  const faction = Math.random() < 0.5 ? parent1.faction : (parent2.faction || FACTIONS[0]);

  return {
    name: `${parent1.name.split(' ')[0]} ${parent2.name.split(' ').pop()} Hybrid`,
    cost, power, guard, element, faction, rarity,
    card_type: 'unit',
    ability, ability_value: abilityValue,
    flavor_text: `Born from the union of ${parent1.name} and ${parent2.name}.`,
    is_animated: rarity === 'legendary',
  };
}

export default function CreatureLab() {
  const [creatures, setCreatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [breeding, setBreeding] = useState(false);
  const [parent1, setParent1] = useState(null);
  const [parent2, setParent2] = useState(null);
  const [breedResult, setBreedResult] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', element: 'fire', rarity: 'common', faction: FACTIONS[0] });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const list = await base44.entities.Creature.list('-created_date', 50);
    setCreatures(list);
    setLoading(false);
  };

  const createCreature = async () => {
    if (!form.name.trim()) return;
    setCreating(true);
    const rarityStats = { common: [2, 2], rare: [3, 3], epic: [5, 4], legendary: [7, 5] };
    const [pb, gb] = rarityStats[form.rarity];
    await base44.entities.Creature.create({
      name: form.name,
      element: form.element,
      rarity: form.rarity,
      faction: form.faction,
      power_base: pb + Math.floor(Math.random() * 2),
      guard_base: gb + Math.floor(Math.random() * 2),
      ability: ABILITIES[Math.floor(Math.random() * ABILITIES.length)],
    });
    await load();
    setShowCreate(false);
    setForm({ name: '', element: 'fire', rarity: 'common', faction: FACTIONS[0] });
    setCreating(false);
  };

  const selectParent = (creature) => {
    if (!parent1 || (parent1 && parent2)) {
      setParent1(creature);
      setParent2(null);
      setBreedResult(null);
    } else if (parent1.id !== creature.id) {
      setParent2(creature);
    }
  };

  const breed = async () => {
    if (!parent1 || !parent2) return;
    setBreeding(true);
    const cardData = breedCard(parent1, parent2);
    await new Promise(r => setTimeout(r, 1200));

    const savedCard = await base44.entities.Card.create({ ...cardData, quantity: 1 });
    await base44.entities.Creature.update(parent1.id, { breed_count: (parent1.breed_count || 0) + 1, bred_card_id: savedCard.id });
    await base44.entities.Creature.update(parent2.id, { breed_count: (parent2.breed_count || 0) + 1 });

    setBreedResult(savedCard);
    setParent1(null);
    setParent2(null);
    await load();
    setBreeding(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-primary" /> Creature Lab
          </h2>
          <p className="text-[10px] text-muted-foreground">Breed creatures to forge unique cards</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="bg-primary text-primary-foreground rounded-xl p-2">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Breeding Chamber */}
        <div className="bg-gradient-to-br from-purple-900/30 to-indigo-900/20 border border-purple-500/30 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Dna className="w-4 h-4 text-purple-400" />
            <p className="text-sm font-semibold text-purple-300">Breeding Chamber</p>
            <span className="text-[10px] text-muted-foreground">(select 2 creatures)</span>
          </div>

          <div className="flex items-center gap-3 justify-center mb-3">
            {[parent1, parent2].map((p, i) => (
              <div key={i} className={`flex-1 h-20 rounded-xl border-2 border-dashed flex items-center justify-center text-center
                ${p ? `border-purple-500/50 bg-purple-900/20` : 'border-border bg-secondary/30'}`}>
                {p ? (
                  <div>
                    <p className={`text-sm ${ELEMENT_COLORS[p.element]?.text}`}>{ELEMENT_COLORS[p.element]?.icon}</p>
                    <p className="text-xs font-semibold truncate px-2">{p.name}</p>
                    <p className={`text-[9px] ${RARITY_STYLES[p.rarity]?.color}`}>{RARITY_STYLES[p.rarity]?.label}</p>
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground">Parent {i + 1}</p>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={breed}
            disabled={!parent1 || !parent2 || breeding}
            className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
            {breeding ? <><Loader2 className="w-4 h-4 animate-spin" /> Breeding...</> : <><Zap className="w-4 h-4" /> Breed & Forge Card</>}
          </button>
        </div>

        {/* Bred card result */}
        <AnimatePresence>
          {breedResult && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="bg-card border border-primary/30 rounded-2xl p-4 text-center">
              <p className="text-xs text-primary uppercase tracking-widest mb-1">New Card Forged!</p>
              <p className="text-sm font-semibold mb-3">Added to your collection</p>
              <div className="flex justify-center mb-3">
                <CardDisplay card={breedResult} size="lg" glowing />
              </div>
              <button onClick={() => setBreedResult(null)} className="text-xs text-muted-foreground">Dismiss</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Creature list */}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-3">
            {creatures.length} Creatures — Tap to select for breeding
          </p>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-primary animate-spin" /></div>
          ) : creatures.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FlaskConical className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No creatures yet. Create your first one!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {creatures.map(c => {
                const el = ELEMENT_COLORS[c.element] || ELEMENT_COLORS.fire;
                const rar = RARITY_STYLES[c.rarity] || RARITY_STYLES.common;
                const isSelected = parent1?.id === c.id || parent2?.id === c.id;
                return (
                  <motion.div key={c.id} whileTap={{ scale: 0.98 }} onClick={() => selectParent(c)}
                    className={`bg-card border rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-all
                      ${isSelected ? `border-purple-500/60 bg-purple-900/10` : 'border-border hover:border-primary/30'}`}>
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${el.bg} flex items-center justify-center text-xl border ${el.border}`}>
                      {el.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{c.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] ${rar.color}`}>{rar.label}</span>
                        <span className="text-[10px] text-muted-foreground">{c.faction}</span>
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <p className="text-red-400 font-bold">⚔ {c.power_base}</p>
                      <p className="text-blue-400 font-bold">🛡 {c.guard_base}</p>
                      {c.breed_count > 0 && <p className="text-[9px] text-muted-foreground">bred ×{c.breed_count}</p>}
                    </div>
                    {isSelected && <div className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create creature modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end" onClick={() => setShowCreate(false)}>
            <motion.div initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }}
              className="w-full max-w-md mx-auto bg-card border-t border-border rounded-t-2xl p-5 space-y-4"
              onClick={e => e.stopPropagation()}>
              <h3 className="text-base font-semibold">Create Creature</h3>

              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Creature name"
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm outline-none" />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Element</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ELEMENTS.map(el => (
                      <button key={el} onClick={() => setForm(p => ({ ...p, element: el }))}
                        className={`text-lg leading-none p-1 rounded-lg transition-all ${form.element === el ? 'bg-primary/20 ring-1 ring-primary' : 'bg-secondary'}`}>
                        {ELEMENT_COLORS[el]?.icon}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Rarity</p>
                  <div className="flex flex-col gap-1">
                    {RARITIES.map(r => (
                      <button key={r} onClick={() => setForm(p => ({ ...p, rarity: r }))}
                        className={`text-xs px-2 py-1 rounded-lg capitalize text-left transition-all
                          ${form.rarity === r ? `bg-primary/20 ${RARITY_STYLES[r]?.color}` : 'bg-secondary text-muted-foreground'}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Faction</p>
                <select value={form.faction} onChange={e => setForm(p => ({ ...p, faction: e.target.value }))}
                  className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm outline-none">
                  {FACTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              <button onClick={createCreature} disabled={!form.name.trim() || creating}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2">
                {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : <><Plus className="w-4 h-4" /> Create Creature</>}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}