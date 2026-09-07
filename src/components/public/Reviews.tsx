import { type JSX, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import {
  fetchReviews,
  type PublicReview,
  type ReviewsSnapshot,
} from '@/services/reviewService';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { cn } from '@/lib/utils';

const VISIBLE_CARDS = 3;
const ROTATE_MS = 5000;
const WORD_LIMIT = 20;

function truncateWords(text: string, limit: number): string {
  const words = text.trim().split(/\s+/);
  return words.length <= limit ? text.trim() : `${words.slice(0, limit).join(' ')}…`;
}

/**
 * What people are saying, from Google.
 *
 * Renders nothing at all until there are real reviews to show. A "reviews"
 * heading over an empty box, or over invented testimonials, is worse than no
 * section — the whole value of this block is that a stranger believes it.
 */
export function Stars({
  rating,
  className,
}: {
  rating: number;
  className?: string;
}): JSX.Element {
  const rounded = Math.round(rating);
  return (
    <span
      className={cn('inline-flex items-center gap-0.5', className)}
      role="img"
      aria-label={`${rating} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          viewBox="0 0 20 20"
          className={cn('h-4 w-4', n <= rounded ? 'fill-primary' : 'fill-border')}
          aria-hidden="true"
        >
          <path d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 14.9l-5.3 2.7 1-5.8L1.5 7.7l5.9-.9z" />
        </svg>
      ))}
    </span>
  );
}

/** Google's photo URLs occasionally 403 or expire; fall back to the same
 * initial-letter badge used when there is no photo at all, rather than
 * showing a broken-image icon. */
function ReviewerAvatar({
  authorName,
  photoUrl,
}: {
  authorName: string;
  photoUrl: string | null;
}): JSX.Element {
  const [broken, setBroken] = useState(false);

  return photoUrl && !broken ? (
    <img
      src={photoUrl}
      alt=""
      width={32}
      height={32}
      loading="lazy"
      className="h-8 w-8 rounded-full object-cover"
      onError={() => setBroken(true)}
    />
  ) : (
    <span
      className="grid h-8 w-8 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
      aria-hidden="true"
    >
      {authorName.slice(0, 1)}
    </span>
  );
}

/**
 * `profileUrl` is where the reviews are read; `reviewUrl` is Google's
 * `g.page/r/<id>/review` link, which opens the write-a-review dialog. Both used
 * to come from one field, so "Read all reviews on Google" dropped the reader
 * into a blank review form. See `buildGoogleProfileUrl` in `lib/business.ts`.
 */
export function Reviews({
  reviewUrl,
  profileUrl,
}: {
  reviewUrl: string | null;
  profileUrl?: string | null;
}): JSX.Element | null {
  const readUrl = profileUrl ?? reviewUrl;
  const [data, setData] = useState<ReviewsSnapshot | null>(null);
  const [start, setStart] = useState(0);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    let active = true;
    void fetchReviews(6)
      .then((snapshot) => {
        if (active) setData(snapshot);
      })
      .catch(() => {
        // A reviews block that fails is simply absent; it must never take the
        // marketing page down with it.
        if (active) setData(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const reviews = data?.reviews ?? [];
  const hasRating = typeof data?.rating === 'number' && (data?.rating_count ?? 0) > 0;
  const rotating = !reducedMotion && !paused && !interacting;

  // Only three cards show at once; anything beyond that rotates through
  // rather than growing the grid, so the homepage teaser never gets taller
  // than three cards regardless of how many reviews are cached.
  //
  // The pause control below is WCAG 2.2.2 (Level A): motion that starts on its
  // own and runs longer than five seconds needs a mechanism to stop it.
  // `prefers-reduced-motion` is not that mechanism, and a review card
  // replacing itself mid-sentence is exactly the case the criterion covers.
  useEffect(() => {
    if (!rotating || reviews.length <= VISIBLE_CARDS) return;
    const id = window.setInterval(() => {
      setStart((i) => (i + 1) % reviews.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [rotating, reviews.length]);

  if (reviews.length === 0 && !hasRating) return null;

  const visible = Array.from(
    { length: Math.min(VISIBLE_CARDS, reviews.length) },
    (_, i) => reviews[(start + i) % reviews.length],
  ).filter((r): r is PublicReview => r !== undefined);

  return (
    <section className="border-t border-border bg-card">
      <div className="mx-auto max-w-5xl px-4 py-16 md:px-6">
        <div className="mb-8 text-center">
          <h2 className="font-serif text-3xl font-semibold text-foreground">
            What our clients say
          </h2>

          {hasRating && (
            <p className="mt-3 flex flex-wrap items-center justify-center gap-2 text-muted-foreground">
              <Stars rating={data?.rating ?? 5} />
              <span className="font-medium text-foreground">
                {data?.rating?.toFixed(1)}
              </span>
              <span>
                from {data?.rating_count} Google review
                {data?.rating_count === 1 ? '' : 's'}
              </span>
            </p>
          )}
        </div>

        {reviews.length > VISIBLE_CARDS && !reducedMotion && (
          <div className="mb-3 flex justify-center">
            <button
              type="button"
              aria-pressed={paused}
              onClick={() => setPaused((p) => !p)}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {paused ? 'Resume the review carousel' : 'Pause the review carousel'}
            </button>
          </div>
        )}

        {visible.length > 0 && (
          <div
            className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"
            onMouseEnter={() => setInteracting(true)}
            onMouseLeave={() => setInteracting(false)}
            onFocusCapture={() => setInteracting(true)}
            onBlurCapture={() => setInteracting(false)}
          >
            {visible.map((review) => {
              const card = (
                <Card
                  pad="compact"
                  className="flex h-full flex-col transition-colors hover:border-brand"
                >
                  <Stars rating={review.rating} className="mb-2" />
                  {review.body && (
                    <blockquote className="flex-1 text-sm leading-snug text-foreground">
                      {truncateWords(review.body, WORD_LIMIT)}
                    </blockquote>
                  )}
                  <footer className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                    <ReviewerAvatar
                      authorName={review.author_name}
                      photoUrl={review.profile_photo_url}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {review.author_name}
                      </span>
                      {review.relative_time && (
                        <span className="block text-xs text-muted-foreground">
                          {review.relative_time}
                        </span>
                      )}
                    </span>
                  </footer>
                </Card>
              );

              return readUrl ? (
                <a
                  key={`${review.author_name}-${review.published_at}`}
                  href={readUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {card}
                </a>
              ) : (
                <div key={`${review.author_name}-${review.published_at}`}>{card}</div>
              );
            })}
          </div>
        )}

        {(readUrl || reviewUrl) && (
          <p className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-center">
            {readUrl && (
              <a
                href={readUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Read all reviews on Google
              </a>
            )}
            {reviewUrl && (
              <a
                href={reviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-brand-ink underline underline-offset-4 hover:brightness-110"
              >
                Leave a review
              </a>
            )}
          </p>
        )}
      </div>
    </section>
  );
}
