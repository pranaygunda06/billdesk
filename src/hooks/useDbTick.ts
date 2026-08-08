import { useEffect, useState } from 'react';
import { subscribe } from '../lib/db';

export function useDbTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => subscribe(() => setTick((t) => t + 1)), []);
  return tick;
}
