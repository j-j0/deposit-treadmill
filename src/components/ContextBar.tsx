import { useEffect, useState } from 'react';
import { currency } from '../lib/format';

/**
 * Sticky strip showing what the numbers on screen are *about*.
 *
 * Once the page is tabbed, the city and property type sit above the fold and
 * scroll away — leaving a screen full of dollar figures with no visible
 * subject. This keeps the subject attached to them without spending permanent
 * vertical space: it appears only after the inputs card has scrolled past.
 */

interface Props {
  regionName: string;
  propertyTypeLabel: string;
  medianPrice: number;
  /** Element to watch; the bar shows once it is out of view. */
  watchRef: React.RefObject<HTMLElement | null>;
}

export function ContextBar({ regionName, propertyTypeLabel, medianPrice, watchRef }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = watchRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry!.isIntersecting),
      { rootMargin: '-8px 0px 0px 0px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [watchRef]);

  return (
    <div className={`context-bar${visible ? ' context-bar--visible' : ''}`} aria-hidden={!visible}>
      <span className="context-bar__region">{regionName}</span>
      <span className="context-bar__sep">·</span>
      <span>{propertyTypeLabel}</span>
      <span className="context-bar__sep">·</span>
      <span className="context-bar__price">{currency(medianPrice)} median</span>
    </div>
  );
}
