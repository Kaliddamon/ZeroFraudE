import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RiskBadge } from './RiskBadge';
import React from 'react';

describe('RiskBadge', () => {
  it('renders LOW risk badge correctly', () => {
    render(<RiskBadge level="LOW" />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('Riesgo Bajo');
    expect(badge).toHaveAttribute('aria-label', 'Nivel de riesgo: Riesgo Bajo');
  });

  it('renders MEDIUM risk badge correctly', () => {
    render(<RiskBadge level="MEDIUM" />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('Riesgo Medio');
    expect(badge).toHaveAttribute('aria-label', 'Nivel de riesgo: Riesgo Medio');
  });

  it('renders HIGH risk badge correctly', () => {
    render(<RiskBadge level="HIGH" />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('Riesgo Alto');
    expect(badge).toHaveAttribute('aria-label', 'Nivel de riesgo: Riesgo Alto');
  });

  it('renders CRITICAL risk badge correctly', () => {
    render(<RiskBadge level="CRITICAL" />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('Riesgo Crítico');
    expect(badge).toHaveAttribute('aria-label', 'Nivel de riesgo: Riesgo Crítico');
  });

  it('renders UNKNOWN fallback for null level', () => {
    render(<RiskBadge level={null} />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('Sin análisis');
    expect(badge).toHaveAttribute('aria-label', 'Nivel de riesgo: Sin análisis');
  });

  it('renders UNKNOWN fallback for undefined level', () => {
    render(<RiskBadge level={undefined} />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('Sin análisis');
  });

  it('renders UNKNOWN fallback for unrecognized level', () => {
    render(<RiskBadge level="UNKNOWN_LEVEL" />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('Sin análisis');
  });

  it('applies custom className', () => {
    render(<RiskBadge level="LOW" className="my-custom-class" />);
    const badge = screen.getByRole('status');
    expect(badge.className).toContain('my-custom-class');
  });

  it('renders a colored dot alongside the label', () => {
    render(<RiskBadge level="LOW" />);
    const dot = screen.getByRole('status').querySelector('span');
    expect(dot).toBeInTheDocument();
  });
});
