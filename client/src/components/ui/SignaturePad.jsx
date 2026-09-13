import { useEffect, useRef, useState } from 'react';
import { Eraser, PenLine, Upload } from 'lucide-react';
import cn from '@/lib/cn';
import { pressable } from '@/lib/motion';

/**
 * Draw a signature, or upload one.
 *
 * **Both, because neither alone covers the room.** Drawing works on a phone or
 * a tablet and is what most people reach for; uploading is what somebody with a
 * scanned signature on file actually wants, and is the only option that works
 * with a mouse without producing something the signer would be embarrassed by.
 *
 * **Pointer events, not mouse and touch separately.** One set of handlers
 * covers a finger, a stylus and a mouse, and `setPointerCapture` keeps a stroke
 * attached to the canvas when the pointer leaves it mid-signature - without it
 * every stroke that overshoots the edge ends there, which on a small canvas is
 * most of them.
 *
 * The canvas is sized in device pixels and scaled back down in CSS, because a
 * signature drawn at CSS resolution on a 2× screen is visibly soft - and this
 * one ends up on a contract.
 */
export function SignaturePad({ value, onChange, disabled = false }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const [mode, setMode] = useState('draw');
  const [error, setError] = useState(null);

  // Sized once against the element's real width, and again whenever that
  // changes. Resizing a canvas clears it, so a stroke in progress is not
  // preserved across a rotation - an acceptable trade against a blurry one.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || mode !== 'draw') return undefined;

    function resize() {
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width) return;

      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);

      const context = canvas.getContext('2d');
      context.scale(ratio, ratio);
      context.lineWidth = 2;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      // Ink, not pure black: a signature rendered in `#000` against an off-white
      // document reads as printed rather than written.
      context.strokeStyle = '#1f2430';
    }

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [mode]);

  function pointFrom(event) {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function start(event) {
    if (disabled) return;
    drawing.current = true;
    dirty.current = true;
    canvasRef.current.setPointerCapture(event.pointerId);

    const context = canvasRef.current.getContext('2d');
    const { x, y } = pointFrom(event);
    context.beginPath();
    context.moveTo(x, y);
  }

  function move(event) {
    if (!drawing.current) return;
    const context = canvasRef.current.getContext('2d');
    const { x, y } = pointFrom(event);
    context.lineTo(x, y);
    context.stroke();
  }

  function end(event) {
    if (!drawing.current) return;
    drawing.current = false;
    canvasRef.current.releasePointerCapture?.(event.pointerId);
    // Exported on release rather than on every move: a PNG per pixel of travel
    // is a lot of base64 for a preview nobody sees.
    onChange({ kind: 'drawn', image: canvasRef.current.toDataURL('image/png') });
  }

  function clear() {
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext('2d');
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
    dirty.current = false;
    setError(null);
    onChange(null);
  }

  function upload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);

    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setError('Use a PNG, JPEG or WebP image.');
      return;
    }
    // Checked here as well as on the server: a 4MB photo rejected after the
    // upload is a wasted minute on a phone connection.
    if (file.size > 1_000_000) {
      setError('That image is too large - keep it under 1MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => onChange({ kind: 'uploaded', image: String(reader.result) });
    reader.onerror = () => setError('That file could not be read.');
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {[
          { key: 'draw', label: 'Draw it', icon: PenLine },
          { key: 'upload', label: 'Upload an image', icon: Upload },
        ].map((option) => {
          const Icon = option.icon;
          const on = mode === option.key;
          return (
            <button
              key={option.key}
              type="button"
              disabled={disabled}
              aria-pressed={on}
              onClick={() => {
                setMode(option.key);
                clear();
              }}
              className={cn(
                pressable,
                'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium',
                on
                  ? 'border-brand/40 bg-brand-50 text-brand'
                  : 'border-line bg-surface text-ink-600 hover:border-line-strong',
              )}
            >
              <Icon className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
              {option.label}
            </button>
          );
        })}

        {value && (
          <button
            type="button"
            onClick={clear}
            disabled={disabled}
            className={cn(
              pressable,
              'ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-ink-500 hover:text-ink-900',
            )}
          >
            <Eraser className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
            Clear
          </button>
        )}
      </div>

      {mode === 'draw' ? (
        <div className="relative">
          <canvas
            ref={canvasRef}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            aria-label="Draw your signature"
            // `touch-none` so a finger signs rather than scrolling the page
            // without it the first downstroke drags the document instead.
            className={cn(
              // `cursor-pen` because this is the one surface in the app somebody
              // writes on: an arrow here says "click something" when the
              // instruction is "sign here".
              'cursor-pen h-32 w-full touch-none rounded-md border border-dashed border-line-strong bg-surface',
              disabled && 'cursor-not-allowed opacity-50',
            )}
          />
          {!value && (
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-ink-300">
              Sign here
            </p>
          )}
        </div>
      ) : (
        // The label below is `relative` on purpose: it contains an `sr-only`
        // file input, which is absolutely positioned and would otherwise anchor
        // to the document and stretch the page.
        <div className="rounded-md border border-dashed border-line-strong p-4">
          {value?.image ? (
            <img
              src={value.image}
              alt="Your signature"
              className="mx-auto max-h-24 w-auto"
            />
          ) : (
            <label className="relative flex cursor-pointer flex-col items-center gap-2 text-center">
              <Upload className="size-5 text-ink-300" strokeWidth={1.75} aria-hidden="true" />
              <span className="text-sm text-ink-500">Choose a PNG, JPEG or WebP image</span>
              <span className="text-2xs text-ink-400">Under 1MB</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={upload}
                disabled={disabled}
                className="sr-only"
              />
            </label>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export default SignaturePad;
