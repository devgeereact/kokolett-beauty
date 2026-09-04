import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';

const KEY = 'kokolett-theme';

function Probe(): React.JSX.Element {
  const { theme, toggleTheme } = useTheme();
  return (
    <button type="button" onClick={toggleTheme}>
      {theme}
    </button>
  );
}

describe('ThemeProvider storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('writes nothing for a visitor who never touches the toggle', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    // Storing an unrequested preference on someone's device is exactly what
    // the cookies page would then have to account for. Do not create it.
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('writes the preference once the visitor actually chooses', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole('button'));
    expect(window.localStorage.getItem(KEY)).not.toBeNull();
  });
});
