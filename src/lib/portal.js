import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders children into document.body so they escape any overflow/transform
 * clipping from ancestor containers (e.g. overflow-y-auto in AppLayout).
 */
export default function Portal({ children }) {
  const el = useRef(document.createElement('div'));

  useEffect(() => {
    document.body.appendChild(el.current);
    return () => {
      document.body.removeChild(el.current);
    };
  }, []);

  return createPortal(children, el.current);
}