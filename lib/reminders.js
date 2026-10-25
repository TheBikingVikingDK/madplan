export const REMINDERS_SHORTCUT_NAME='Madplan til Påmindelser';

// One physical text line per reminder; do not include headings or bullet prefixes.
export function reminderTitles(items){
  const oneLine=value=>String(value??'').replace(/[\r\n\u2028\u2029]+/g,' ').trim();
  return items.map(item=>{
    const name=oneLine(item.name),note=oneLine(item.note);
    return name?name+(note?' – '+note:''):'';
  }).filter(Boolean);
}

// Apple Shortcuts passes this decoded text to the saved shortcut as Shortcut Input.
// https://support.apple.com/guide/shortcuts/apd624386f42/ios
export function remindersShortcutUrl(items){
  const titles=reminderTitles(items);
  if(!titles.length)throw Error('Ingen varer at sende. Vælg retter og tilpas indkøbsbehovet først.');
  return 'shortcuts://run-shortcut?name='+encodeURIComponent(REMINDERS_SHORTCUT_NAME)
    +'&input=text&text='+encodeURIComponent(titles.join('\n'));
}
