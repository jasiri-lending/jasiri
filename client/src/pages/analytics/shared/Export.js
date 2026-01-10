export const exportToCSV = (data, filename) => {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }

  // Convert data to CSV string
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Handle nested objects
        if (typeof value === 'object' && value !== null) {
          return JSON.stringify(value);
        }
        // Handle special characters
        const escaped = String(value || '').replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(',')
    )
  ];

  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

export const exportToExcel = (data, filename) => {
  // For Excel export, you would typically use a library like xlsx
  // This is a placeholder for Excel export functionality
  console.log('Excel export would require xlsx library');
  exportToCSV(data, filename); // Fallback to CSV
};

export const exportChartAsImage = (chartId, filename) => {
  const chartElement = document.getElementById(chartId);
  if (!chartElement) return;

  // Use html2canvas for image export
  import('html2canvas').then(html2canvas => {
    html2canvas.default(chartElement).then(canvas => {
      const link = document.createElement('a');
      link.download = `${filename}-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  });
};