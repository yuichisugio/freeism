/**
 * ファイルを、一時的なリンクからブラウザーに保存させる。
 * @see ./hooks/use-backup-export.test.tsx
 */
export function downloadFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
