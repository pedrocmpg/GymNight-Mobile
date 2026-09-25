/**
 * Funções puras de cardio (Wave 9, PARIDADE-05-CARDIO.md §3). Porta
 * `GymNight-Desktop/src/ui/screens/cardio_widget.py:69-86`, `estimate_calories`.
 *
 * ⚠️ Metodologia DIFERENTE da calorias de musculação (Wave 6,
 * `historyDomainUtils.computeCaloriesBurned`): lá o MET vem de uma tabela por
 * exercício e o tempo é `reps × 4s`; aqui o MET vem de um bucket de PSE e o
 * tempo é a duração informada pelo usuário. São duas fórmulas incompatíveis
 * que o desktop nunca soma numa métrica única — replicadas aqui como estão
 * (paridade é o objetivo desta série), mas com o peso default UNIFICADO em
 * 70kg nas duas (o desktop usa 75kg só no cardio — mais uma inconsistência
 * dele; decisão já tomada, não reabrir).
 */

/** Duração mínima de cardio, em minutos, sempre > 0. */
export function isValidCardioDuration(durationMin: number): boolean {
  return Number.isFinite(durationMin) && durationMin > 0;
}

/** PSE (Percepção Subjetiva de Esforço): inteiro de 1 a 10, inclusive. */
export function isValidPse(pse: number): boolean {
  return Number.isInteger(pse) && pse >= 1 && pse <= 10;
}

/** Distância é sempre opcional; quando informada, precisa ser >= 0. */
export function isValidCardioDistance(distanceKm: number | null): boolean {
  return distanceKm === null || (Number.isFinite(distanceKm) && distanceKm >= 0);
}

const PSE_LABELS = [
  { max: 3, emoji: '😌', label: 'Leve' },
  { max: 6, emoji: '😊', label: 'Moderado' },
  { max: 8, emoji: '😤', label: 'Intenso' },
  { max: 10, emoji: '🔥', label: 'Máximo' },
] as const;

/** Rótulo de referência (emoji + texto) do bucket de PSE — mesmos 4 buckets
 * do desktop (cardio_widget.py:437-440): Leve/Moderado/Intenso/Máximo. */
export function pseLabelFor(pse: number): { emoji: string; label: string } {
  const bucket = PSE_LABELS.find((b) => pse <= b.max) ?? PSE_LABELS[PSE_LABELS.length - 1];
  return { emoji: bucket.emoji, label: bucket.label };
}

/** MET pelo bucket de PSE — verbatim de `estimate_calories`. */
function metForPse(pse: number): number {
  if (pse <= 3) return 3.0;
  if (pse <= 6) return 6.0;
  if (pse <= 8) return 9.0;
  return 12.0;
}

/**
 * Estimativa de calorias de cardio: `MET(pse) × peso × horas`, TRUNCADA (não
 * arredondada) — verbatim de `estimate_calories` (`int()` do Python trunca
 * para valores positivos).
 *
 * @param durationMin - duração em minutos (deve ser > 0; entrada inválida não é validada aqui)
 * @param pse - Percepção Subjetiva de Esforço, 1-10
 * @param weightKg - peso do usuário; default 70 (unificado com a musculação — decisão da wave)
 *
 * Validates: PARIDADE-05-CARDIO.md — properties 85, 86
 */
export function estimateCardioCalories(durationMin: number, pse: number, weightKg = 70): number {
  const met = metForPse(pse);
  const hours = durationMin / 60;
  return Math.trunc(met * weightKg * hours);
}
