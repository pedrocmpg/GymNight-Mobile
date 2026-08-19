/**
 * Component tests for StatRow — renders label and value text.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { StatRow } from '../StatRow';

describe('StatRow', () => {
  it('renders the value and label text', () => {
    const { getByText } = render(<StatRow label="no treino" value="6 exercícios" />);
    expect(getByText('6 exercícios')).toBeTruthy();
    expect(getByText('no treino')).toBeTruthy();
  });

  it('renders with testID', () => {
    const { getByTestId } = render(<StatRow label="média" value="52 min" testID="stat-duration" />);
    expect(getByTestId('stat-duration')).toBeTruthy();
  });
});
