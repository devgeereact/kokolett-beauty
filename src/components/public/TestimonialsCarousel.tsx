import { type JSX, useRef } from 'react';
import { Stars } from '@/components/public/Reviews';
import { Card } from '@/components/ui/Card';
import type { PublicReview } from '@/services/reviewService';

/**
 * A horizontally-scrolling, snap-aligned track of review cards with arrow
 * controls — native scroll-snap, no carousel library. Swipeable on touch;
 * the arrows just step the scroll position by one card's width.
 */
export function TestimonialsCarousel({
  reviews,
}: {
  reviews: PublicReview[];
}): JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null);

  const step = (direction: 1 | -1): void => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector('[data-testimonial-card]');
    const amount = card ? card.getBoundingClientRect().width + 16 : 320;
    track.scrollBy({ left: direction * amount, behavior: 'smooth' });
  };

  return (
    <div>
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {reviews.map((review) => (
          <Card
            key={`${review.author_name}-${review.published_at}`}
            data-testimonial-card
            className="flex w-full shrink-0 snap-start flex-col p-5 md:w-1/3"
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

      <div className="mt-6 flex justify-center gap-2">
        <button
          type="button"
          aria-label="Previous reviews"
          onClick={() => step(-1)}
          className="grid h-9 w-9 place-items-center rounded-full border border-border text-foreground hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Next reviews"
          onClick={() => step(1)}
          className="grid h-9 w-9 place-items-center rounded-full border border-border text-foreground hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
