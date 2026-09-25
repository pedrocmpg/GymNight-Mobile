/**
 * Component tests for CardioSection — lista de entradas, remoção, e o fluxo
 * de abrir o formulário e adicionar uma entrada nova.
 */
import React from 'react';
import { render, fireEvent, within } from '@testing-library/react-native';
import { CardioSection, type CardioSectionEntry } from '../CardioSection';

function makeEntry(overrides: Partial<CardioSectionEntry> & { id: string }): CardioSectionEntry {
  return {
    cardioType: 'Corrida Contínua (Trote)',
    durationMin: 30,
    distanceKm: null,
    pse: 7,
    ...overrides,
  };
}

describe('CardioSection', () => {
  it('não mostra nenhuma entrada quando a lista está vazia', () => {
    const { queryByTestId } = render(<CardioSection entries={[]} onAdd={jest.fn()} onRemove={jest.fn()} />);
    expect(queryByTestId(/cardio-entry-/)).toBeNull();
  });

  it('renderiza uma linha por entrada, com tipo, duração e calorias', () => {
    const entries = [makeEntry({ id: 'c1' }), makeEntry({ id: 'c2', cardioType: 'Vôlei', durationMin: 45, pse: 5 })];
    const { getByTestId } = render(<CardioSection entries={entries} onAdd={jest.fn()} onRemove={jest.fn()} />);

    // Escopado a cada card: o form de adicionar (sempre no DOM, dentro do
    // Modal mockado) também lista todo tipo de cardio, incluindo estes dois.
    expect(within(getByTestId('cardio-entry-c1')).getByText('Corrida Contínua (Trote)')).toBeTruthy();
    expect(within(getByTestId('cardio-entry-c2')).getByText('Vôlei')).toBeTruthy();
  });

  it('mostra a distância quando presente, e omite quando ausente', () => {
    const entries = [
      makeEntry({ id: 'c1', distanceKm: 5 }),
      makeEntry({ id: 'c2', distanceKm: null }),
    ];
    const { getByTestId } = render(<CardioSection entries={entries} onAdd={jest.fn()} onRemove={jest.fn()} />);
    expect(within(getByTestId('cardio-entry-c1')).getByText(/5km/)).toBeTruthy();
    expect(within(getByTestId('cardio-entry-c2')).getByText('30min · PSE 7')).toBeTruthy();
  });

  it('chama onRemove com o id correto ao tocar no botão de remover', () => {
    const onRemove = jest.fn();
    const entries = [makeEntry({ id: 'c1' })];
    const { getByTestId } = render(<CardioSection entries={entries} onAdd={jest.fn()} onRemove={onRemove} />);
    fireEvent.press(getByTestId('cardio-entry-remove-c1'));
    expect(onRemove).toHaveBeenCalledWith('c1');
  });

  it('abre o formulário ao tocar em "+ Cardio" e chama onAdd ao salvar', () => {
    const onAdd = jest.fn();
    const { getByTestId } = render(<CardioSection entries={[]} onAdd={onAdd} onRemove={jest.fn()} />);

    fireEvent.press(getByTestId('add-cardio-button'));
    expect(getByTestId('cardio-form')).toBeTruthy();

    fireEvent.changeText(getByTestId('cardio-type-search'), 'caminhada plana');
    fireEvent.press(getByTestId('cardio-type-option-Esteira (Caminhada Plana)'));
    fireEvent.changeText(getByTestId('cardio-duration-input'), '20');
    fireEvent.press(getByTestId('cardio-pse-3'));
    fireEvent.press(getByTestId('cardio-save-button'));

    expect(onAdd).toHaveBeenCalledWith({
      cardioType: 'Esteira (Caminhada Plana)',
      durationMin: 20,
      distanceKm: null,
      pse: 3,
    });
  });

  it('cancelar o formulário não chama onAdd', () => {
    const onAdd = jest.fn();
    const { getByTestId } = render(<CardioSection entries={[]} onAdd={onAdd} onRemove={jest.fn()} />);
    fireEvent.press(getByTestId('add-cardio-button'));
    fireEvent.press(getByTestId('cardio-cancel-button'));
    expect(onAdd).not.toHaveBeenCalled();
  });
});
