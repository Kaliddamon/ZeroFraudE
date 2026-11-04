import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import React from 'react';
import {
  ExplainabilityPanel,
  translateFeatureName,
  type FeatureContribution,
} from './ExplainabilityPanel';

describe('ExplainabilityPanel', () => {
  const mockExplanations = [
    'Amount 32.3× above user average ($150)',
    'First transaction from this device (D_NEW_823461)',
    "Country NG not in user's recent history",
  ];

  const mockContributions: FeatureContribution[] = [
    {
      featureName: 'amount_z_score',
      contribution: 0.45,
      description: 'Monto muy por encima de la media histórica',
    },
    {
      featureName: 'is_new_device',
      contribution: 0.35,
      description: 'Dispositivo no registrado previamente',
    },
    {
      featureName: 'user_avg_amount_30d',
      contribution: -0.2,
      description: 'Cliente con alta recurrencia de compras',
    },
  ];

  it('1. renderiza las explicaciones textuales en lenguaje natural con sus categorías', () => {
    render(<ExplainabilityPanel explanations={mockExplanations} />);

    expect(screen.getByText('Explicación del modelo')).toBeInTheDocument();
    expect(screen.getByText('Amount 32.3× above user average ($150)')).toBeInTheDocument();
    expect(
      screen.getByText('First transaction from this device (D_NEW_823461)')
    ).toBeInTheDocument();
    expect(screen.getByText("Country NG not in user's recent history")).toBeInTheDocument();

    // Categorías inferidas
    expect(screen.getByText('Comportamiento del Monto')).toBeInTheDocument();
    expect(screen.getByText('Uso del Dispositivo')).toBeInTheDocument();
    expect(screen.getByText('Ubicación Geográfica')).toBeInTheDocument();
  });

  it('2. traduce correctamente los nombres técnicos conocidos a etiquetas comprensibles', () => {
    expect(translateFeatureName('amount_z_score')).toBe('Desviación de importe vs. media');
    expect(translateFeatureName('is_new_device')).toBe('Dispositivo no reconocido');
    expect(translateFeatureName('tx_count_5min')).toBe('Ráfaga de transacciones (5 min)');
    expect(translateFeatureName('is_night')).toBe('Operación en horario nocturno atípico');
    expect(translateFeatureName('behavioral_deviation')).toBe('Desviación del perfil conductual');

    // Caso de variable no en diccionario: reemplaza guiones bajos por espacios
    expect(translateFeatureName('custom_unmapped_feature')).toBe('custom unmapped feature');
  });

  it('3. renderiza contribuciones positivas indicando incremento de riesgo', () => {
    const positiveContrib: FeatureContribution[] = [
      {
        featureName: 'is_new_device',
        contribution: 0.8,
        label: 'Dispositivo no reconocido',
      },
    ];

    render(<ExplainabilityPanel contributions={positiveContrib} />);

    expect(screen.getByText('Dispositivo no reconocido')).toBeInTheDocument();
    expect(screen.getByText('+100.0%')).toBeInTheDocument();
  });

  it('4. renderiza contribuciones negativas indicando reducción de riesgo', () => {
    const negativeContrib: FeatureContribution[] = [
      {
        featureName: 'user_avg_amount_30d',
        contribution: -0.5,
        label: 'Historial confiable',
      },
    ];

    render(<ExplainabilityPanel contributions={negativeContrib} />);

    expect(screen.getByText('Historial confiable')).toBeInTheDocument();
    expect(screen.getByText('-100.0%')).toBeInTheDocument();
  });

  it('5. calcula correctamente los porcentajes de impacto relativo I_i = (|c_i| / sum|c_j|) * 100', () => {
    // total = |0.45| + |0.35| + |-0.20| = 1.00
    // I_0 = (0.45 / 1.00) * 100 = 45.0%
    // I_1 = (0.35 / 1.00) * 100 = 35.0%
    // I_2 = (0.20 / 1.00) * 100 = 20.0%
    render(<ExplainabilityPanel contributions={mockContributions} />);

    expect(screen.getByText('+45.0%')).toBeInTheDocument();
    expect(screen.getByText('+35.0%')).toBeInTheDocument();
    expect(screen.getByText('-20.0%')).toBeInTheDocument();
  });

  it('6. ordena los factores según su magnitud de impacto relativo descendente', () => {
    const unorderedContributions: FeatureContribution[] = [
      { featureName: 'tx_count_5min', contribution: 0.1 },
      { featureName: 'amount_z_score', contribution: -0.6 },
      { featureName: 'is_new_device', contribution: 0.3 },
    ];

    const { container } = render(
      <ExplainabilityPanel contributions={unorderedContributions} />
    );

    const items = container.querySelectorAll('.space-y-1\\.5');
    // El primero debe ser amount_z_score (| -0.6 | = 0.6 => 60%)
    expect(items[0]).toHaveTextContent('Desviación de importe vs. media');
    // El segundo debe ser is_new_device (| 0.3 | = 0.3 => 30%)
    expect(items[1]).toHaveTextContent('Dispositivo no reconocido');
    // El tercero debe ser tx_count_5min (| 0.1 | = 0.1 => 10%)
    expect(items[2]).toHaveTextContent('Ráfaga de transacciones (5 min)');
  });

  it('7. maneja adecuadamente contribuciones iguales a cero sin divisiones por cero', () => {
    const zeroContributions: FeatureContribution[] = [
      { featureName: 'feature_a', contribution: 0 },
      { featureName: 'feature_b', contribution: 0 },
    ];

    render(<ExplainabilityPanel contributions={zeroContributions} />);

    const percentages = screen.getAllByText('0.0%');
    expect(percentages.length).toBe(2);
  });

  it('8. maneja listas vacías de explicaciones mostrando estado informativo', () => {
    render(<ExplainabilityPanel explanations={[]} />);

    expect(
      screen.getByText('El modelo no proporcionó explicaciones para esta transacción.')
    ).toBeInTheDocument();
  });

  it('9. maneja información incompleta y valores por defecto con resiliencia', () => {
    render(<ExplainabilityPanel />);

    expect(screen.getByText('Explicación del modelo')).toBeInTheDocument();
    expect(
      screen.getByText('El modelo no proporcionó explicaciones para esta transacción.')
    ).toBeInTheDocument();
    expect(screen.getByText('Sin ID de usuario disponible')).toBeInTheDocument();
  });

  it('10. no inventa pesos ni porcentajes arbitrarios cuando solo hay explicaciones textuales', () => {
    render(<ExplainabilityPanel explanations={mockExplanations} />);

    // Verifica que no aparezcan porcentajes ficticios ni pesos inventados
    expect(screen.queryByText('+0.42')).not.toBeInTheDocument();
    expect(screen.queryByText('42%')).not.toBeInTheDocument();
    expect(screen.queryByText('+45.0%')).not.toBeInTheDocument();

    // Muestra la nota de transparencia XAI
    expect(screen.getByText(/Nota de Transparencia XAI:/i)).toBeInTheDocument();
  });

  it('11. genera el enlace correcto al perfil conductual cuando existe userId', () => {
    render(<ExplainabilityPanel explanations={mockExplanations} userId="U00042" />);

    const link = screen.getByRole('link', { name: /consultar perfil/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/profile/U00042');
  });

  it('12. no genera un enlace roto cuando userId no está disponible', () => {
    render(<ExplainabilityPanel explanations={mockExplanations} />);

    expect(screen.queryByRole('link', { name: /consultar perfil/i })).not.toBeInTheDocument();
    expect(screen.getByText('Sin ID de usuario disponible')).toBeInTheDocument();
  });
});
