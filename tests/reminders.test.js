import test from 'node:test';
import assert from 'node:assert/strict';
import {REMINDERS_SHORTCUT_NAME,reminderTitles,remindersShortcutUrl} from '../lib/reminders.js';
import {shoppingItems} from '../lib/shopping.js';

test('Shortcut input contains exactly one reminder per ingredient, including quantities and Danish characters',()=>{
  const items=[{name:'Ris',note:'ca. 360 g'},{name:'Løg',note:'2 stk + 100 g'},{name:'Æg',note:'Mængde: se opskrift'}];
  const url=new URL(remindersShortcutUrl(items));
  assert.equal(url.protocol,'shortcuts:');assert.equal(url.hostname,'run-shortcut');
  assert.equal(url.searchParams.get('name'),REMINDERS_SHORTCUT_NAME);
  assert.equal(url.searchParams.get('input'),'text');
  assert.deepEqual(url.searchParams.get('text').split('\n'),['Ris – ca. 360 g','Løg – 2 stk + 100 g','Æg – Mængde: se opskrift']);
});
test('Reminders export respects selected recipes, custom groups, pantry, exclusions and hidden ingredients',()=>{
  const state={recipes:[{id:'a',lines:['200 g ris','100 g aubergine','1 tsk salt','1 løg']},{id:'b',lines:['2 dl ris','150 g auberginer']},{id:'c',lines:['500 g ris']}],
    selected:['a','b'],adjustments:{'ris|g':100},excluded:['løg|stk'],hiddenIngredients:['salt'],densities:{},nameAliases:{auberginer:'aubergine'}};
  const titles=reminderTitles(shoppingItems(state));
  assert.deepEqual(titles,['Aubergine – 250 g','Ris – ca. 260 g']);
  state.selected=['a'];assert.deepEqual(reminderTitles(shoppingItems(state)),['Aubergine – 100 g','Ris – 100 g']);
});
test('Text is URL encoded and line breaks cannot create unintended extra reminders',()=>{
  const url=new URL(remindersShortcutUrl([{name:'Salt & peber #1\r\nmed urter',note:'1 tsk\u2028valgfrit + ½ pose'}]));
  assert.equal([...url.searchParams].length,3);
  assert.equal(url.hash,'');assert.equal(url.searchParams.get('text'),'Salt & peber #1 med urter – 1 tsk valgfrit + ½ pose');
  assert.equal(url.searchParams.get('text').split('\n').length,1);
});
test('An empty list never launches a shortcut or creates a blank reminder',()=>{
  assert.deepEqual(reminderTitles([]),[]);
  assert.throws(()=>remindersShortcutUrl([]),/Ingen varer/);
  assert.throws(()=>remindersShortcutUrl([{name:' ',note:'100 g'}]),/Ingen varer/);
});
