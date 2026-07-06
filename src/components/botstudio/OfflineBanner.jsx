import { WifiOff } from 'lucide-react';
import { useOnline } from '@/lib/connectivity';

/** OfflineBanner — persistent bar shown whenever navigator.onLine is false. */
export default function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="flex items-center justify-center gap-1.5 bg-amber-500/95 px-3 py-1.5 text-center text-[11px] font-medium text-black">
      <WifiOff className="h-3.5 w-3.5" /> Offline — your changes will sync when you reconnect.
    </div>
  );
}