import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadCsv } from '@/lib/csv';

/** Captures the Blob passed to `URL.createObjectURL` so a test can read back its text. */
function captureBlob(): { get: () => Promise<string> } {
  let captured: Blob | null = null;
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    captured = blob as Blob;
    return 'blob:mock';
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  return { get: () => captured!.text() };
}

describe('downloadCsv', () => {
  // jsdom actually navigates on a real <a>.click(), which floods the console
  // with "Not implemented" noise — stub it out for every test in this file.
  beforeEach(() => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('joins cells with commas and rows with CRLF', async () => {
    const blob = captureBlob();
    downloadCsv('test.csv', [
      ['Name', 'Email'],
      ['Jane', 'jane@example.com'],
    ]);
    expect(await blob.get()).toBe('Name,Email\r\nJane,jane@example.com');
  });

  it('quotes a cell containing a comma', async () => {
    const blob = captureBlob();
    downloadCsv('test.csv', [['Smith, Jane', 'x']]);
    expect(await blob.get()).toBe('"Smith, Jane",x');
  });

  it('quotes and escapes a cell containing a double quote', async () => {
    const blob = captureBlob();
    downloadCsv('test.csv', [['She said "hi"', 'x']]);
    expect(await blob.get()).toBe('"She said ""hi""",x');
  });

  it('quotes a cell containing a newline', async () => {
    const blob = captureBlob();
    downloadCsv('test.csv', [['line1\nline2', 'x']]);
    expect(await blob.get()).toBe('"line1\nline2",x');
  });

  it('leaves a plain cell unquoted', async () => {
    const blob = captureBlob();
    downloadCsv('test.csv', [['plain', '42']]);
    expect(await blob.get()).toBe('plain,42');
  });

  it('sets the download filename on the anchor it clicks', () => {
    captureBlob();
    const clickSpy = vi.fn();
    const anchor = {
      href: '',
      download: '',
      click: clickSpy,
    } as unknown as HTMLAnchorElement;
    const createSpy = vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((n) => n);
    const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((n) => n);

    downloadCsv('customers.csv', [['a']]);

    expect(anchor.download).toBe('customers.csv');
    expect(clickSpy).toHaveBeenCalledOnce();
    createSpy.mockRestore();
    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
