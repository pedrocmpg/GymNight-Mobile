/**
 * Busca de exercício no catálogo (Wave 8, PARIDADE-04-ROTINAS-PERFIL.md §3).
 * Com 200 exercícios (Wave 4.5), rolar a lista inteira fica inviável.
 *
 * Busca por substring, normalizada dos dois lados com o MESMO algoritmo da
 * Wave 4.5 (`seed_helpers.normalize_exercise_name`: NFD + remover acentos +
 * lowercase) — "supino" encontra "Supino Reto (Barra)" e "biceps" encontra
 * "Bíceps". Sem isso, todo exercício acentuado fica inacessível por busca.
 *
 * NÃO porta o trigram Jaccard do `NormalizationEngine` do desktop — ele
 * resolve texto livre digitado pelo usuário em nome canônico; o mobile
 * escolhe de catálogo fechado, então substring basta (fora de escopo,
 * PARIDADE-00-INDICE.md).
 */

export interface ExerciseForSearch {
  id: string;
  name: string;
}

/** NFD + remover diacríticos + lowercase — mesmo algoritmo de normalização
 * usado no seed do catálogo (Wave 4.5), para os dois lados da comparação
 * (query digitada e nome do exercício) baterem de forma consistente. */
// Faixa Unicode de marcas diacríticas combinantes (U+0300–U+036F), removidas
// depois da normalização NFD.
const COMBINING_DIACRITICS = /[̀-ͯ]/g;

export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .toLowerCase()
    .trim();
}

/**
 * Filtra o catálogo por substring da query, insensível a acento e caixa nos
 * dois sentidos. Query vazia (ou só espaços) devolve o catálogo inteiro,
 * inalterado; sem nenhum match devolve array vazio.
 *
 * @param exercises - Catálogo completo (ou já filtrado por outro critério)
 * @param query - Texto digitado pelo usuário
 *
 * Validates: PARIDADE-04-ROTINAS-PERFIL.md — properties 82, 83
 */
export function filterExercises<T extends ExerciseForSearch>(exercises: T[], query: string): T[] {
  const normalizedQuery = normalizeForSearch(query);
  if (normalizedQuery === '') return exercises;
  return exercises.filter((e) => normalizeForSearch(e.name).includes(normalizedQuery));
}
