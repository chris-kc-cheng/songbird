import test from 'node:test';
import assert from 'node:assert/strict';
import {parseScore,midi,frequency,demo} from './music.js';
test('pitch conversion matches piano tuning and octaves',()=>{assert.equal(midi('C4'),60);assert.equal(midi('F#4'),66);assert.equal(frequency('A4'),440);assert.equal(frequency('A5'),880);});
test('score import accepts whitespace and commas and rejects malformed or excessive input',()=>{assert.deepEqual(parseScore('C4, D4\nF#4 G4'),['C4','D4','F#4','G4']);for(const value of ['', 'C4', 'C4 <script>', 'C4 C9', Array(129).fill('C4').join(' ')])assert.throws(()=>parseScore(value));});
test('demo contains playable notes',()=>{assert.equal(demo.length,16);demo.forEach(n=>assert.ok(Number.isFinite(frequency(n))));});
