export function openFile(url: string, filename?: string) {
  // Open file in new tab for viewing
  // Mobile browsers will use their built-in viewers (PDF viewer, image viewer, etc.)
  // Users can navigate back using browser back button or tab switcher
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  
  // Set download attribute only if filename is explicitly provided for download
  // Otherwise, let browser handle viewing
  if (filename && filename.includes('download')) {
    link.download = filename;
  }
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
