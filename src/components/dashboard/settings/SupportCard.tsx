import type { JSX } from 'react';
import { ChevronRight, HelpCircle, Mail, MessageSquareText } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { routes } from '@/lib/routes';

const SUPPORT_EMAIL = 'booking@kokolettbeauty.com';

/** Real destinations only — a mailto to the salon's own inbox and the booking policy page. No fabricated help centre content. */
export function SupportCard(): JSX.Element {
  return (
    <Card className="p-5">
      <h2 className="mb-1 font-serif text-base font-semibold text-foreground">Support</h2>
      <p className="mb-3 text-sm text-muted-foreground">Get help and share feedback.</p>
      <div className="divide-y divide-border">
        <a
          href={routes.public.bookingPolicy}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted"
        >
          <HelpCircle
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-muted-foreground"
            strokeWidth={2}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">Help centre</span>
            <span className="block text-xs text-muted-foreground">
              Find answers to common questions
            </span>
          </span>
          <ChevronRight
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-muted-foreground"
            strokeWidth={2}
          />
        </a>
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted"
        >
          <Mail
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-muted-foreground"
            strokeWidth={2}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">
              Contact support
            </span>
            <span className="block text-xs text-muted-foreground">
              Get in touch with our team
            </span>
          </span>
          <ChevronRight
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-muted-foreground"
            strokeWidth={2}
          />
        </a>
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Kokolett dashboard feedback')}`}
          className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted"
        >
          <MessageSquareText
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-muted-foreground"
            strokeWidth={2}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">
              Send feedback
            </span>
            <span className="block text-xs text-muted-foreground">
              Help us improve Kokolett
            </span>
          </span>
          <ChevronRight
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-muted-foreground"
            strokeWidth={2}
          />
        </a>
      </div>
    </Card>
  );
}
