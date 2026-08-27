import { type JSX, useState } from 'react';
import { Stars } from '@/components/public/Reviews';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import type { PublicReview } from '@/services/reviewService';

function Avatar({ review }: { review: PublicReview }): JSX.Element {
  const [broken, setBroken] = useState(false);

  return review.profile_photo_url && !broken ? (
    <img
      src={review.profile_photo_url}
      alt=""
      width={40}
      height={40}
      loading="lazy"
      className="h-10 w-10 shrink-0 rounded-full object-cover"
      onError={() => setBroken(true)}
    />
  ) : (
    <span
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold text-muted-foreground"
      aria-hidden="true"
    >
      {review.author_name.slice(0, 1)}
    </span>
  );
}

/**
 * A 3-column grid of every cached review (Google caps this at 5 — there is
 * no "load more" for the reviews themselves, because there is nothing
 * further to load). Each card previews a few lines; the full text opens in
 * a popup rather than expanding the card, so every card in a row stays the
 * same height and the grid never reflows around one long review.
 *
 * A trailing card points to the salon's real Google profile, styled and
 * sized like the review cards either side of it, rather than a plain link
 * floating under the grid disconnected from it.
 */
export function TestimonialsGrid({
  reviews,
  reviewUrl,
}: {
  reviews: PublicReview[];
  reviewUrl?: string | null;
}): JSX.Element {
  const [open, setOpen] = useState<PublicReview | null>(null);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reviews.map((review) => (
          <button
            key={`${review.author_name}-${review.published_at}`}
            type="button"
            onClick={() => setOpen(review)}
            className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Card className="flex h-full flex-col p-5 transition-colors hover:border-brand">
              <Stars rating={review.rating} className="mb-3" />
              <blockquote className="line-clamp-4 flex-1 text-sm leading-relaxed text-foreground">
                {review.body}
              </blockquote>
              <span className="mt-2 text-xs font-medium text-primary">
                Read full review
              </span>
              <footer className="mt-4 flex items-center gap-3 border-t border-border pt-3">
                <Avatar review={review} />
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
          </button>
        ))}

        {reviewUrl && (
          <a
            href={reviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Card className="flex h-full flex-col items-center justify-center gap-3 p-5 text-center transition-colors hover:border-brand">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-tint-brand text-primary">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </span>
              <span className="font-serif text-base font-semibold text-foreground">
                View more on Google
              </span>
              <span className="text-sm text-muted-foreground">
                Read every review on our Google Business Profile
              </span>
            </Card>
          </a>
        )}
      </div>

      <Modal
        open={open !== null}
        onClose={() => setOpen(null)}
        ariaLabel={open ? `Review from ${open.author_name}` : 'Review'}
      >
        {open && (
          <Card className="p-6">
            <Stars rating={open.rating} className="mb-3" />
            <blockquote className="whitespace-pre-line text-sm leading-relaxed text-foreground">
              {open.body}
            </blockquote>
            <footer className="mt-5 flex items-center gap-3 border-t border-border pt-4">
              <Avatar review={open} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-foreground">
                  {open.author_name}
                </span>
                {open.relative_time && (
                  <span className="block text-xs text-muted-foreground">
                    {open.relative_time}
                  </span>
                )}
              </span>
            </footer>
            {open.author_url && (
              <p className="mt-4">
                <a
                  href={open.author_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  View on Google
                </a>
              </p>
            )}
          </Card>
        )}
      </Modal>
    </>
  );
}
