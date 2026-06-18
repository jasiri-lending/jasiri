const fs = require('fs');
const path = require('path');

const filesToFix = [
  'd:/projects/jasiri/client/src/pages/analytics/charts/BranchPerformanceChart.jsx',
  'd:/projects/jasiri/client/src/pages/analytics/charts/ProductOverviewChart.jsx'
];

filesToFix.forEach(p => {
  let content = fs.readFileSync(p, 'utf8');
  let changed = false;

  // 1. Replace the outer div to flex column
  const oldContainer = /<div className="bg-white(\/70)? backdrop-blur-(lg|md) rounded-(3xl|2xl) shadow-xl border border-white\/40 p-(10|8) transition-all duration-(500|300) hover:shadow-2xl relative hover:z-10">/g;
  if (oldContainer.test(content)) {
    content = content.replace(oldContainer, (match) => {
      return match.replace('relative hover:z-10">', 'relative hover:z-10 h-full flex flex-col">');
    });
    changed = true;
  }

  // 2. Replace the graph container to flex-1
  const oldGraphContainer1 = /<div className="h-96" style={{ position: 'relative' }}>/g;
  if (oldGraphContainer1.test(content)) {
    content = content.replace(oldGraphContainer1, '<div className="flex-1 w-full min-h-[350px]" style={{ position: \'relative\' }}>');
    changed = true;
  }
  
  const oldGraphContainer2 = /<div className="h-96">/g;
  if (oldGraphContainer2.test(content)) {
    content = content.replace(oldGraphContainer2, '<div className="flex-1 w-full min-h-[350px]" style={{ position: \'relative\' }}>');
    changed = true;
  }

  const oldGraphContainer3 = /<div className="h-72">/g; // Just in case
  if (oldGraphContainer3.test(content)) {
    content = content.replace(oldGraphContainer3, '<div className="flex-1 w-full min-h-[350px]" style={{ position: \'relative\' }}>');
    changed = true;
  }

  // 3. Legend padding
  const oldLegend = /wrapperStyle={{\s*fontSize: 12,\s*}}/g;
  if (oldLegend.test(content)) {
    content = content.replace(oldLegend, 'wrapperStyle={{ fontSize: 12, paddingTop: "20px" }}');
    changed = true;
  }
  
  // ProductOverviewChart has specific legend style wrapper without comma sometimes, let's target fontSize: 12
  const oldLegend2 = /wrapperStyle={{\s*fontSize: 12\s*}}/g;
  if (oldLegend2.test(content)) {
    content = content.replace(oldLegend2, 'wrapperStyle={{ fontSize: 12, paddingTop: "20px" }}');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(p, content, 'utf8');
    console.log(`Successfully updated ${path.basename(p)}`);
  } else {
    console.log(`No matching patterns found to update in ${path.basename(p)}`);
  }
});
