import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { GlucoseTrendChart, type TrendReading } from './GlucoseTrendChart.js';

afterEach(cleanup);

function reading(
  id: string,
  readingDate: string,
  slot: TrendReading['slot'],
  value: number,
): TrendReading {
  return { id, readingDate, slot, value };
}

const MONTH_READINGS: TrendReading[] = [
  reading('1', '01-11-2026', 'morning', 95),
  reading('2', '01-11-2026', 'after_breakfast', 126),
  reading('3', '03-11-2026', 'after_lunch', 140),
  reading('4', '05-11-2026', 'after_dinner', 118),
];

describe('GlucoseTrendChart', () => {
  it('renders its title, subtitle, and unit', () => {
    render(<GlucoseTrendChart readings={MONTH_READINGS} />);

    expect(screen.getByRole('heading', { name: 'Glucose trends' })).toBeInTheDocument();
    expect(screen.getByText('Your recorded glucose readings over time')).toBeInTheDocument();
    expect(screen.getByText('mg/dL')).toBeInTheDocument();
  });

  it('plots every individual reading without aggregating', () => {
    render(<GlucoseTrendChart readings={MONTH_READINGS} />);

    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(
      screen.getByRole('button', { name: '1 November 2026, Morning (fasting), 95 mg/dL' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '1 November 2026, After breakfast, 126 mg/dL' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '3 November 2026, After lunch, 140 mg/dL' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '5 November 2026, After dinner, 118 mg/dL' }),
    ).toBeInTheDocument();
  });

  it('distinguishes multiple readings recorded on the same day', () => {
    render(<GlucoseTrendChart readings={MONTH_READINGS} />);

    expect(screen.getAllByRole('button', { name: /1 November 2026/ })).toHaveLength(2);
  });

  it('connects observations across dates with a single line', () => {
    const { container } = render(<GlucoseTrendChart readings={MONTH_READINGS} />);

    expect(container.querySelector('polyline')).not.toBeNull();
    expect(screen.getByText('01 Nov')).toBeInTheDocument();
    expect(screen.getByText('05 Nov')).toBeInTheDocument();
    // 02 Nov has no reading, so it never appears on the axis.
    expect(screen.queryByText('02 Nov')).not.toBeInTheDocument();
  });

  it('does not invent a trend line for a single observation', () => {
    const { container } = render(
      <GlucoseTrendChart readings={[reading('1', '12-11-2026', 'after_breakfast', 126)]} />,
    );

    expect(container.querySelector('polyline')).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByText('Breakfast')).toBeInTheDocument();
  });

  it('switches to a slot axis when every reading is on one day', () => {
    const sameDay = [
      reading('1', '12-11-2026', 'morning', 95),
      reading('2', '12-11-2026', 'after_lunch', 130),
    ];
    render(<GlucoseTrendChart readings={sameDay} />);

    expect(screen.getByText('Morning')).toBeInTheDocument();
    expect(screen.getByText('Lunch')).toBeInTheDocument();
    expect(screen.getByText('Dinner')).toBeInTheDocument();
    expect(screen.queryByText('12 Nov')).not.toBeInTheDocument();
  });

  it('shows a subtle empty state instead of an empty chart', () => {
    const { container } = render(<GlucoseTrendChart readings={[]} />);

    expect(screen.getByText('No readings for this period')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('provides a text summary for assistive technologies', () => {
    render(<GlucoseTrendChart readings={MONTH_READINGS} />);

    expect(
      screen.getByText(/4 readings on 1 November 2026 to 5 November 2026/),
    ).toBeInTheDocument();
  });
});
