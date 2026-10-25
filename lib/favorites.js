export function favoriteKey(recipe){
  const urls=recipe.urls?.length?recipe.urls:recipe.url?[recipe.url]:[];
  return urls.length?JSON.stringify([urls,recipe.extraLines||[]]):'local:'+recipe.id;
}
export function toggleFavorite(favorites,recipe){
  const key=favoriteKey(recipe);
  return favorites.some(r=>favoriteKey(r)===key)?favorites.filter(r=>favoriteKey(r)!==key):[...favorites,recipe];
}
