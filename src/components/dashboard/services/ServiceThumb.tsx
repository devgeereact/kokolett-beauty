import type { JSX } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { buildImageKitUrl } from '@/lib/imagekit';
import { cn } from '@/lib/utils';
import type { ServiceMenuItem } from '@/types';

const THUMB_PX: Record<'sm' | 'md' | 'lg', number> = { sm: 32, md: 40, lg: 48 };
const THUMB_CLASS: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
};

/** A real style photo when one's been uploaded, the same tinted placeholder as everywhere else when not. */
export function ServiceThumb({
  item,
  size,
}: {
  item: ServiceMenuItem;
  size: 'sm' | 'md' | 'lg';
}): JSX.Element {
  if (!item.image_path) return <Avatar name={item.name} size={size} />;
  const px = THUMB_PX[size];
  return (
    <img
      src={buildImageKitUrl(item.image_path, {
        width: px * 2,
        height: px * 2,
        crop: 'maintain_ratio',
      })}
      alt=""
      className={cn('shrink-0 rounded-lg object-cover', THUMB_CLASS[size])}
      loading="lazy"
      decoding="async"
    />
  );
}
