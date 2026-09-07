import { type JSX } from 'react';
import { CalendarSubscription } from '@/components/dashboard/CalendarSubscription';
import { Card } from '@/components/ui/Card';

export function YourCalendarCard(): JSX.Element {
  return (
    <Card pad="standard">
      <CalendarSubscription />
    </Card>
  );
}
