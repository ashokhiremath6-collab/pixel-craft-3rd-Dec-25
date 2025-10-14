import pdfParse from 'pdf-parse';
import fs from 'fs';

const parseCurrency = (amountStr) => {
  return parseFloat(amountStr.replace(/[₹,\$Rs\s]/g, '')) || 0;
};

async function testPDF() {
  const pdfBuffer = fs.readFileSync('attached_assets/Shuco_1760379542344.pdf');
  const pdfData = await pdfParse(pdfBuffer);
  const text = pdfData.text;
  
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  console.log('=== PDF PARSING TEST ===');
  console.log(`Total lines: ${lines.length}\n`);
  
  // Extract ALL numbers
  const allNumbers = [];
  const numberPattern = /(?:₹|Rs\.?|\$|USD|INR)?\s*([0-9,]+(?:\.[0-9]{2})?)/g;
  
  for (const line of lines) {
    const numberMatches = Array.from(line.matchAll(numberPattern));
    
    for (const match of numberMatches) {
      const num = parseCurrency(match[1]);
      if (num > 100) {
        allNumbers.push({ value: num, line: line.substring(0, 80) });
      }
    }
  }
  
  console.log(`Found ${allNumbers.length} numbers > 100`);
  
  // Sort and show top 10 largest
  allNumbers.sort((a, b) => b.value - a.value);
  console.log('\n=== TOP 10 LARGEST NUMBERS ===');
  allNumbers.slice(0, 10).forEach((item, i) => {
    console.log(`${i + 1}. ₹${item.value.toLocaleString('en-IN')} - from: "${item.line}"`);
  });
  
  const biggestValue = allNumbers[0]?.value;
  console.log(`\n=== RESULT ===`);
  console.log(`Biggest value detected: ₹${biggestValue?.toLocaleString('en-IN')}`);
  console.log(`Expected: ₹19,01,676`);
  console.log(`Match: ${biggestValue === 1901675.96 ? 'YES ✓' : 'NO ✗'}`);
}

testPDF().catch(console.error);
