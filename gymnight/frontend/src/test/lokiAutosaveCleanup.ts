/**
 * O LokiJS do WatermelonDB liga `autosave` com um setInterval de 500 ms que
 * nunca é desligado — num processo de teste isso mantém o worker do Jest vivo
 * ("A worker process has failed to exit gracefully"). Este helper registra
 * cada instância que liga o autosave para desligá-lo ao fim da suíte.
 * Só serve a testes em memória (o autosave ainda é necessário DURANTE o teste,
 * p.ex. para o `testClone` das migrations).
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const Loki = require('lokijs');

const instances = new Set<{ autosaveDisable: () => void }>();
const originalEnable = Loki.prototype.autosaveEnable;

Loki.prototype.autosaveEnable = function patchedAutosaveEnable(this: { autosaveDisable: () => void }, ...args: unknown[]) {
  instances.add(this);
  return originalEnable.apply(this, args);
};

export function stopAllLokiAutosave(): void {
  for (const loki of instances) loki.autosaveDisable();
  instances.clear();
}
