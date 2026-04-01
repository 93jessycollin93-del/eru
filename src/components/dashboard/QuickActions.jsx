import { Link } from 'react-router-dom';
import { ArrowUpDown, ImageIcon, BarChart2, ShoppingBag } from 'lucide-react';

const actions = [
  { label: 'Trade', icon: ArrowUpDown, to: '/trade', color: 'text-green-400' },
  { label: 'Markets', icon: BarChart2, to: '/markets', color: 'text-blue-400' },
  { label: 'NFTs', icon: ImageIcon, to: '/nfts', color: 'text-purple-400' },
  { label: 'Shop', icon: ShoppingBag, to: '/collectables', color: 'text-yellow-400' },
];

export default function QuickActions() {
  return (
    <div className="mx-4 mt-3 grid grid-cols-4 gap-2">
      {actions.map(a => (
        <Link key={a.label} to={a.to}
          className="bg-card border border-border rounded-xl p-3 flex flex-col items-center gap-1.5 hover:border-primary/50 transition-colors">
          <a.icon className={`w-5 h-5 ${a.color}`}/>
          <span className="text-xs text-muted-foreground">{a.label}</span>
        </Link>
      ))}
    </div>
  );
}