const fs = require('fs');
const path = require('path');
const dir = 'd:/projects/jasiri/client/src/pages/analytics/charts';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

files.forEach(f => {
  const p = path.join(dir, f);
  let content = fs.readFileSync(p, 'utf8');
  let changed = false;

  // 1. Replace h-96 with h-72
  if (content.includes('className="h-96"')) {
    content = content.replace(/className="h-96"/g, 'className="h-72"');
    changed = true;
  }

  // 2. Replace select block
  const selectRegex = /<select[\s\S]*?<\/select>/;
  if (selectRegex.test(content)) {
    const customSelectCode = `<CustomSelect
                value={item.value}
                onChange={(val) => {
                  if (typeof item.onChange === 'function') {
                    item.onChange({ target: { value: val } });
                  }
                }}
                options={item.options}
                compact
              />`;
    content = content.replace(selectRegex, customSelectCode);
    
    // Add import if not present
    if (!content.includes('CustomSelect')) {
      // Find the last import and add it after
      const importRegex = /import\s+.*?from\s+['"].*?['"];?/g;
      let lastImportMatch;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        lastImportMatch = match;
      }
      
      if (lastImportMatch) {
        const insertIndex = lastImportMatch.index + lastImportMatch[0].length;
        content = content.slice(0, insertIndex) + '\nimport CustomSelect from "../../../components/CustomSelect";' + content.slice(insertIndex);
      } else {
        content = 'import CustomSelect from "../../../components/CustomSelect";\n' + content;
      }
    }
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(p, content, 'utf8');
    console.log('Updated ' + f);
  }
});
