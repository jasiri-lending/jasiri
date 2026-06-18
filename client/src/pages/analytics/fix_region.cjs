const fs = require('fs');
const path = require('path');
const p = 'd:/projects/jasiri/client/src/pages/analytics/charts/RegionPerformanceChart.jsx';
let content = fs.readFileSync(p, 'utf8');

if (!content.includes('CustomSelect')) {
  content = 'import CustomSelect from "../../../components/CustomSelect";\n' + content;
}

content = content.replace(
  /<div className="bg-white backdrop-blur-lg rounded-3xl shadow-xl border border-white\/40 p-10 transition-all duration-500 hover:shadow-2xl relative hover:z-10">/g,
  '<div className="bg-white backdrop-blur-lg rounded-3xl shadow-xl border border-white/40 p-10 transition-all duration-500 hover:shadow-2xl relative hover:z-10 h-full flex flex-col">'
);

content = content.replace(
  /<div className="h-96" style={{ position: 'relative' }}>/g,
  `<div className="flex-1 w-full min-h-[350px]" style={{ position: 'relative' }}>`
);

const selectRegex = /<select[\s\S]*?<\/select>/;
while (selectRegex.test(content)) {
  content = content.replace(selectRegex, `<CustomSelect fullWidth
                value={item.value}
                onChange={(val) => {
                  if (typeof item.onChange === 'function') {
                    item.onChange({ target: { value: val } });
                  }
                }}
                options={item.options}
                compact
              />`);
}

const wrapperRegex = /className="flex-1 min-w-0 flex items-center h-8 gap-1\.5 px-2 rounded-lg border border-stone-200 bg-transparent hover:border-stone-300 transition focus-within:ring-1 focus-within:ring-stone-400\/20"/g;
content = content.replace(wrapperRegex, 'className="flex-1 min-w-0 flex items-center gap-1.5"');

content = content.replace(
  /wrapperStyle={{\s*fontSize: 12,\s*}}/g,
  'wrapperStyle={{ fontSize: 12, paddingTop: "20px" }}'
);

fs.writeFileSync(p, content, 'utf8');
console.log('Fixed RegionPerformanceChart.jsx successfully.');
