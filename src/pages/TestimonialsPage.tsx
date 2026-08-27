import { type JSX, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SiteShell } from '@/components/public/SiteShell';
import { Stars } from '@/components/public/Reviews';
import { TestimonialsGrid } from '@/components/public/TestimonialsGrid';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { fetchReviews, type ReviewsSnapshot } from '@/services/reviewService';
import { routes } from '@/lib/routes';

/**
 * The full Google-reviews list — the homepage snippet's own page (2026-08-25
 * rebrand). Renders nothing invented: same rule as the homepage block, this
 * page is empty rather than showing placeholder testimonials until Google
 * has real ones cached.
 */
export function TestimonialsPage(): JSX.Element {
  useDocumentMeta(
    'Testimonials',
    'What clients say about Kokolett Beauty, a women’s hair salon in South East London: real Google reviews.',
  );
  const { settings } = useBusinessSettings();
  const [data, setData] = useState<ReviewsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void fetchReviews(30)
      .then((snapshot) => {
        if (active) setData(snapshot);
      })
      .catch(() => {
        if (active) setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const reviews = data?.reviews ?? [];
  const hasRating = typeof data?.rating === 'number' && (data?.rating_count ?? 0) > 0;

  return (
    <SiteShell>
      {/* AggregateRating, rendered here rather than statically in index.html
          because it must reflect the real, live-synced rating — a number
          baked into the static shell would drift the moment a new review
          lands. See docs/ARCHITECTURE.md for why the core `HairSalon` entity
          stays static; this is the one figure that has to stay live instead. */}
      {hasRating && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'HairSalon',
              name: 'Kokolett Beauty UK',
              url: 'https://www.kokolettbeauty.com/',
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: data?.rating,
                reviewCount: data?.rating_count,
              },
            }),
          }}
        />
      )}

      <section className="mx-auto max-w-5xl px-4 py-16 md:px-6">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand">
            Testimonials
          </p>
          <h1 className="font-serif text-3xl font-semibold text-foreground md:text-4xl">
            What clients say
          </h1>
          {hasRating && (
            <p className="mt-4 flex flex-wrap items-center justify-center gap-2 text-muted-foreground">
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

        {!loading && reviews.length === 0 && (
          <p className="text-center text-muted-foreground">
            No reviews are showing yet, so{' '}
            <Link to={routes.public.book} className="text-primary hover:underline">
              be one of the first to book
            </Link>
            .
          </p>
        )}

        {reviews.length > 0 && (
          <TestimonialsGrid reviews={reviews} reviewUrl={settings?.google_review_url} />
        )}
      </section>
    </SiteShell>
  );
}
