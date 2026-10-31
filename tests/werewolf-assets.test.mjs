import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { roles } from '../src/werewolf-engine.ts';

test('every implemented role has its own artwork and is cached for offline play', () => {
  const worker=readFileSync('public/sw.js','utf8');
  for(const [id,role] of Object.entries(roles)) {
    const path=`werewolf/${id}.webp`;
    assert.ok(statSync(`public/${path}`).size>0,`${role.name}: missing artwork`);
    assert.ok(worker.includes(`"${path}"`),`${role.name}: missing offline cache entry`);
  }
});

test('optional phase sounds are present and available offline',()=>{
  const worker=readFileSync('public/sw.js','utf8');
  for(const phase of ['night','day','vote']) {
    const path=`werewolf/audio/${phase}.mp3`;
    assert.ok(statSync(`public/${path}`).size>0);
    assert.ok(worker.includes(`"${path}"`));
  }
});

test('all Celebrity skin artwork is included for offline play',()=>{
 const worker=readFileSync('public/sw.js','utf8');
 for(const name of ['celebrity-new.webp','celebrity-spotlight.webp','celebrity-gala.webp']){
  assert.ok(existsSync(`public/werewolf/${name}`));assert.ok(worker.includes(`"werewolf/${name}"`));
 }
});

test('all Charmer skin artwork is included for offline play',()=>{
 const worker=readFileSync('public/sw.js','utf8');
 for(const name of ['charmer-new.webp','charmer-moonlight.webp','charmer-starlight.webp','charmer-sapphire.webp']){
  assert.ok(existsSync(`public/werewolf/${name}`));assert.ok(worker.includes(`"werewolf/${name}"`));
 }
});
