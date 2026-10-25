#!/usr/bin/env node
/**
 * Gera as mídias embutidas do catálogo de exercícios.
 *
 * Lê o CSV do seed do backend (a mesma fonte da migration 011) e, para cada
 * exercício:
 *   - copia a JPG de prévia para assets/exercises/thumbs/<media_key>.jpg;
 *   - converte o GIF em WebP animado (~1/3 do tamanho, mesmos frames e
 *     tempos) em assets/exercises/anim/<media_key>.webp — se o WebP sair
 *     maior, mantém o GIF;
 *   - escreve src/catalog/exerciseMedia.generated.ts, o mapa
 *     media_key -> require(...) que o Metro precisa (require estático).
 *
 * Uso:
 *   npm run media:build -- [pasta-de-origem]
 *
 * A pasta de origem é a que tem images/ e videos/ (o padrão é EXERCICIOS/
 * na raiz do repositório). Arquivos já gerados são pulados; apague
 * assets/exercises/ para regerar tudo.
 */
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const FRONTEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(FRONTEND_DIR, '..', '..');
const CSV_PATH = path.join(
  REPO_ROOT,
  'gymnight',
  'backend',
  'app',
  'database',
  'seed_data',
  'exercise_catalog.csv',
);
const SOURCE_DIR = path.resolve(process.argv[2] ?? path.join(REPO_ROOT, 'EXERCICIOS'));
const THUMBS_DIR = path.join(FRONTEND_DIR, 'assets', 'exercises', 'thumbs');
const ANIM_DIR = path.join(FRONTEND_DIR, 'assets', 'exercises', 'anim');
const GENERATED_PATH = path.join(FRONTEND_DIR, 'src', 'catalog', 'exerciseMedia.generated.ts');

const WEBP_QUALITY = 75;
const CONCURRENCY = 8;

function parseCsv(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  const header = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    if (cells.length !== header.length) {
      throw new Error(`Linha com ${cells.length} colunas (esperado ${header.length}): ${line}`);
    }
    return Object.fromEntries(header.map((key, i) => [key, cells[i].trim()]));
  });
}

async function buildOne(row) {
  const key = row.id;
  const thumbOut = path.join(THUMBS_DIR, `${key}.jpg`);
  if (!existsSync(thumbOut)) {
    await copyFile(path.join(SOURCE_DIR, row.imagem), thumbOut);
  }

  const webpOut = path.join(ANIM_DIR, `${key}.webp`);
  const gifOut = path.join(ANIM_DIR, `${key}.gif`);
  if (existsSync(webpOut)) return { key, anim: `${key}.webp` };
  if (existsSync(gifOut)) return { key, anim: `${key}.gif` };

  const gifSrc = path.join(SOURCE_DIR, row.gif);
  const webp = await sharp(gifSrc, { animated: true })
    .webp({ quality: WEBP_QUALITY, effort: 6, smartSubsample: true })
    .toBuffer();
  const gifSize = (await stat(gifSrc)).size;
  if (webp.length < gifSize) {
    await writeFile(webpOut, webp);
    return { key, anim: `${key}.webp` };
  }
  await copyFile(gifSrc, gifOut);
  return { key, anim: `${key}.gif` };
}

async function dirSize(dir) {
  let total = 0;
  for (const name of await readdir(dir)) total += (await stat(path.join(dir, name))).size;
  return total;
}

function renderGenerated(entries) {
  const lines = entries.map(
    ({ key, anim }) =>
      `  '${key}': {\n` +
      `    thumb: require('../../assets/exercises/thumbs/${key}.jpg'),\n` +
      `    anim: require('../../assets/exercises/anim/${anim}'),\n` +
      `  },`,
  );
  return `/* eslint-disable */
// ARQUIVO GERADO por scripts/build-exercise-media.mjs — não editar à mão.
// Rode \`npm run media:build\` para regerar.
//
// media_key (o \`id\` do CSV do catálogo, coluna exercises.media_key) ->
// assets embutidos no app: \`thumb\` é a JPG de prévia, \`anim\` é a animação.
// O require precisa ser estático para o Metro empacotar o arquivo.

export interface ExerciseMediaSource {
  thumb: number;
  anim: number;
}

export const EXERCISE_MEDIA: Readonly<Record<string, ExerciseMediaSource>> = {
${lines.join('\n')}
};
`;
}

async function main() {
  const rows = parseCsv(await readFile(CSV_PATH, 'utf8'));
  console.log(`CSV: ${rows.length} exercícios. Origem das mídias: ${SOURCE_DIR}`);

  await mkdir(THUMBS_DIR, { recursive: true });
  await mkdir(ANIM_DIR, { recursive: true });
  await mkdir(path.dirname(GENERATED_PATH), { recursive: true });

  const results = new Array(rows.length);
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < rows.length) {
      const index = next++;
      results[index] = await buildOne(rows[index]);
      done++;
      if (done % 50 === 0) console.log(`  ${done}/${rows.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // Remove mídias de exercícios que saíram do CSV.
  const wanted = new Set(results.flatMap(({ key, anim }) => [`${key}.jpg`, anim]));
  for (const dir of [THUMBS_DIR, ANIM_DIR]) {
    for (const name of await readdir(dir)) {
      if (!wanted.has(name)) await rm(path.join(dir, name));
    }
  }

  const sorted = [...results].sort((a, b) => a.key.localeCompare(b.key));
  await writeFile(GENERATED_PATH, renderGenerated(sorted));

  const thumbs = await dirSize(THUMBS_DIR);
  const anims = await dirSize(ANIM_DIR);
  const gifFallbacks = results.filter(({ anim }) => anim.endsWith('.gif')).length;
  const mb = (n) => (n / 1024 / 1024).toFixed(1);
  console.log(`Miniaturas: ${mb(thumbs)} MB | Animações: ${mb(anims)} MB (${gifFallbacks} mantidas em GIF)`);
  console.log(`Total embutido: ${mb(thumbs + anims)} MB`);
  console.log(`Gerado: ${path.relative(FRONTEND_DIR, GENERATED_PATH)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
