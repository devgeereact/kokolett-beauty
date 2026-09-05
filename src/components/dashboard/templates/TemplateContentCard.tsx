import { type JSX, type RefObject, useMemo, useRef } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Strikethrough,
  Underline,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Field';

const CATEGORIES = [
  'Booking',
  'Reminders',
  'Reviews',
  'Availability requests',
  'Account access',
  'Owner notifications',
];

function execCmd(command: string, value?: string): void {
  document.execCommand(command, false, value);
}

/**
 * Length of the copy the customer will actually read, with the markup taken
 * out.
 *
 * Parsed rather than regex-stripped. `replace(/<[^>]+>/g, '')` looks like it
 * removes tags and does not: one pass over `<scr<script>ipt>` leaves a working
 * `<script>` behind, which is what CodeQL flags as incomplete multi-character
 * sanitization. Nothing was exploitable here, because the result was only ever
 * measured and never rendered, but a string that looks sanitised is exactly the
 * kind of thing somebody later reaches for in a context where it matters.
 *
 * Parsing is also simply more accurate: `&amp;` counts as one character rather
 * than five, and an attribute value no longer leaks into the total.
 */
function textLength(html: string): number {
  return (new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '')
    .length;
}

interface TemplateContentCardProps {
  templateLabel: string;
  category: string;
  onCategoryChange: (category: string) => void;
  subject: string;
  onSubjectChange: (subject: string) => void;
  variables: string[];
  bodyHtml: string;
  onBodyChange: (html: string) => void;
  editorRef: RefObject<HTMLDivElement | null>;
}

/**
 * Template name/category, the subject line, the "insert variable" picker
 * and the `contentEditable` rich-text editor — the one card that owns
 * `insertVarTarget` (subject vs. body), since only fields inside this card
 * can receive an inserted `{{token}}`.
 */
export function TemplateContentCard({
  templateLabel,
  category,
  onCategoryChange,
  subject,
  onSubjectChange,
  variables,
  bodyHtml,
  onBodyChange,
  editorRef,
}: TemplateContentCardProps): JSX.Element {
  const insertVarTarget = useRef<'subject' | 'body'>('body');
  const charCount = useMemo(() => textLength(bodyHtml), [bodyHtml]);

  const insertVariable = (name: string): void => {
    const token = `{{${name}}}`;
    if (insertVarTarget.current === 'subject') {
      onSubjectChange(`${subject}${token}`);
    } else {
      editorRef.current?.focus();
      document.execCommand('insertText', false, token);
      onBodyChange(editorRef.current?.innerHTML ?? bodyHtml);
    }
  };

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <Field label="Template name" className="mb-0 flex-1 min-w-[12rem]">
          {({ id }) => <Input id={id} value={templateLabel} disabled />}
        </Field>
        <Field label="Category" className="mb-0 w-48">
          {({ id }) => (
            <Select
              id={id}
              value={category}
              onChange={(e) => onCategoryChange(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Badge tone="primary">Email</Badge>
      </div>

      <Field label="Email subject">
        {({ id }) => (
          <div className="flex gap-2">
            <Input
              id={id}
              className="flex-1"
              value={subject}
              onFocus={() => {
                insertVarTarget.current = 'subject';
              }}
              onChange={(e) => onSubjectChange(e.target.value)}
            />
          </div>
        )}
      </Field>

      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">Template content</label>
        <Select
          aria-label="Insert variable"
          className="h-9 w-44 py-1 text-xs"
          value=""
          onFocus={() => {
            insertVarTarget.current = 'body';
          }}
          onChange={(e) => {
            if (e.target.value) insertVariable(e.target.value);
            e.target.value = '';
          }}
        >
          <option value="">{'{{}} Insert variable'}</option>
          {variables.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </Select>
      </div>

      <div className="rounded-md border border-border">
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border p-1.5">
          <select
            aria-label="Paragraph style"
            onMouseDown={(e) => e.preventDefault()}
            onChange={(e) => {
              execCmd('formatBlock', e.target.value);
              e.target.value = 'p';
            }}
            defaultValue="p"
            className="h-8 rounded-md border border-transparent bg-transparent px-2 text-xs text-foreground hover:bg-muted focus-visible:outline-none"
          >
            <option value="p">Paragraph</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
          </select>
          <span className="mx-1 h-5 w-px bg-border" />
          {[
            { icon: Bold, cmd: 'bold', label: 'Bold' },
            { icon: Italic, cmd: 'italic', label: 'Italic' },
            { icon: Underline, cmd: 'underline', label: 'Underline' },
            { icon: Strikethrough, cmd: 'strikeThrough', label: 'Strikethrough' },
          ].map((b) => (
            <button
              key={b.cmd}
              type="button"
              aria-label={b.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => execCmd(b.cmd)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground hover:bg-muted"
            >
              <b.icon aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-border" />
          {[
            { icon: List, cmd: 'insertUnorderedList', label: 'Bulleted list' },
            { icon: ListOrdered, cmd: 'insertOrderedList', label: 'Numbered list' },
          ].map((b) => (
            <button
              key={b.cmd}
              type="button"
              aria-label={b.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => execCmd(b.cmd)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground hover:bg-muted"
            >
              <b.icon aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-border" />
          {[
            { icon: AlignLeft, cmd: 'justifyLeft', label: 'Align left' },
            { icon: AlignCenter, cmd: 'justifyCenter', label: 'Align centre' },
            { icon: AlignRight, cmd: 'justifyRight', label: 'Align right' },
          ].map((b) => (
            <button
              key={b.cmd}
              type="button"
              aria-label={b.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => execCmd(b.cmd)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground hover:bg-muted"
            >
              <b.icon aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-border" />
          <button
            type="button"
            aria-label="Insert a link"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const url = window.prompt('Link URL');
              if (url) execCmd('createLink', url);
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground hover:bg-muted"
          >
            <LinkIcon aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            disabled
            aria-label="Insert an image (not available yet)"
            title="Image upload isn't wired up yet"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground opacity-50"
          >
            <ImageIcon aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        {/* A bare contentEditable is announced as an unlabelled edit region with
            no relationship to any label, and this is the only field for the
            salon's email copy. `role="textbox"` plus `aria-multiline` is what
            makes it a recognisable control (WCAG 1.3.1, 4.1.2). */}
        <div
          ref={editorRef}
          contentEditable
          role="textbox"
          aria-multiline="true"
          aria-label="Email body"
          tabIndex={0}
          suppressContentEditableWarning
          onInput={(e) => onBodyChange(e.currentTarget.innerHTML)}
          className="min-h-[280px] max-w-none p-4 text-sm text-foreground focus-visible:outline-none [&_p]:mb-3 [&_a]:text-primary [&_a]:underline"
        />

        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
          <span>div &gt; p</span>
          <span>Characters: {charCount}</span>
        </div>
      </div>
    </Card>
  );
}
