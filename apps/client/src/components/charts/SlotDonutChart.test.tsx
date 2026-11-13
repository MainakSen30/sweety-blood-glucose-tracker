import { afterEach, describe, it, expect } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SlotDonutChart } from './SlotDonutChart.js';
import type { ReadingSlot } from '../../types/reading.js';

afterEach(cleanup);

const ZERO_COUNTS: Record<ReadingSlot, number> = {
  morning: 0,
  after_breakfast: 0,
  after_lunch: 0,
  after_dinner: 0,
};

const SAMPLE_COUNTS: Record<ReadingSlot, number> = {
  morning: 10,
  after_breakfast: 8,
  after_lunch: 6,
  after_dinner: 8,
};

describe('SlotDonutChart', () => {
  it('renders empty state when total is zero', () => {
    render(<SlotDonutChart counts={ZERO_COUNTS} />);
    expect(screen.getByText('No readings for this period')).toBeInTheDocument();
  });

  it('does not render an SVG when total is zero', () => {
    const { container } = render(<SlotDonutChart counts={ZERO_COUNTS} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders total reading count in center', () => {
    render(<SlotDonutChart counts={SAMPLE_COUNTS} />);
    // 10+8+6+8 = 32
    expect(screen.getByText('32')).toBeInTheDocument();
    expect(screen.getByText('Total readings')).toBeInTheDocument();
  });

  it('renders all four slot labels in the legend', () => {
    render(<SlotDonutChart counts={SAMPLE_COUNTS} />);
    expect(screen.getByText('Morning')).toBeInTheDocument();
    expect(screen.getByText('After breakfast')).toBeInTheDocument();
    expect(screen.getByText('After lunch')).toBeInTheDocument();
    expect(screen.getByText('After dinner')).toBeInTheDocument();
  });

  it('renders correct percentages', () => {
    render(<SlotDonutChart counts={SAMPLE_COUNTS} />);
    // 10/32 = 31.25% → 31.3%, 8/32 = 25.0%, 6/32 = 18.75% → 18.8%, 8/32 = 25.0%
    expect(screen.getByText('31.3%')).toBeInTheDocument();
    const twentyFives = screen.getAllByText('25.0%');
    expect(twentyFives).toHaveLength(2);
    expect(screen.getByText('18.8%')).toBeInTheDocument();
  });

  it('renders reading counts in legend', () => {
    render(<SlotDonutChart counts={SAMPLE_COUNTS} />);
    expect(screen.getByText('10')).toBeInTheDocument();
    // 8 appears twice (after_breakfast and after_dinner)
    const eights = screen.getAllByText('8');
    expect(eights.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  it('renders an accessible SVG chart title', () => {
    render(<SlotDonutChart counts={SAMPLE_COUNTS} />);
    expect(screen.getByRole('img', { name: /readings by time slot/i })).toBeInTheDocument();
  });

  it('handles counts with only one slot having readings', () => {
    const onlyMorning: Record<ReadingSlot, number> = {
      morning: 5,
      after_breakfast: 0,
      after_lunch: 0,
      after_dinner: 0,
    };
    render(<SlotDonutChart counts={onlyMorning} />);
    // "5" appears in both the center total and the morning legend count
    const fives = screen.getAllByText('5');
    expect(fives.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('100.0%')).toBeInTheDocument();
  });
});
