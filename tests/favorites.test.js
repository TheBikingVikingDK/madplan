import test from 'node:test';
import assert from 'node:assert/strict';
import {favoriteKey,toggleFavorite} from '../lib/favorites.js';
test('Favorites match saved and weekly recipes, retain source data and can be removed',()=>{
 const weekly={title:'Ret',urls:['https://sundpaabudget.dk/ret/'],extraLines:[]};
 const saved={...weekly,id:'a',lines:['200 g ris']};
 assert.equal(favoriteKey(weekly),favoriteKey(saved));
 const favorites=JSON.parse(JSON.stringify(toggleFavorite([],saved)));
 assert.deepEqual(favorites[0].lines,['200 g ris']);
 assert.deepEqual(toggleFavorite(favorites,weekly),[]);
 assert.notEqual(favoriteKey({...saved,extraLines:['1 løg']}),favoriteKey(saved));
 assert.notEqual(favoriteKey({id:'a'}),favoriteKey({id:'b'}));
});
