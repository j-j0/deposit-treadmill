import { useCallback, useEffect, useRef, useState } from 'react';
import type { TreadmillResult } from '../lib/treadmill';
import type { ResolvedGrowth } from '../data/index';
import { absCurrency, currency, percent } from '../lib/format';
import type { AppState } from '../lib/urlState';
import { shareableUrl } from '../lib/urlState';

/**
 * The share card: a 1200×630 PNG rendered client-side.
 *
 * Deliberate limitation, stated in the UI rather than glossed: this personalises
 * the *image the user posts*, not the link unfurl. A per-user Open Graph image
 * has to be rendered at request time by a server, which v1 does not have. The
 * link itself carries a generic card; the image below is the personalised one.
 */

const W = 1200;
const H = 630;

// Fixed dark palette — a share image lands on someone else's timeline, where
// our light/dark theme means nothing. It should look the same everywhere.
const CARD = {
  bg: '#12120f',
  panel: '#1a1a19',
  text: '#ffffff',
  secondary: '#c3c2b7',
  muted: '#898781',
  savings: '#3987e5',
  target: '#d95926',
  losing: '#e66767',
  gaining: '#0ca30c',
  level: '#ffffff',
};

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

interface Props {
  result: TreadmillResult;
  regionName: string;
  propertyTypeLabel: string;
  growth: ResolvedGrowth;
  state: AppState;
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  { result, regionName, propertyTypeLabel, growth }: Omit<Props, 'state'>,
) {
  const { direction, groundGained, targetRise, netGround } = result;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = CARD.bg;
  ctx.fillRect(0, 0, W, H);

  // Accent rule down the left edge, in the colour of the verdict.
  const accent =
    direction === 'losing' ? CARD.losing : direction === 'gaining' ? CARD.gaining : CARD.level;
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 10, H);

  const L = 72;

  // Eyebrow
  ctx.fillStyle = CARD.muted;
  ctx.font = `600 22px ${FONT}`;
  ctx.letterSpacing = '2px';
  ctx.fillText('THE DEPOSIT TREADMILL', L, 78);
  ctx.letterSpacing = '0px';

  // Region
  ctx.fillStyle = CARD.secondary;
  ctx.font = `500 30px ${FONT}`;
  ctx.fillText(`${regionName} · median ${propertyTypeLabel.toLowerCase()}`, L, 126);

  // Ledger
  let y = 200;
  const ledger: Array<[string, string, string]> = [
    ['You add to savings', absCurrency(groundGained), CARD.savings],
    [
      `The deposit target ${targetRise < 0 ? 'falls' : 'rises'}`,
      absCurrency(targetRise),
      CARD.target,
    ],
  ];

  for (const [label, value, colour] of ledger) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.roundRect(L, y - 16, 14, 14, 4);
    ctx.fill();

    ctx.fillStyle = CARD.secondary;
    ctx.font = `400 30px ${FONT}`;
    ctx.fillText(label, L + 30, y);

    ctx.fillStyle = CARD.text;
    ctx.font = `600 30px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(value, W - L, y);
    ctx.textAlign = 'left';

    y += 56;
  }

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(L, y - 6);
  ctx.lineTo(W - L, y - 6);
  ctx.stroke();

  // Verdict
  const verdictLabel =
    direction === 'losing'
      ? 'You lose ground by'
      : direction === 'gaining'
        ? 'You gain ground by'
        : 'You hold level, within';

  ctx.fillStyle = CARD.secondary;
  ctx.font = `400 28px ${FONT}`;
  ctx.fillText(verdictLabel, L, y + 46);

  ctx.fillStyle = accent;
  ctx.font = `700 116px ${FONT}`;
  ctx.fillText(absCurrency(netGround), L, y + 152);

  // Direction pill
  const pillText =
    direction === 'losing'
      ? 'LOSING GROUND'
      : direction === 'gaining'
        ? 'GAINING GROUND'
        : 'HOLDING LEVEL';
  // Measure the number at its own size to place the pill beside it.
  ctx.font = `700 116px ${FONT}`;
  const numberW = ctx.measureText(absCurrency(netGround)).width;
  ctx.font = `600 22px ${FONT}`;
  const pillW = ctx.measureText(pillText).width + 36;
  const px = L + numberW + 28;
  const py = y + 108;
  if (px + pillW < W - L) {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(px, py, pillW, 44, 22);
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.letterSpacing = '1px';
    ctx.fillText(pillText, px + 18, py + 30);
    ctx.letterSpacing = '0px';
  }

  // Footer: the assumption and the source, so the number is never uncited.
  ctx.fillStyle = CARD.muted;
  ctx.font = `400 21px ${FONT}`;
  ctx.fillText(
    `Growth assumption ${percent(growth.ratePct)} a year · ${growth.provenance}`,
    L,
    H - 76,
  );
  ctx.fillText(
    'Source: Cotality Home Value Index, 30 June 2026 · deposit target 20% of median',
    L,
    H - 42,
  );
}

export function ShareCard({ result, regionName, propertyTypeLabel, growth, state }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = W;
    canvas.height = H;
    drawCard(ctx, { result, regionName, propertyTypeLabel, growth });
  }, [result, regionName, propertyTypeLabel, growth]);

  const toBlob = useCallback(
    () =>
      new Promise<Blob | null>((resolve) => {
        const canvas = canvasRef.current;
        if (!canvas) return resolve(null);
        canvas.toBlob(resolve, 'image/png');
      }),
    [],
  );

  const download = useCallback(async () => {
    const blob = await toBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deposit-treadmill-${regionName.toLowerCase().replace(/[^a-z]+/g, '-')}.png`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus('Image downloaded.');
  }, [toBlob, regionName]);

  const share = useCallback(async () => {
    const blob = await toBlob();
    if (!blob) return;
    const file = new File([blob], 'deposit-treadmill.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'The Deposit Treadmill',
          text: `${regionName}: the deposit target moves ${currency(result.targetRise)} a year on its own.`,
        });
        setStatus('Shared.');
      } catch {
        setStatus('Share cancelled.');
      }
    } else {
      await download();
    }
  }, [toBlob, download, regionName, result.targetRise]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareableUrl(state));
      setStatus('Link copied — it restores these exact numbers.');
    } catch {
      setStatus('Could not copy automatically; the URL in your address bar is the link.');
    }
  }, [state]);

  return (
    <section className="card" aria-labelledby="share-heading">
      <h2 id="share-heading">Share this</h2>

      <div className="share">
        <button type="button" className="btn btn--primary" onClick={share}>
          Share image
        </button>
        <button type="button" className="btn" onClick={download}>
          Download PNG
        </button>
        <button type="button" className="btn" onClick={copyLink}>
          Copy link
        </button>
        {status && (
          <span className="share__status" role="status">
            {status}
          </span>
        )}
      </div>

      <div className="share__preview">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Share card: in ${regionName}, you ${
            result.direction === 'losing' ? 'lose' : result.direction === 'gaining' ? 'gain' : 'hold'
          } ${absCurrency(result.netGround)} of ground over a year.`}
        />
      </div>

      <p className="chart-caption">
        The image above is personalised to your numbers. The link preview when you paste the URL
        is a generic card — a per-person preview image has to be generated by a server at the
        moment someone loads it, and this is a static page with no backend.
      </p>
    </section>
  );
}
