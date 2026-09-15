import { useState } from 'react';
import { Star } from 'lucide-react';
import cn from '@/lib/cn';
import { pressable } from '@/lib/motion';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
import { PartVisual } from '@/components/product/PartFrame';
import { useSubmitReview } from '@/hooks/useReviews';

const LABELS = {
  1: 'Would not buy again',
  2: 'Below what I expected',
  3: 'Did the job',
  4: 'Good part, would reorder',
  5: 'Exactly what I wanted',
};

/**
 * The rating control.
 *
 * Radio inputs, not buttons. A rating is a single choice from five, which is
 * what a radio group IS, and doing it properly gets keyboard support and screen
 * reader semantics without writing either: arrow keys move between the stars
 * because the browser does that for radios in a named group.
 *
 * The visible star is a label styled as the control; the input itself is
 * visually hidden but still focusable, which is why the ring is drawn on the
 * label via `peer-focus-visible`.
 */
function RatingPicker({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  const shown = hovered || value;

  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-ink-700">
        Your rating <span className="text-danger">*</span>
      </legend>

      <div className="flex items-center gap-1" onMouseLeave={() => setHovered(0)}>
        {[1, 2, 3, 4, 5].map((step) => (
          <label
            key={step}
            onMouseEnter={() => setHovered(step)}
            className={cn(pressable, 'cursor-pointer rounded-md p-0.5')}
          >
            <input
              type="radio"
              name="rating"
              value={step}
              checked={value === step}
              onChange={() => onChange(step)}
              className="peer visually-hidden"
            />
            <Star
              className={cn(
                'size-7 transition-colors duration-snap peer-focus-visible:ring-2 peer-focus-visible:ring-brand rounded-sm',
                step <= shown ? 'fill-warn text-warn' : 'text-ink-200',
              )}
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <span className="visually-hidden">
              {step} {step === 1 ? 'star' : 'stars'}
            </span>
          </label>
        ))}

        {/* The word, not just the stars. Five yellow shapes do not tell a first
            time reviewer what three means, and the label is what stops everyone
            defaulting to five. */}
        <span className="ml-2 text-sm text-ink-500">{LABELS[shown] ?? ''}</span>
      </div>
    </fieldset>
  );
}

/**
 * Write a review of one ordered part.
 *
 * A MODAL, not a page. The buyer is on the Thank You page or in their order
 * history when they decide to do this, and both are places they are part-way
 * through something else; a route change would lose that context and make
 * reviewing a second part a second journey rather than a second click.
 *
 * The form is its own confirmation - it was deliberately opened and filled in -
 * so there is no confirm dialog over the top of it (Instructions §3.0.1).
 */
export function ReviewForm({ open, onClose, item, onDone }) {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');

  const submit = useSubmitReview();

  function reset() {
    setRating(0);
    setTitle('');
    setBody('');
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!rating) {
      setError('Choose a rating from one to five stars.');
      return;
    }

    try {
      await submit.mutateAsync({
        orderId: item.orderId,
        productId: item.productId,
        rating,
        title,
        body,
      });
      reset();
      onDone?.(item);
      onClose();
    } catch (err) {
      setError(err.message || 'The review could not be saved.');
    }
  }

  if (!item) return null;

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Write a review"
      description="Other customers read these before they order. What did you make of it?"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* The part being reviewed, so there is never a doubt which line this
            is about when an order had four of them. */}
        <div className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 p-3">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-md bg-surface p-1.5">
            <PartVisual product={item} />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-md font-bold text-ink-900">
              {item.name}
            </span>
            <span className="mt-0.5 block text-xs text-ink-400">
              {item.partTypeLabel}
              {item.grade ? <span aria-hidden="true"> · {item.grade}</span> : null}
              <span aria-hidden="true"> · </span>
              Order {item.orderNumber}
            </span>
          </span>
        </div>

        <RatingPicker value={rating} onChange={setRating} />

        <Input
          label="Headline"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Fitted eight of these with no returns"
          maxLength={120}
          hint="Optional. One line, if you have one."
        />

        <Textarea
          label="Your review"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={6}
          required
          maxLength={2000}
          counter={2000}
          placeholder="How did it fit, how does it perform, and would you order it again?"
        />

        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button type="submit" loading={submit.isPending}>
            Publish review
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default ReviewForm;
