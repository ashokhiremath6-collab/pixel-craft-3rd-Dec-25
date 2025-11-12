import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { ObjectStorageService } from '../objectStorage';

interface WorksOrderMergeData {
  worksOrderName: string;
  categoryName: string;
  vendorName: string;
  vendorContact?: string;
  vendorPhone?: string;
  projectName?: string;
  items: Array<{
    description: string;
    quantity: number;
    unit: string;
    unitRate: number;
    amount: number;
  }>;
  totalAmount: number;
  date: string;
}

export class WorksOrderDocService {
  private objectStorageService: ObjectStorageService;

  constructor() {
    this.objectStorageService = new ObjectStorageService();
  }

  /**
   * Merge quote data into a DOCX template
   * @param templatePath - Path to template in object storage
   * @param mergeData - Data to merge into template
   * @returns Buffer containing merged DOCX
   */
  async mergeTemplate(templatePath: string, mergeData: WorksOrderMergeData): Promise<Buffer> {
    try {
      // Download template from object storage
      const templateFile = await this.objectStorageService.getObjectEntityFile(templatePath);
      const templateBuffer = await this.downloadAsBuffer(templateFile);

      // Load template with PizZip
      const zip = new PizZip(templateBuffer);
      
      // Create docxtemplater instance
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => '',
      });

      // Set merge data
      doc.render(mergeData);

      // Generate merged document
      const buffer = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      });

      return buffer;
    } catch (error) {
      console.error('Error merging DOCX template:', error);
      throw new Error(`Failed to merge template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse an uploaded DOCX to extract item data
   * @param docxBuffer - Buffer containing DOCX file
   * @returns Extracted text content (for future parsing)
   */
  async parseUploadedDoc(docxBuffer: Buffer): Promise<string> {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer: docxBuffer });
      return result.value;
    } catch (error) {
      console.error('Error parsing DOCX:', error);
      throw new Error(`Failed to parse DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Download object storage file as Buffer
   */
  private async downloadAsBuffer(objectFile: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      
      objectFile.createReadStream()
        .on('data', (chunk: Buffer) => chunks.push(chunk))
        .on('end', () => resolve(Buffer.concat(chunks)))
        .on('error', reject);
    });
  }
}

export const worksOrderDocService = new WorksOrderDocService();
