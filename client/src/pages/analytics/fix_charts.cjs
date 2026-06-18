const fs = require('fs');
const path = require('path');
const dir = 'd:/projects/jasiri/client/src/pages/analytics/charts';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

files.forEach(f => {
  const p = path.join(dir, f);
  let content = fs.readFileSync(p, 'utf8');
  let changed = false;

  // Revert h-72 back to h-96
  if (content.includes('className="h-72"')) {
    content = content.replace(/className="h-72"/g, 'className="h-96"');
    changed = true;
  }

  // Remove the wrapper border for CustomSelect to look clean
  // Pattern: className="flex-1 min-w-0 flex items-center h-8 gap-1.5 px-2 rounded-lg border border-slate-200 bg-transparent hover:border-slate-300 transition focus-within:ring-1 focus-within:ring-slate-400/20"
  // Or similar (stone-200, slate-200)
  const wrapperRegex = /className="flex-1 min-w-0 flex items-center h-8 gap-1\.5 px-2 rounded-lg border border-[a-z]+-200 bg-transparent hover:border-[a-z]+-300 transition focus-within:ring-1 focus-within:ring-[a-z]+-400\/20"/g;
  if (wrapperRegex.test(content)) {
    content = content.replace(wrapperRegex, 'className="flex-1 min-w-0 flex items-center gap-1.5"');
    changed = true;
  }
  
  // CustomSelect needs fullWidth so it stretches inside the new flex wrapper
  if (content.includes('<CustomSelect') && !content.includes('fullWidth')) {
    content = content.replace(/<CustomSelect/g, '<CustomSelect fullWidth');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(p, content, 'utf8');
    console.log('Fixed ' + f);
  }
});
