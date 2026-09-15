import { useEffect, useState } from 'react';
import cn from '@/lib/cn';

/**
 * Time left until a deadline, as four counted cells.
 *
 * Ticks once a SECOND, never on a frame. A countdown that animates every frame
 * burns a repaint sixty times a second to move a digit once, and on a page that
 * is mostly scrolling that is the most expensive thing running.
 *
 * The cells are fixed-width and tabular: a number that changes width as it
 * counts down makes the whole row shuffle left and right every second, which is
 * far more distracting than the count itself.
 *
 * Past the deadline it renders nothing rather than counting negative - an
 * expired offer's page still has to make sense, and "-00:04:12" is not a thing
 * to tell anybody. The caller decides what an expired offer looks like.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function remaining(endsAt) {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;

  return {
    days: Math.floor(ms / DAY),
    hours: Math.floor((ms % DAY) / HOUR),
    minutes: Math.floor((ms % HOUR) / MINUTE),
    seconds: Math.floor((ms % MINUTE) / SECOND),
  };
}

export function CountdownTimer({ endsAt, tone = 'default', className }) {
  const [left, setLeft] = useState(() => remaining(endsAt));

  useEffect(() => {
    setLeft(remaining(endsAt));
    // Cleared as soon as the deadline passes: an expired offer does not need a
    // timer running behind it for the rest of the session.
    const id = setInterval(() => {
      const next = remaining(endsAt);
      setLeft(next);
      if (!next) clearInterval(id);
    }, SECOND);
    return () => clearInterval(id);
  }, [endsAt]);

  if (!left) return null;

  const onDark = tone === 'onDark';

  const cells = [
    { value: left.days, label: left.days === 1 ? 'day' : 'days' },
    { value: left.hours, label: 'hrs' },
    { value: left.minutes, label: 'min' },
    { value: left.seconds, label: 'sec' },
  ];

  return (
    <div
      className={cn('flex flex-wrap items-center gap-2', className)}
      // One live region for the whole row, polite, so a screen reader is not
      // read four numbers every second. The visible cells are hidden from it
      // and a single sentence carries the meaning.
      role="timer"
    >
      <span className="sr-only">
        {left.days} days, {left.hours} hours and {left.minutes} minutes remaining
      </span>

      {cells.map(({ value, label }) => (
        <span
          key={label}
          aria-hidden="true"
          className={cn(
            'flex min-w-[56px] flex-col items-center rounded-lg px-2.5 py-2',
            onDark ? 'bg-white/15 text-white' : 'border border-line bg-surface text-ink-900',
          )}
        >
          <span className="tnum font-display text-lg font-bold leading-none">
            {String(value).padStart(2, '0')}
          </span>
          <span
            className={cn(
              'mt-1 text-2xs uppercase tracking-[0.08em]',
              onDark ? 'text-white/60' : 'text-ink-400',
            )}
          >
            {label}
          </span>
        </span>
      ))}
    </div>
  );
}

export default CountdownTimer;
