const fs = require('fs');
const path = require('path');
const dir = 'd:/projects/jasiri/client/src/pages/analytics/charts';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

files.forEach(f => {
  const p = path.join(dir, f);
  let content = fs.readFileSync(p, 'utf8');
  
  if (!content.includes('import CustomSelect')) {
    content = 'import CustomSelect from "../../../components/CustomSelect";\n' + content;
    fs.writeFileSync(p, content, 'utf8');
    console.log('Added import to ' + f);
  }
});
