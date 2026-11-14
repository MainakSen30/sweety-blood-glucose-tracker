import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import LandingPage from './LandingPage';

afterEach(cleanup);

function renderLanding() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
}

describe('LandingPage', () => {
  it('presents the patient and doctor experiences side by side', () => {
    renderLanding();

    expect(
      screen.getByRole('heading', { level: 1, name: /Better glucose tracking/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'One record, seen from both sides' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Patient experience' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Doctor experience' })).toBeInTheDocument();
    expect(
      screen.getByText('Illustrative previews. Names and readings are examples.'),
    ).toBeInTheDocument();
  });

  it('explains both workflows and the consent boundary', () => {
    renderLanding();

    expect(
      screen.getByRole('heading', { name: 'Four readings a day, kept in one place' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'The patients who invited you, read-only' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Consent is the connection' })).toBeInTheDocument();
    expect(screen.getByText("Doctors cannot edit readings, prescribe, or change a patient's record.")).toBeInTheDocument();
  });

  it('keeps sign in, registration and the in-page showcase reachable', () => {
    renderLanding();

    expect(
      screen.getAllByRole('link', { name: 'Sign in' }).some((link) => link.getAttribute('href') === '/login'),
    ).toBe(true);
    expect(
      screen
        .getAllByRole('link', { name: 'Get started' })
        .some((link) => link.getAttribute('href') === '/register'),
    ).toBe(true);
    expect(screen.getByRole('link', { name: /Explore Sweety/ })).toHaveAttribute(
      'href',
      '#experiences',
    );
  });
});
