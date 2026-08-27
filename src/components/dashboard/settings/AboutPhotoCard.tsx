import { type JSX, useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { uploadOwnerPhoto } from '@/services/ownerPhotoUploadService';
import { buildImageKitUrl } from '@/lib/imagekit';
import { errorMessage } from '@/lib/errors';

const FALLBACK_PATH = '/kokolett/marketing/about-christy-portrait.jpg';
const MAX_FILE_BYTES = 8 * 1024 * 1024;

/**
 * The portrait shown in the public About page's "About Christy" section
 * (`booking_settings.about_photo_path`, migration 0050). Uploads go straight
 * from the browser to ImageKit using a token minted by `owner-photo-upload`
 * — this component never sees an ImageKit key.
 *
 * Its own top-level card, paired beside Business & Owner in the Settings
 * grid.
 */
export function AboutPhotoCard(): JSX.Element {
  const { settings, update } = useBusinessSettings();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentPath = settings?.about_photo_path ?? FALLBACK_PATH;
  const displayUrl =
    previewUrl ??
    buildImageKitUrl(currentPath, { width: 340, height: 425, crop: 'maintain_ratio' });

  const onFileSelected = async (file: File): Promise<void> => {
    setError(null);

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('That image is too large — please choose one under 8MB.');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setUploading(true);
    try {
      const path = await uploadOwnerPhoto(file);
      await update({ about_photo_path: path });
    } catch (e) {
      setError(errorMessage(e));
      setPreviewUrl(null);
    } finally {
      setUploading(false);
      URL.revokeObjectURL(objectUrl);
    }
  };

  return (
    <Card className="flex h-full flex-col justify-center p-5">
      <h2 className="mb-1 font-serif text-base font-semibold text-foreground">
        About Photo
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Shown in the &ldquo;About Christy&rdquo; section of the public About page.
      </p>

      {/* Same aspect ratio as the crop on the live About page
          (`AboutPage.tsx`'s `aspect-[4/5]`), so what's previewed here is
          exactly how it will look on the marketing site — not a different
          shape stretched to fill whatever height this card happens to be. */}
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg border border-border">
        <img
          src={displayUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onFileSelected(file);
          e.target.value = '';
        }}
      />
      <Button
        variant="secondary"
        size="sm"
        className="mt-4 self-start"
        loading={uploading}
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlus aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
        {currentPath === FALLBACK_PATH ? 'Upload photo' : 'Change photo'}
      </Button>
      <p className="mt-2 text-xs text-muted-foreground">JPG or PNG, up to 8MB.</p>

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </Card>
  );
}
