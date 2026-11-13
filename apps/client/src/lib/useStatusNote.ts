import { useState } from 'react';

/**
 * Small helper so pages can hold one transient message each. The nonce makes
 * an identical message re-showable (e.g. two edits in a row).
 */
export function useStatusNote(): [string, (message: string) => void, () => void] {
  const [message, setMessage] = useState('');
  const [nonce, setNonce] = useState(0);

  const show = (next: string) => {
    setMessage(next);
    setNonce((current) => current + 1);
  };

  const clear = () => setMessage('');

  return [nonce > 0 ? message : '', show, clear];
}
