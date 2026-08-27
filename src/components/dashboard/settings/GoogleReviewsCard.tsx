import { type JSX, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { LoadingState } from '@/components/ui/States';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { errorMessage } from '@/lib/errors';

/** Blank is fine; otherwise a Place ID always starts with `ChIJ`. */
function placeIdProblem(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.startsWith('ChIJ') ? null : 'Place IDs start with ChIJ.';
}

/** Where customers leave reviews, and the Place ID that surfaces them on the site. */
export function GoogleReviewsCard(): JSX.Element {
  const { settings, loading, update } = useBusinessSettings();
  const [googleReviewUrl, setGoogleReviewUrl] = useState('');
  const [googlePlaceId, setGooglePlaceId] = useState('');
  const [placeIdError, setPlaceIdError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    setGoogleReviewUrl(settings.google_review_url ?? '');
    setGooglePlaceId(settings.google_place_id ?? '');
  }, [settings]);

  if (loading) {
    return (
      <Card className="flex h-full items-center justify-center p-5">
        <LoadingState />
      </Card>
    );
  }

  const save = async (): Promise<void> => {
    const problem = placeIdProblem(googlePlaceId);
    if (problem) {
      setPlaceIdError(problem);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await update({
        google_review_url: googleReviewUrl.trim() || null,
        google_place_id: googlePlaceId.trim() || null,
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5">
      <h2 className="mb-1 font-serif text-base font-semibold text-foreground">
        Google Reviews
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Send customers to your review page and connect your Google Place ID so reviews can
        appear on your website.
      </p>
      <Field
        label="Google review link"
        hint="Sent automatically after an appointment is completed."
      >
        {({ id }) => (
          <Input
            id={id}
            type="url"
            value={googleReviewUrl}
            onChange={(e) => setGoogleReviewUrl(e.target.value)}
            placeholder="https://g.page/r/…"
          />
        )}
      </Field>
      <Field label="Google Place ID" hint="Starts with ChIJ." error={placeIdError}>
        {({ controlProps }) => (
          <Input
            {...controlProps}
            value={googlePlaceId}
            onChange={(e) => {
              setPlaceIdError(null);
              setGooglePlaceId(e.target.value);
            }}
            placeholder="ChIJ…"
          />
        )}
      </Field>
      {error && (
        <p role="alert" className="mb-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button size="sm" loading={saving} onClick={() => void save()}>
          Save changes
        </Button>
        {saved && (
          <span role="status" className="text-sm text-status-completed">
            Saved.
          </span>
        )}
      </div>
    </Card>
  );
}
