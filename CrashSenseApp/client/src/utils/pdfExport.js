import jsPDF from 'jspdf';

export function exportIncidentPDF(incident) {
  const doc = new jsPDF();
  const primary = [59, 130, 246];

  // Header
  doc.setFillColor(...primary);
  doc.rect(0, 0, 210, 35, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont(undefined, 'bold');
  doc.text('CrashSense', 15, 18);
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text('AI Accident Detection Report', 15, 27);

  // Body
  doc.setTextColor(30, 30, 30);
  let y = 50;

  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text('Incident Report', 15, y); y += 12;

  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');

  const fields = [
    ['Incident ID', incident._id || 'N/A'],
    ['Camera', incident.cameraName || 'Unknown'],
    ['Location', incident.cameraId?.location || 'N/A'],
    ['Timestamp', new Date(incident.timestamp).toLocaleString()],
    ['Confidence', `${incident.confidence}%`],
    ['Severity', incident.severity || 'N/A'],
    ['Status', incident.status || 'N/A'],
    ['Detected Objects', (incident.detectedObjects || []).join(', ')],
    ['Notes', incident.notes || 'None'],
  ];

  fields.forEach(([label, value]) => {
    doc.setFont(undefined, 'bold');
    doc.text(`${label}:`, 15, y);
    doc.setFont(undefined, 'normal');
    doc.text(String(value), 70, y);
    y += 8;
  });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated on ${new Date().toLocaleString()} | CrashSense AI Traffic Monitoring`, 15, 280);

  doc.save(`CrashSense_Incident_${incident._id || 'report'}.pdf`);
}
