import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Field, Input } from '@/components/ui/Field';

/**
 * The required asterisk beside the label is `aria-hidden`, and for a while it
 * was the *only* signal that a field was mandatory — so a screen-reader user
 * found out at submit. These lock in that the control itself carries the state.
 */
describe('Field accessibility contract', () => {
  it('labels the control, so clicking the label focuses it', () => {
    render(
      <Field label="Email">{({ controlProps }) => <Input {...controlProps} />}</Field>,
    );
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('marks a required field as required to assistive technology', () => {
    render(
      <Field label="Email" required>
        {({ controlProps }) => <Input {...controlProps} />}
      </Field>,
    );
    // Queried by role rather than exact label text: the required asterisk lives
    // inside the <label>, so the label's textContent is "Email *".
    expect(screen.getByRole('textbox', { name: /Email/ })).toHaveAttribute(
      'aria-required',
      'true',
    );
  });

  it('does not mark an optional field as required', () => {
    render(
      <Field label="Mobile">{({ controlProps }) => <Input {...controlProps} />}</Field>,
    );
    expect(screen.getByLabelText('Mobile')).not.toHaveAttribute('aria-required');
  });

  it('links the hint to the control', () => {
    render(
      <Field label="Email" hint="Your confirmation goes here.">
        {({ controlProps }) => <Input {...controlProps} />}
      </Field>,
    );
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(
      'Your confirmation goes here.',
    );
  });

  it('announces an error and marks the control invalid', () => {
    render(
      <Field label="Email" error="That address is not valid.">
        {({ controlProps }) => <Input {...controlProps} />}
      </Field>,
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('That address is not valid.');
    // role="alert" so it is spoken, never signalled by a red border alone.
    expect(screen.getByRole('alert')).toHaveTextContent('That address is not valid.');
  });

  it('keeps the older { id, describedBy } render-prop shape working', () => {
    render(
      <Field label="Note" hint="Optional.">
        {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} />}
      </Field>,
    );
    expect(screen.getByLabelText('Note')).toHaveAccessibleDescription('Optional.');
  });
});
