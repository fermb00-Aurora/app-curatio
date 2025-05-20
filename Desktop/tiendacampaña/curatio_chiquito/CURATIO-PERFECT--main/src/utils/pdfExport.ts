
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export const exportToPdf = async (elementId: string, fileName: string = 'export.pdf') => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with ID "${elementId}" not found`);
    return;
  }

  try {
    // Create a canvas from the HTML element with optimal settings for layout preservation
    const canvas = await html2canvas(element, {
      scale: 2.0, // Higher scale for better quality
      useCORS: true,
      logging: false,
      width: element.offsetWidth,
      height: element.offsetHeight,
      imageTimeout: 0,
      allowTaint: true,
      backgroundColor: "#ffffff", // Set white background
    });
    
    const imgData = canvas.toDataURL('image/png', 1.0);
    
    // Calculate dimensions with proper width-to-height ratio
    const pdfWidth = 210; // A4 width (210mm)
    const pdfHeight = 297; // A4 height (297mm)
    
    // Set orientation based on content proportions
    const pdf = new jsPDF({
      orientation: 'p', // Always use portrait for consistency
      unit: 'mm',
      format: 'a4',
      compress: true
    });
    
    // Add title at the top
    const title = fileName.replace('.pdf', '');
    pdf.setFontSize(14);
    pdf.text(title, 10, 10);
    
    // Calculate the aspect ratio of the original element
    const aspectRatio = canvas.width / canvas.height;
    
    // Calculate new width and height to fit the page while maintaining aspect ratio
    const maxWidth = pdfWidth - 20; // 10mm margins on each side
    const maxHeight = pdfHeight - 20; // 10mm margins on top and bottom
    
    let contentWidth, contentHeight;
    
    if (canvas.width / maxWidth > canvas.height / maxHeight) {
      // If width is the limiting dimension
      contentWidth = maxWidth;
      contentHeight = contentWidth / aspectRatio;
    } else {
      // If height is the limiting dimension
      contentHeight = maxHeight;
      contentWidth = contentHeight * aspectRatio;
    }
    
    // Add the image, centered horizontally
    const xPos = (pdfWidth - contentWidth) / 2;
    
    // Position the image below the title
    const yPos = 15; // Below the title
    
    pdf.addImage(imgData, 'PNG', xPos, yPos, contentWidth, contentHeight);
    
    // Save PDF
    pdf.save(fileName);
    console.log(`PDF "${fileName}" exported successfully with layout preserved`);
  } catch (error) {
    console.error('Error generating PDF:', error);
  }
};
