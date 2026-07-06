/**
 * connectivity — honest device-capability hooks for the Connectivity panel.
 * No faked capabilities: feature-detect each API and expose what's really there.
 */
import { useEffect, useState } from 'react';

export function useOnline() {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function useConnectionInfo() {
  const [info, setInfo] = useState(getConnectionInfo());
  useEffect(() => {
    const c = typeof navigator !== 'undefined' ? navigator.connection : null;
    if (!c) return;
    const update = () => setInfo(getConnectionInfo());
    c.addEventListener?.('change', update);
    return () => c.removeEventListener?.('change', update);
  }, []);
  return info;
}

export function getConnectionInfo() {
  const c = typeof navigator !== 'undefined' ? navigator.connection : null;
  if (!c) return null;
  return {
    effectiveType: c.effectiveType || null,
    downlink: typeof c.downlink === 'number' ? c.downlink : null,
    rtt: typeof c.rtt === 'number' ? c.rtt : null,
    saveData: !!c.saveData,
  };
}

export function hasBluetooth() {
  return typeof navigator !== 'undefined' && !!navigator.bluetooth;
}

export async function requestBluetoothDevice() {
  if (!hasBluetooth()) {
    throw new Error('Bluetooth is not supported in this browser. Web Bluetooth works in Chrome on Android/desktop; iOS Safari does not support it.');
  }
  const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true });
  return { id: device.id, name: device.name || 'Unknown device' };
}