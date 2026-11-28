import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = path.join(root, 'site');
const pages = [
  ['/', 'index.html'],
  ['/support/', 'support/index.html'],
  ['/confidentialite/', 'confidentialite/index.html'],
  ['/conditions/', 'conditions/index.html'],
  ['/sources/', 'sources/index.html'],
];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('publie toutes les pages requises par la fiche App Store', () => {
  for (const [route, relativePath] of pages) {
    const html = read(`site/${relativePath}`);
    assert.match(html, /<html lang="fr">/);
    assert.match(html, /<meta name="viewport"/);
    assert.match(html, /<title>[^<]+<\/title>/);
    assert.match(html, new RegExp(`https://youplala\\.github\\.io/Paris-GO${route.replaceAll('/', '\\/')}`));
  }
});

test('résout chaque lien interne vers un fichier du site', () => {
  for (const [, relativePath] of pages) {
    const html = read(`site/${relativePath}`);
    const links = [...html.matchAll(/(?:href|src)="([^"#?]+)"/g)]
      .map((match) => match[1])
      .filter((link) => !/^(?:https?:|mailto:|tel:)/.test(link));
    const pageDirectory = path.dirname(path.join(site, relativePath));
    for (const link of links) {
      const candidate = link.startsWith('/Paris-GO/')
        ? path.join(site, decodeURIComponent(link.slice('/Paris-GO/'.length)))
        : path.resolve(pageDirectory, decodeURIComponent(link));
      const resolved = link.endsWith('/') ? path.join(candidate, 'index.html') : candidate;
      assert.ok(fs.existsSync(resolved), `${relativePath}: ${link} ne résout pas vers ${resolved}`);
    }
  }
});

test('la confidentialité décrit le traitement local et le dépôt tiers manuel', () => {
  const privacy = read('site/confidentialite/index.html');
  assert.match(privacy, /sans compte/);
  assert.match(privacy, /photothèque en ajout uniquement/);
  assert.match(privacy, /Le commentaire public reste vide/);
  assert.match(privacy, /Aucun dépôt n’est automatique/);
  assert.match(privacy, /transmises directement à l’Observatoire/);
  assert.match(privacy, /OpenStreetMap/);
  assert.match(privacy, /Automattic/);
  assert.match(privacy, /mailto:eliebrosset@gmail\.com/);
});

test('propose un canal d’assistance privé', () => {
  const support = read('site/support/index.html');
  assert.match(support, /mailto:eliebrosset@gmail\.com/);
  assert.match(support, /Assistance privée/);
});

test('les métadonnées Apple pointent vers les pages GitHub Pages', () => {
  const config = JSON.parse(read('store.config.json'));
  const info = config.apple.info['fr-FR'];
  assert.equal(info.marketingUrl, 'https://youplala.github.io/Paris-GO/');
  assert.equal(info.supportUrl, 'https://youplala.github.io/Paris-GO/support/');
  assert.equal(info.privacyPolicyUrl, 'https://youplala.github.io/Paris-GO/confidentialite/');
});

test('les liens publics de l’app et de la documentation utilisent le préfixe déployé', () => {
  for (const file of ['src/screens/about/index.tsx', 'docs/PUBLICATION.md', 'README.md']) {
    assert.doesNotMatch(read(file), /youplala\.github\.io\/reprise(?:\/|$)/, file);
    assert.match(read(file), /https:\/\/youplala\.github\.io\/Paris-GO\//, file);
  }
  assert.match(read('src/constants/legal.ts'), /https:\/\/youplala\.github\.io\/Paris-GO\/confidentialite\//);
  for (const [, relativePath] of pages) {
    const html = read(`site/${relativePath}`);
    const route = relativePath.replace(/index\.html$/, '');
    assert.ok(html.includes(`<link rel="canonical" href="https://youplala.github.io/Paris-GO/${route}">`));
    assert.doesNotMatch(html, /youplala\.github\.io\/reprise/);
  }
});

test('la date de clôture publiée est le 31 mai 2027', () => {
  for (const file of ['site/index.html', 'site/sources/index.html', 'README.md']) {
    const text = read(file).replaceAll('&nbsp;', ' ');
    assert.match(text, /31 mai\s+2027/, file);
    assert.doesNotMatch(text, /30 novembre\s+2026/, file);
  }
});

test('le workflow publie uniquement le répertoire statique site', () => {
  const workflow = read('.github/workflows/pages.yml');
  assert.match(workflow, /pages: write/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /path: site/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
});
