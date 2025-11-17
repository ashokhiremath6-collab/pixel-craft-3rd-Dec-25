import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { format } from 'date-fns';

interface TimestampOptions {
  uploaderName: string;
  documentType: string;
  uploadDate?: Date;
}

export async function addTimestampToPDF(
  pdfBuffer: Buffer,
  options: TimestampOptions
): Promise<Buffer> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const uploadDate = options.uploadDate || new Date();
    const formattedDate = format(uploadDate, 'yyyy-MM-dd HH:mm');
    const timestampText = `${formattedDate} - ${options.documentType} - Uploaded by ${options.uploaderName}`;

    const fontSize = 8;
    const textWidth = font.widthOfTextAtSize(timestampText, fontSize);
    const padding = 10;

    for (const page of pages) {
      const { width, height } = page.getSize();
      
      // Position in bottom-right corner
      const x = width - textWidth - padding;
      const y = padding;

      // Add semi-transparent white background
      page.drawRectangle({
        x: x - 4,
        y: y - 2,
        width: textWidth + 8,
        height: fontSize + 4,
        color: rgb(1, 1, 1),
        opacity: 0.85,
      });

      // Add timestamp text
      page.drawText(timestampText, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  } catch (error) {
    console.error('Error adding timestamp to PDF:', error);
    throw error;
  }
}

export function shouldAddTimestamp(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}
