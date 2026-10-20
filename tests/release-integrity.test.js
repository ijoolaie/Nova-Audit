import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readText = (path) => readFile(new URL(path, root), 'utf8');

test('protected Worker hash matches version metadata and SHA256SUMS', async () => {
  const [worker, metadata, sums] = await Promise.all([
    readFile(new URL('worker.js', root)),
    readText('version.json').then(JSON.parse),
    readText('SHA256SUMS'),
  ]);
  const hash = createHash('sha256').update(worker).digest('hex');
  assert.equal(metadata.protected, true);
  assert.equal(metadata.worker_sha256, hash);
  assert.match(sums, new RegExp('^' + hash + '\\s+worker\\.js$', 'm'));
});

test('protected Worker has release markers and no exposed source map', async () => {
  const worker = await readFile(new URL('worker.js', root));
  const source = worker.toString('utf8');
  assert.ok(worker.byteLength >= 100_000 && worker.byteLength <= 2_900_000);
  for (const marker of [
    'protected release',
    'const Version =',
    'NOVA_BUILD',
    'NOVA_TG_CHANNEL',
    'export default',
  ]) assert.ok(source.includes(marker), 'missing marker: ' + marker);
  assert.ok(!source.includes('sourceMappingURL='));
});

test('package manifest and lockfile root metadata stay synchronized', async () => {
  const manifest = JSON.parse(await readText('package.json'));
  const lock = JSON.parse(await readText('package-lock.json'));
  assert.equal(lock.name, manifest.name);
  assert.equal(lock.version, manifest.version);
  assert.equal(lock.packages[''].version, manifest.version);
  assert.deepEqual(lock.packages[''].devDependencies, manifest.devDependencies);
});

test('Git must not normalize protected Worker line endings', async () => {
  const attributes = await readText('.gitattributes');
  assert.match(attributes, /^worker\.js\s+-text\s*$/m);
});
