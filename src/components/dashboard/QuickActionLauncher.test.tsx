import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ToastProvider } from '@/context/ToastContext';

/**
 * `NewBookingPanel` is mocked out entirely — it has its own responsibilities
 * (and no test coverage of its own yet) that aren't this component's job to
 * re-verify. What matters here is only that the launcher wires the right
 * `prefill`/`onBooked`/`onClose` into it for each of the two actions that
 * render it.
 */
vi.mock('@/components/dashboard/NewBookingPanel', () => ({
  NewBookingPanel: (props: {
    prefill?: { fullName: string; email: string; mobile: string } | null;
    onBooked: (reference: string) => void;
    onClose: () => void;
  }) => (
    <div data-testid="new-booking-panel">
      <p data-testid="prefill">{props.prefill ? JSON.stringify(props.prefill) : 'none'}</p>
      <button onClick={() => props.onBooked('KB-TEST1')}>Fire onBooked</button>
      <button onClick={props.onClose}>Fire onClose (panel)</button>
    </div>
  ),
}));

const appointmentService = vi.hoisted(() => ({
  listAppointments: vi.fn(),
  setAppointmentStatus: vi.fn(),
}));
vi.mock('@/services/appointmentService', () => appointmentService);

const customerService = vi.hoisted(() => ({ listCustomers: vi.fn() }));
vi.mock('@/services/customerService', () => customerService);

const requestService = vi.hoisted(() => ({ listQueuedRequests: vi.fn() }));
vi.mock('@/services/requestService', () => requestService);

vi.mock('@/hooks/useBusinessSettings', () => ({
  useBusinessSettings: () => ({ timezone: 'Europe/London', settings: null }),
}));

const { QuickActionLauncher } = await import(
  '@/components/dashboard/QuickActionLauncher'
);

function LocationProbe(): JSX.Element {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderLauncher(): void {
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/dashboard']}>
        <QuickActionLauncher />
        <LocationProbe />
      </MemoryRouter>
    </ToastProvider>,
  );
}

const sampleAppointment = {
  id: 'apt-1',
  reference: 'KB-0001',
  customer_name: 'Jane Doe',
  customer_email: 'jane@example.invalid',
  customer_mobile: '07700900001',
  starts_at: '2026-08-13T10:00:00Z',
  ends_at: '2026-08-13T11:00:00Z',
  status: 'confirmed',
};

const sampleCustomer = {
  id: 'cust-1',
  full_name: 'Priya Shah',
  email: 'priya@example.invalid',
  mobile: '07700900002',
};

const sampleRequest = {
  id: 'req-1',
  queue_position: 1,
  full_name: 'Amara Okafor',
  email: 'amara@example.invalid',
  mobile: '07700900003',
  waiting_hours: 5,
  service_id: null,
  service_name: null,
  preferred_dates: ['2026-08-20'],
  preferred_times: null,
  flexibility: 'any',
  notes: null,
  status: 'new',
  owner_response: null,
  created_at: '2026-08-13T09:00:00Z',
};

describe('QuickActionLauncher', () => {
  beforeEach(() => {
    appointmentService.listAppointments.mockReset().mockResolvedValue([sampleAppointment]);
    appointmentService.setAppointmentStatus.mockReset().mockResolvedValue({});
    customerService.listCustomers.mockReset().mockResolvedValue([sampleCustomer]);
    requestService.listQueuedRequests.mockReset().mockResolvedValue([sampleRequest]);
  });

  it('renders only the trigger button until opened', () => {
    renderLauncher();
    expect(screen.getByRole('button', { name: /Quick actions/ })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens via the header trigger button, listing all 4 actions', async () => {
    const user = userEvent.setup();
    renderLauncher();

    await user.click(screen.getByRole('button', { name: /Quick actions/ }));

    const dialog = screen.getByRole('dialog', { name: 'Quick actions' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New booking/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mark completed/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rebook customer/ })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Offer slot to request/ }),
    ).toBeInTheDocument();
  });

  it('opens via Cmd+K (metaKey) from anywhere in the document', () => {
    renderLauncher();
    fireEvent.keyDown(document.body, { key: 'k', metaKey: true });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('opens via Ctrl+K (ctrlKey) from anywhere in the document', () => {
    renderLauncher();
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('ignores Cmd+K while focused in a text input, so typing there is never hijacked', () => {
    render(
      <ToastProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <input aria-label="Somewhere else in the app" />
          <QuickActionLauncher />
        </MemoryRouter>
      </ToastProvider>,
    );
    const input = screen.getByLabelText('Somewhere else in the app');
    fireEvent.keyDown(input, { key: 'k', metaKey: true });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('ignores Cmd+K while focused in a textarea', () => {
    render(
      <ToastProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <textarea aria-label="A note field" />
          <QuickActionLauncher />
        </MemoryRouter>
      </ToastProvider>,
    );
    const textarea = screen.getByLabelText('A note field');
    fireEvent.keyDown(textarea, { key: 'k', metaKey: true });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('ignores Cmd+K while focused in a contenteditable element', () => {
    render(
      <ToastProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <div contentEditable data-testid="editable" />
          <QuickActionLauncher />
        </MemoryRouter>
      </ToastProvider>,
    );
    fireEvent.keyDown(screen.getByTestId('editable'), { key: 'k', metaKey: true });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('moves focus into the dialog on open (first action), and back to the trigger on close', async () => {
    const user = userEvent.setup();
    renderLauncher();

    const trigger = screen.getByRole('button', { name: /Quick actions/ });
    await user.click(trigger);
    expect(screen.getByRole('button', { name: /New booking/ })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('arrow keys cycle focus between the 4 actions, wrapping at both ends', async () => {
    const user = userEvent.setup();
    renderLauncher();
    await user.click(screen.getByRole('button', { name: /Quick actions/ }));

    const newBooking = screen.getByRole('button', { name: /New booking/ });
    const markCompleted = screen.getByRole('button', { name: /Mark completed/ });
    const rebook = screen.getByRole('button', { name: /Rebook customer/ });
    const offerSlot = screen.getByRole('button', { name: /Offer slot to request/ });

    expect(newBooking).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(markCompleted).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(rebook).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(offerSlot).toHaveFocus();
    // Wraps past the last action back to the first.
    await user.keyboard('{ArrowDown}');
    expect(newBooking).toHaveFocus();
    // Wraps the other way from the first action back to the last.
    await user.keyboard('{ArrowUp}');
    expect(offerSlot).toHaveFocus();
  });

  it('Enter activates the arrow-focused action (native button behaviour)', async () => {
    const user = userEvent.setup();
    renderLauncher();
    await user.click(screen.getByRole('button', { name: /Quick actions/ }));

    await user.keyboard('{ArrowDown}'); // New booking -> Mark completed
    await user.keyboard('{Enter}');

    expect(
      await screen.findByRole('heading', { name: 'Mark completed' }),
    ).toBeInTheDocument();
  });

  it('Escape closes the whole launcher, even mid-action (not just a step back)', async () => {
    const user = userEvent.setup();
    renderLauncher();
    await user.click(screen.getByRole('button', { name: /Quick actions/ }));
    await user.click(screen.getByRole('button', { name: /Mark completed/ }));
    expect(await screen.findByRole('heading', { name: 'Mark completed' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes via the backdrop click', async () => {
    const user = userEvent.setup();
    renderLauncher();
    await user.click(screen.getByRole('button', { name: /Quick actions/ }));
    await user.click(screen.getByRole('button', { name: 'Close quick actions' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  describe('New booking', () => {
    it('renders NewBookingPanel with no prefill; onBooked toasts and closes; onClose closes', async () => {
      const user = userEvent.setup();
      renderLauncher();
      await user.click(screen.getByRole('button', { name: /Quick actions/ }));
      await user.click(screen.getByRole('button', { name: /^New booking/ }));

      expect(screen.getByTestId('prefill')).toHaveTextContent('none');

      await user.click(screen.getByRole('button', { name: 'Fire onBooked' }));

      expect(screen.getByRole('status')).toHaveTextContent('Booked. Reference KB-TEST1.');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it("onClose closes the launcher entirely, not just back to the menu", async () => {
      const user = userEvent.setup();
      renderLauncher();
      await user.click(screen.getByRole('button', { name: /Quick actions/ }));
      await user.click(screen.getByRole('button', { name: /^New booking/ }));

      await user.click(screen.getByRole('button', { name: 'Fire onClose (panel)' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Mark completed', () => {
    it('searches live appointments and marks the selected one completed with no confirmation', async () => {
      const user = userEvent.setup();
      renderLauncher();
      await user.click(screen.getByRole('button', { name: /Quick actions/ }));
      await user.click(screen.getByRole('button', { name: /Mark completed/ }));

      expect(appointmentService.listAppointments).toHaveBeenCalledWith(
        expect.objectContaining({ statuses: ['confirmed', 'checked_in', 'in_service'] }),
      );

      const result = await screen.findByRole('button', { name: /Jane Doe/ });
      await user.click(result);

      expect(appointmentService.setAppointmentStatus).toHaveBeenCalledWith(
        'apt-1',
        'completed',
      );
      expect(screen.getByRole('status')).toHaveTextContent(
        "Marked Jane Doe's appointment as completed.",
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('ArrowDown from the search field moves focus into the first result, and Enter selects it', async () => {
      // The top-level-menu keyboard test only covers the 4 actions; this
      // covers the same generic data-quicklauncher-item mechanism one level
      // in, inside a step's own search results — arrow keys move real DOM
      // focus from the search input onto the first result button, and Enter
      // activates it natively (no bespoke Enter handling in the component).
      const user = userEvent.setup();
      renderLauncher();
      await user.click(screen.getByRole('button', { name: /Quick actions/ }));
      await user.click(screen.getByRole('button', { name: /Mark completed/ }));

      const result = await screen.findByRole('button', { name: /Jane Doe/ });
      const searchField = screen.getByLabelText('Find the appointment');
      expect(searchField).toHaveFocus();

      await user.keyboard('{ArrowDown}');
      expect(result).toHaveFocus();

      await user.keyboard('{Enter}');

      expect(appointmentService.setAppointmentStatus).toHaveBeenCalledWith(
        'apt-1',
        'completed',
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('filters results client-side as the owner types', async () => {
      const user = userEvent.setup();
      appointmentService.listAppointments.mockResolvedValue([
        sampleAppointment,
        {
          ...sampleAppointment,
          id: 'apt-2',
          customer_name: 'Someone Else',
          customer_email: 'someone@example.invalid',
          customer_mobile: '07700900099',
          reference: 'KB-0002',
        },
      ]);
      renderLauncher();
      await user.click(screen.getByRole('button', { name: /Quick actions/ }));
      await user.click(screen.getByRole('button', { name: /Mark completed/ }));

      await screen.findByRole('button', { name: /Jane Doe/ });
      await user.type(screen.getByLabelText('Find the appointment'), 'Jane');

      expect(screen.getByRole('button', { name: /Jane Doe/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Someone Else/ })).not.toBeInTheDocument();
    });
  });

  describe('Rebook customer', () => {
    it('searches customers, then opens NewBookingPanel prefilled with the selected one', async () => {
      const user = userEvent.setup();
      renderLauncher();
      await user.click(screen.getByRole('button', { name: /Quick actions/ }));
      await user.click(screen.getByRole('button', { name: /Rebook customer/ }));

      const result = await screen.findByRole('button', { name: /Priya Shah/ });
      await user.click(result);

      expect(screen.getByTestId('prefill')).toHaveTextContent(
        JSON.stringify({
          fullName: 'Priya Shah',
          email: 'priya@example.invalid',
          mobile: '07700900002',
        }),
      );

      await user.click(screen.getByRole('button', { name: 'Fire onBooked' }));
      expect(screen.getByRole('status')).toHaveTextContent(
        "Booked Priya Shah's next visit. Reference KB-TEST1.",
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Offer slot to request', () => {
    it('searches the open request queue and navigates to Inbox’s Requests tab on selection', async () => {
      const user = userEvent.setup();
      renderLauncher();
      await user.click(screen.getByRole('button', { name: /Quick actions/ }));
      await user.click(screen.getByRole('button', { name: /Offer slot to request/ }));

      const result = await screen.findByRole('button', { name: /Amara Okafor/ });
      await user.click(result);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await waitFor(() =>
        expect(screen.getByTestId('location')).toHaveTextContent(
          '/dashboard/inbox?tab=requests',
        ),
      );
    });
  });
});
