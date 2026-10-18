import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RiskBadge } from './RiskBadge';
import React from 'react';

describe('RiskBadge', () => {
  it('renders LOW risk badge correctly', () => {
    render(<RiskBadge level="LOW" />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('Riesgo Bajo');
    expect(badge.className).toContain('bg-green-100');
  });

  it('renders MEDIUM risk badge correctly', () => {
    render(<RiskBadge level="MEDIUM" />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('Riesgo Medio');
    expect(badge.className).toContain('bg-yellow-100');
  });

  it('renders HIGH risk badge correctly', () => {
    render(<RiskBadge level="HIGH" />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('Riesgo Alto');
    expect(badge.className).toContain('bg-orange-100');
  });

  it('renders CRITICAL risk badge correctly', () => {
    render(<RiskBadge level="CRITICAL" />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('Riesgo Crítico');
    expect(badge.className).toContain('bg-red-100');
  });

  it('applies custom className', () => {
    render(<RiskBadge level="LOW" className="my-custom-class" />);
    const badge = screen.getByRole('status');
    expect(badge.className).toContain('my-custom-class');
  });
});
