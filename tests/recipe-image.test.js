import test from 'node:test';
import assert from 'node:assert/strict';
import {recipeImage} from '../lib/recipe-image.js';
test('Recipe images accept strings, arrays and ImageObjects, including relative URLs',()=>{
  const base='https://sundpaabudget.dk/ris/';
  assert.equal(recipeImage(['/wp-content/ris.jpg'],base),'https://sundpaabudget.dk/wp-content/ris.jpg');
  assert.equal(recipeImage({'@type':'ImageObject',url:base+'photo.jpg'},base),base+'photo.jpg');
  assert.equal(recipeImage({contentUrl:base+'photo.jpg'},base),base+'photo.jpg');
  for(const image of [null,{},'javascript:alert(1)','http://sundpaabudget.dk/x.jpg','https://other.example/x.jpg'])assert.equal(recipeImage(image,base),null);
});
