function isPdfUrl(url: string): boolean {
  return /\.pdf($|\?|#)/i.test(url) || url.includes('/pdf') || url.includes('pdf');
}

export async function openPdf(url: string): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch PDF');
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const tab = window.open(blobUrl, '_blank', 'noopener,noreferrer');
    if (tab) {
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
    }
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export function openFile(url: string, filename?: string) {
  if (isPdfUrl(url)) {
    openPdf(url);
    return;
  }
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  if (filename && filename.includes('download')) {
    link.download = filename;
  }
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function openFileUrl(url: string): void {
  if (isPdfUrl(url)) {
    openPdf(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
