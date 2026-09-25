/**
 * Funções puras do wizard de onboarding (Wave 8, PARIDADE-04-ROTINAS-PERFIL.md
 * §2). Porta `GymNight-Desktop/src/ui/screens/setup.py` — 4 passos (nome,
 * peso+altura, gênero, objetivo), sem nenhuma dependência de banco/rede.
 *
 * Diferença deliberada do desktop: lá os dados vão para um arquivo solto
 * `user_data.json`; aqui vão para a tabela `users` (§2.3) — sincroniza de
 * graça e sobrevive a reinstalação.
 */

/** Nome obrigatório — mesma regra de isValidWorkoutName (não vazio/só espaço). */
export function isValidName(name: string): boolean {
  return name.trim().length > 0;
}

/** Peso em kg, faixa 30–300 (inclusive), verbatim do desktop. */
export function isValidWeight(weight: number): boolean {
  return Number.isFinite(weight) && weight >= 30 && weight <= 300;
}

/** Altura em cm, faixa 100–250 (inclusive), verbatim do desktop. */
export function isValidHeight(height: number): boolean {
  return Number.isFinite(height) && height >= 100 && height <= 250;
}

export const GENDER_OPTIONS = ['Masculino', 'Feminino', 'Outro'] as const;
export type GenderOption = (typeof GENDER_OPTIONS)[number];

export interface GoalOption {
  id: string;
  label: string;
  description: string;
}

/** As 4 opções de objetivo, verbatim de setup.py:566-571. */
export const GOAL_OPTIONS: readonly GoalOption[] = [
  { id: 'Hipertrofia', label: 'Hipertrofia', description: 'Ganho de massa muscular' },
  { id: 'Emagrecimento', label: 'Emagrecimento', description: 'Perda de gordura' },
  { id: 'Resistência', label: 'Resistência', description: 'Condicionamento físico' },
  { id: 'Saúde', label: 'Saúde', description: 'Qualidade de vida geral' },
];

const MAX_GOALS = 2;

/**
 * Alterna a seleção de um objetivo com evicção FIFO (setup.py:663): até
 * `MAX_GOALS` (2) selecionados; tentar adicionar um terceiro NÃO bloqueia —
 * o MAIS ANTIGO sai e o novo entra no fim. Tocar num já selecionado o
 * desmarca (nunca aciona a evicção).
 *
 * @param selected - objetivos selecionados, em ordem de seleção (mais antigo primeiro)
 * @param goalId - objetivo tocado
 *
 * Validates: PARIDADE-04-ROTINAS-PERFIL.md — properties 79, 80
 */
export function toggleGoalFifo(selected: readonly string[], goalId: string): string[] {
  if (selected.includes(goalId)) {
    return selected.filter((g) => g !== goalId);
  }
  if (selected.length < MAX_GOALS) {
    return [...selected, goalId];
  }
  // Evicção FIFO: remove o mais antigo (índice 0), o novo entra no fim.
  return [...selected.slice(1), goalId];
}

/** Serializa até 2 objetivos como string separada por vírgula — a única
 * coluna multi-valor do schema (§2.3), já que não há tabela de junção. */
export function serializeGoals(goals: readonly string[]): string {
  return goals.join(',');
}

/** Inverso de serializeGoals — string vazia (nunca preenchido) vira array vazio. */
export function parseGoals(serialized: string | null): string[] {
  if (!serialized) return [];
  return serialized.split(',').filter((g) => g.length > 0);
}
