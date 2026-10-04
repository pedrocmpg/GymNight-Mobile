/**
 * Component tests for SectionTitle — sentence case como recebido, metadado
 * opcional e ação à direita.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SectionTitle } from '../SectionTitle';
import { colors, typography } from '../../tokens';

describe('SectionTitle', () => {
  it('renders its text as given — no uppercasing', () => {
    const { getByText, queryByText } = render(<SectionTitle>Atividade semanal</SectionTitle>);
    expect(getByText('Atividade semanal')).toBeTruthy();
    expect(queryByText('ATIVIDADE SEMANAL')).toBeNull();
  });

  it('styles the title as h3 in the primary text color, announced as a header', () => {
    const { getByText } = render(<SectionTitle>Seus treinos</SectionTitle>);
    const title = getByText('Seus treinos');
    const style = Object.assign({}, ...[title.props.style].flat(Infinity).filter(Boolean));
    expect(style.color).toBe(colors.primaryText);
    expect(style.fontSize).toBe(typography.h3.fontSize);
    expect(style.fontFamily).toBe(typography.h3.fontFamily);
    expect(title.props.accessibilityRole).toBe('header');
  });

  it('renders the meta text in a quieter tone', () => {
    const { getByText } = render(<SectionTitle meta="3 de 7 dias">Esta semana</SectionTitle>);
    const style = Object.assign(
      {},
      ...[getByText('3 de 7 dias').props.style].flat(Infinity).filter(Boolean),
    );
    expect(style.color).toBe(colors.tertiaryText);
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
