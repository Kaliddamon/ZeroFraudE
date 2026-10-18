import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MetricCard } from './MetricCard';
import React from 'react';

describe('MetricCard', () => {
  it('renders title and value correctly', () => {
    render(<MetricCard title="Total Transactions" value="1,234" />);
    expect(screen.getByText('Total Transactions')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });

  it('renders positive trend correctly', () => {
    render(
      <MetricCard 
        title="Revenue" 
        value="$5,000" 
        trend={{ value: 12.5, isPositive: true }} 
      />
    );
    expect(screen.getByText('12.5%')).toBeInTheDocument();
    // Verify it has the green class for positive trend
    const trendContainer = screen.getByText('12.5%').parentElement;
    expect(trendContainer?.className).toContain('text-green-600');
  });

  it('renders negative trend correctly', () => {
    render(
      <MetricCard 
        title="Fraud Rate" 
        value="2.4%" 
        trend={{ value: 0.5, isPositive: false }} 
      />
    );
    expect(screen.getByText('0.5%')).toBeInTheDocument();
    // Verify it has the red class for negative trend
    const trendContainer = screen.getByText('0.5%').parentElement;
    expect(trendContainer?.className).toContain('text-red-600');
  });
});
