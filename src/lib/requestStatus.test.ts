import { describe, expect, it } from 'vitest';
import { laneForStatus, priorityFromWaitingHours } from '@/lib/requestStatus';

describe('laneForStatus', () => {
  it('maps new to the new lane', () => {
    expect(laneForStatus('new')).toBe('new');
  });

  it('collapses awaiting_response and offer_sent into one lane', () => {
    expect(laneForStatus('awaiting_response')).toBe('awaiting_response');
    expect(laneForStatus('offer_sent')).toBe('awaiting_response');
  });

  it('maps converted to the converted lane', () => {
    expect(laneForStatus('converted')).toBe('converted');
  });

  it('collapses declined and expired into the declined lane', () => {
    expect(laneForStatus('declined')).toBe('declined');
    expect(laneForStatus('expired')).toBe('declined');
  });
});

describe('priorityFromWaitingHours', () => {
  it('is low just under the 8h boundary', () => {
    expect(priorityFromWaitingHours(7.99)).toBe('low');
  });

  it('is medium exactly at the 8h boundary', () => {
    expect(priorityFromWaitingHours(8)).toBe('medium');
  });

  it('is medium just under the 24h boundary', () => {
    expect(priorityFromWaitingHours(23.99)).toBe('medium');
  });

  it('is high exactly at the 24h boundary', () => {
    expect(priorityFromWaitingHours(24)).toBe('high');
  });

  it('is high well past the 24h boundary', () => {
    expect(priorityFromWaitingHours(72)).toBe('high');
  });

  it('is low at zero', () => {
    expect(priorityFromWaitingHours(0)).toBe('low');
  });
});
