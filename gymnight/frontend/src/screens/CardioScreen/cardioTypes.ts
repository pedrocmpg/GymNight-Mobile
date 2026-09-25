/**
 * Catálogo de tipos de cardio (Wave 9, PARIDADE-05-CARDIO.md §2).
 *
 * Fonte: `GymNight-Desktop/docs/tipo_cardios.md`, transcrito verbatim (nomes,
 * intensidade, faixa de PSE e — principalmente — a DESCRIÇÃO do esforço, que
 * é o que torna o PSE utilizável: sem ela o usuário não sabe diferenciar 6
 * de 7).
 *
 * Diferente do catálogo de exercícios (Wave 4.5): são só ~20 linhas que não
 * mudam, então viram uma constante TypeScript versionada no repo — **nada de
 * tabela nem de sync** para isto.
 */

export interface CardioType {
  name: string;
  intensity: string;
  /** Faixa de PSE de referência para este tipo, como texto de exibição (ex: "6 - 8"). */
  pseRange: string;
  description: string;
}

export const CARDIO_TYPES: readonly CardioType[] = [
  // --- Máquinas (Academia) ---
  {
    name: 'Esteira (Caminhada Plana)',
    intensity: 'Baixa',
    pseRange: '2 - 3',
    description: 'Respiração normal, dá para cantar uma música.',
  },
  {
    name: 'Bicicleta Ergométrica (Leve)',
    intensity: 'Baixa',
    pseRange: '2 - 3',
    description: 'Esforço mínimo, usado para soltar a musculatura.',
  },
  {
    name: 'Elíptico (Ritmo constante)',
    intensity: 'Moderada',
    pseRange: '4 - 5',
    description: 'Respiração um pouco mais funda, mas consegue conversar.',
  },
  {
    name: 'Esteira (Caminhada Rápida)',
    intensity: 'Moderada',
    pseRange: '4 - 6',
    description: 'Começa a suar, a conversa já fica entrecortada.',
  },
  {
    name: 'Esteira (Caminhada Inclinada)',
    intensity: 'Moderada/Alta',
    pseRange: '6 - 7',
    description: 'Frequência cardíaca sobe bem, pernas queimam mais.',
  },
  {
    name: 'Máquina de Remo (Ritmo Médio)',
    intensity: 'Moderada/Alta',
    pseRange: '6 - 7',
    description: 'Exige corpo inteiro, fôlego fica pesado rapidamente.',
  },
  {
    name: 'Corrida Contínua (Trote)',
    intensity: 'Alta',
    pseRange: '6 - 8',
    description: 'Foco na respiração, impossível manter uma conversa longa.',
  },
  {
    name: 'Simulador de Escada',
    intensity: 'Alta',
    pseRange: '7 - 8',
    description: 'Esforço muscular e cardiovascular intensos contínuos.',
  },
  {
    name: 'Air Bike (Tiros)',
    intensity: 'Máxima',
    pseRange: '9 - 10',
    description: 'Sensação de morte iminente. Respiração ofegante, dor muscular.',
  },
  {
    name: 'Esteira (HIIT/Tiros)',
    intensity: 'Máxima',
    pseRange: '9 - 10',
    description: 'Esforço total por curtos períodos. Não dá para falar nada.',
  },
  // --- Peso Corporal / Outdoor ---
  {
    name: 'Caminhada ao ar livre',
    intensity: 'Baixa',
    pseRange: '2 - 3',
    description: 'Atividade de base.',
  },
  {
    name: 'Ciclismo (Passeio)',
    intensity: 'Baixa/Mod',
    pseRange: '3 - 5',
    description: 'Depende do terreno, mas no plano é bem tranquilo.',
  },
  {
    name: 'Pular Corda (Constante)',
    intensity: 'Alta',
    pseRange: '7 - 8',
    description: 'Coordenação e impacto, eleva o BPM muito rápido.',
  },
  {
    name: 'Burpees / Polichinelos',
    intensity: 'Alta',
    pseRange: '8 - 9',
    description: 'Exige muito oxigênio, esgota rápido em séries longas.',
  },
  {
    name: 'Sprints na Rua',
    intensity: 'Máxima',
    pseRange: '9 - 10',
    description: 'Velocidade máxima, exaustão do sistema nervoso central.',
  },
  // --- Esportes (Dinâmicos) ---
  {
    name: 'Vôlei',
    intensity: 'Variável',
    pseRange: '4 - 7',
    description: 'Esforço intermitente. Explosão e pausas.',
  },
  {
    name: 'Jiu-Jitsu (Rola)',
    intensity: 'Alta',
    pseRange: '7 - 9',
    description: 'Tensão isométrica absurda misturada com cardio.',
  },
  {
    name: 'Futebol',
    intensity: 'Alta',
    pseRange: '7 - 9',
    description: 'Tiros curtos constantes misturados com trote ativo.',
  },
  {
    name: 'Basquete',
    intensity: 'Alta',
    pseRange: '8 - 9',
    description: 'Transições muito rápidas de quadra, picos de BPM.',
  },
  {
    name: 'Boxe / Muay Thai (Saco/Sparring)',
    intensity: 'Máxima',
    pseRange: '8 - 10',
    description: 'Exige ombros, core e fôlego de forma brutal.',
  },
] as const;
