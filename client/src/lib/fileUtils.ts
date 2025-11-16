export function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function openFile(url: string, filename?: string) {
  if (isMobileDevice()) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'download';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
