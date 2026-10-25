import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ModelScoreBar } from './ModelScoreBar';
import React from 'react';

describe('ModelScoreBar', () => {
  it('renders the score formatted to two decimals', () => {
    render(<ModelScoreBar score={0.5} />);
    expect(screen.getByText('0.50')).toBeInTheDocument();
  });

  it('renders the default label "Score de Riesgo"', () => {
    render(<ModelScoreBar score={0.5} />);
    expect(screen.getByText('Score de Riesgo')).toBeInTheDocument();
  });

  it('renders a custom label when provided', () => {
    render(<ModelScoreBar score={0.5} label="Probabilidad de Fraude" />);
    expect(screen.getByText('Probabilidad de Fraude')).toBeInTheDocument();
  });

  it('hides the score label when showLabel is false', () => {
    render(<ModelScoreBar score={0.5} showLabel={false} />);
    expect(screen.queryByText('Score de Riesgo')).not.toBeInTheDocument();
  });

  it('clamps scores above 1 to 1.00', () => {
    render(<ModelScoreBar score={1.5} />);
    expect(screen.getByText('1.00')).toBeInTheDocument();
  });

  it('clamps scores below 0 to 0.00', () => {
    render(<ModelScoreBar score={-0.5} />);
    expect(screen.getByText('0.00')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<ModelScoreBar score={0.5} className="my-custom-class" />);
    expect(container.querySelector('.my-custom-class')).toBeInTheDocument();
  });

  it('colors LOW risk level with emerald', () => {
    const { container } = render(<ModelScoreBar score={0.1} riskLevel="LOW" />);
    expect(container.querySelector('.bg-emerald-500')).toBeInTheDocument();
  });

  it('colors MEDIUM risk level with amber', () => {
    const { container } = render(<ModelScoreBar score={0.5} riskLevel="MEDIUM" />);
    expect(container.querySelector('.bg-amber-500')).toBeInTheDocument();
  });

  it('colors HIGH risk level with orange', () => {
    const { container } = render(<ModelScoreBar score={0.7} riskLevel="HIGH" />);
    expect(container.querySelector('.bg-orange-500')).toBeInTheDocument();
  });

  it('colors CRITICAL risk level with red', () => {
    const { container } = render(<ModelScoreBar score={0.9} riskLevel="CRITICAL" />);
    expect(container.querySelector('.bg-red-500')).toBeInTheDocument();
  });

  it('does not invent a risk category from score when riskLevel is absent', () => {
    const { container } = render(<ModelScoreBar score={0.9} />);
    // Un score alto sin riskLevel debe usar el estilo UNKNOWN (zinc),
    // no rojo/CRITICAL basado en bandas numéricas.
    expect(container.querySelector('.bg-zinc-500')).toBeInTheDocument();
    expect(container.querySelector('.bg-red-500')).not.toBeInTheDocument();
  });

  it('does not render a threshold tick line', () => {
    const { container } = render(<ModelScoreBar score={0.5} riskLevel="CRITICAL" />);
    expect(container.querySelector('[title*="Umbral"]')).not.toBeInTheDocument();
  });
});
