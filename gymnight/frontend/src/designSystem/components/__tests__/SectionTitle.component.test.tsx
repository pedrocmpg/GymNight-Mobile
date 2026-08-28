/**
 * Component tests for SectionTitle — o .toUpperCase() é feito pelo próprio
 * componente, para que nenhum call site precise lembrar disso.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SectionTitle } from '../SectionTitle';
import { colors, typography } from '../../tokens';

describe('SectionTitle', () => {
  it('uppercases its text', () => {
    const { getByText, queryByText } = render(<SectionTitle>Atividade semanal</SectionTitle>);
    expect(getByText('ATIVIDADE SEMANAL')).toBeTruthy();
    expect(queryByText('Atividade semanal')).toBeNull();
  });

  it('leaves already-uppercase text alone', () => {
    const { getByText } = render(<SectionTitle>SEUS TREINOS</SectionTitle>);
    expect(getByText('SEUS TREINOS')).toBeTruthy();
  });

  it('styles the title as h3 in the primary text color', () => {
    const { getByText } = render(<SectionTitle>x</SectionTitle>);
    const style = Object.assign({}, ...[getByText('X').props.style].flat(Infinity).filter(Boolean));
    expect(style.color).toBe(colors.primaryText);
    expect(style.fontSize).toBe(typography.h3.fontSize);
    expect(style.fontFamily).toBe(typography.h3.fontFamily);
  });

  it('renders the right slot when given', () => {
    const { getByText } = render(
      <SectionTitle right={<Text>+ Novo</Text>}>Seus treinos</SectionTitle>,
    );
    expect(getByText('+ Novo')).toBeTruthy();
  });

  it('renders nothing extra when there is no right slot', () => {
    const { queryByText } = render(<SectionTitle>Seus treinos</SectionTitle>);
    expect(queryByText('+ Novo')).toBeNull();
  });
});
