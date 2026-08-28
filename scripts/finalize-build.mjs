import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');
const client = join(dist, 'client');
const server = join(dist, 'server');

await mkdir(join(client, 'js'), { recursive: true });
await mkdir(join(client, 'img'), { recursive: true });

for (const file of [
  'motion.min.js',
  'app-motion.js',
  'machine-interface.js',
  'photo-stack.js',
  'radar-snake.js',
]) {
  await copyFile(join(root, 'js', file), join(client, 'js', file));
}

for (const file of ['robots.txt', 'sitemap.xml', 'CNAME']) {
  await copyFile(join(root, file), join(client, file));
}

await copyFile(join(root, 'app.js'), join(client, 'app.js'));
await copyFile(join(root, 'img', 'hor.png'), join(client, 'img', 'hor.png'));
await copyFile(
  join(root, 'img', 'og-nathan-console.jpg'),
  join(client, 'img', 'og-nathan-console.jpg'),
);

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
