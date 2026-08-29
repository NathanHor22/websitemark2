import { copyFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');
const client = join(dist, 'client');
const server = join(dist, 'server');

await mkdir(join(client, 'img'), { recursive: true });

for (const file of ['robots.txt', 'sitemap.xml', 'CNAME']) {
  await copyFile(join(root, file), join(client, file));
}

// Runtime-selected media use stable /img paths. Copy the optimized web archive,
// not the much larger source exports stored beside it.
await cp(join(root, 'img', 'web'), join(client, 'img', 'web'), { recursive: true });

for (const file of [
  'logo.png',
  'hor.png',
  'aws.jpeg',
  'carousel.jpeg',
  'purrmit.png',
  'Persephone.mp4',
  'Tenun.png',
  'employable.png',
  'Presence postcard.jpg',
  'og-nathan-console.png',
]) {
  await copyFile(join(root, 'img', file), join(client, 'img', file));
}

await copyFile(join(server, 'index.mjs'), join(server, 'index.js'));

const serverConfigPath = join(server, 'wrangler.json');
const serverConfig = JSON.parse(await readFile(serverConfigPath, 'utf8'));
serverConfig.main = 'index.js';
await writeFile(serverConfigPath, `${JSON.stringify(serverConfig)}\n`);

const rootConfigPath = join(dist, 'wrangler.json');
const rootConfig = JSON.parse(await readFile(rootConfigPath, 'utf8'));
rootConfig.main = 'server/index.js';
rootConfig.rules = [
  { type: 'ESModule', globs: ['server/**/*.js', 'server/**/*.mjs'] },
];
rootConfig.assets = {
  binding: 'ASSETS',
  not_found_handling: '404-page',
  directory: 'client',
};
await writeFile(rootConfigPath, `${JSON.stringify(rootConfig)}\n`);
