import test from 'node:test';
import assert from 'node:assert/strict';
import * as cheerio from 'cheerio';
import {durationMinutes,totalRecipeMinutes,recipeTimeLabel} from '../lib/recipe-time.js';
import {extractRecipeMinutes} from '../lib/recipe-time-source.js';
test('Recipe duration handles hours, minutes, ISO, decimals and ranges',()=>{
  for(const [value,expected] of [['PT1H20M',80],['PT45M',45],['P1DT2H',1560],['1 time 15 minutter',75],['30–40 min',40],['1,5 timer',90],['PT30S',1],['',null],['PT0M',null]])assert.equal(durationMinutes(value),expected,value);
  assert.equal(recipeTimeLabel(80),'Samlet tid: ca. 1 t 20 min');
});
test('Explicit total wins; missing structured times fall back to the recipe card',()=>{
  const $=cheerio.load('<div class="wprm-recipe-container"><div class="wprm-recipe-prep_time-container">Forb. tid 10 min</div><div class="wprm-recipe-cook_time-container">Tilb. tid 20 min</div></div>');
  assert.equal(extractRecipeMinutes({totalTime:'PT45M',prepTime:'PT10M',cookTime:'PT20M'},$),45);
  assert.equal(extractRecipeMinutes({},$),30);
  assert.equal(extractRecipeMinutes({prepTime:'PT10M',cookTime:'PT0M'},cheerio.load('')),10);
  assert.equal(extractRecipeMinutes({},cheerio.load('<div class="wprm-recipe"><div>Samlet tid 1 time 15 min</div></div>')),75);
  assert.equal(extractRecipeMinutes({},cheerio.load('<div class="wprm-recipe">Steg i 5 min</div><p>Kommentar: samlet tid 99 min</p>')),null);
});
test('Composite dishes show a total only when every component time is known',()=>{
  assert.equal(totalRecipeMinutes([{totalMinutes:30},{totalMinutes:15}]),45);
  assert.equal(totalRecipeMinutes([{totalMinutes:30},{}]),null);
  assert.equal(totalRecipeMinutes([]),null);
});
