// src/utils/exportUtils.js
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, Table, TableCell, TableRow } from 'docx';
import { saveAs } from 'file-saver';

export const exportToCSV = (data, filename) => {
  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header] === null || row[header] === undefined ? '' : row[header];
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `${filename}.csv`);
};

export const exportToExcel = (data, filename, sheetName = 'Sheet1') => {
  if (!data || data.length === 0) return;

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
  saveAs(blob, `${filename}.xlsx`);
};

export const exportToPDF = (data, filename, title) => {
  if (!data || data.length === 0) return;

  const doc = new jsPDF();
  const headers = Object.keys(data[0]);

  // Sanitize body data to prevent [object Object] or errors
  const body = data.map(row =>
    headers.map(header => {
      const val = row[header];
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    })
  );

  doc.text(title, 14, 15);
  autoTable(doc, {
    head: [headers],
    body: body,
    startY: 20,
    theme: 'grid',
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 58, 138] } // RGB for #1E3A8A
  });
  doc.save(`${filename}.pdf`);
};

export const exportToWord = async (data, filename, title) => {
  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0]);

  const table = new Table({
    rows: [
      new TableRow({
        children: headers.map(header => new TableCell({
          children: [new Paragraph({ text: header, bold: true })]
        }))
      }),
      ...data.map(row => new TableRow({
        children: headers.map(header => new TableCell({
          children: [new Paragraph({ text: String(row[header] || '') })]
        }))
      }))
    ]
  });

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: title, heading: 'Heading1' }),
        new Paragraph({ text: '' }), // Spacer
        table
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${filename}.docx`);
};