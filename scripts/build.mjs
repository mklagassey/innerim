// Bundles the game into one self-contained page.
//   dist/index.html    open this in a browser
//   dist/artifact.html the same page without the document wrapper, for publishing
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';

const out = await build({ entryPoints: ['src/main.ts'], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false });
const js = out.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const page = readFileSync('src/page.html', 'utf8').replace('/*__GAME__*/', () => js);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/artifact.html', page);
const full = `<!doctype html>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<style>body{margin:0}[hidden]{display:none!important}</style>\n${page}`;
writeFileSync('dist/index.html', full);
console.log(`built dist/index.html (${(full.length / 1024).toFixed(1)} KB)`);

if (process.argv.includes('--serve')) {
  createServer((_, res) => res.setHeader('content-type', 'text/html').end(readFileSync('dist/index.html'))).listen(5173);
  console.log('playing at http://localhost:5173');
}
