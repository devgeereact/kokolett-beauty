import { type JSX, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { fetchReviews, type ReviewsSnapshot } from '@/services/reviewService';
import { cn } from '@/lib/utils';

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

export function Reviews({ reviewUrl }: { reviewUrl: string | null }): JSX.Element | null {
  const [data, setData] = useState<ReviewsSnapshot | null>(null);

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

  if (reviews.length === 0 && !hasRating) return null;

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

        {reviews.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {reviews.map((review) => (
              <Card
                key={`${review.author_name}-${review.published_at}`}
                className="flex flex-col p-5"
              >
                <Stars rating={review.rating} className="mb-3" />
                <blockquote className="flex-1 text-sm leading-relaxed text-foreground">
                  {review.body}
                </blockquote>
                <footer className="mt-4 flex items-center gap-3 border-t border-border pt-3">
                  {review.profile_photo_url ? (
                    <img
                      src={review.profile_photo_url}
                      alt=""
                      width={32}
                      height={32}
                      loading="lazy"
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      className="grid h-8 w-8 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
                      aria-hidden="true"
                    >
                      {review.author_name.slice(0, 1)}
                    </span>
                  )}
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
            ))}
          </div>
        )}

        {reviewUrl && (
          <p className="mt-8 text-center">
            <a
              href={reviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Read all reviews on Google
            </a>
          </p>
        )}
      </div>
    </section>
  );
}
