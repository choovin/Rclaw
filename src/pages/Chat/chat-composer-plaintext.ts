export function normalizeComposerPlainText(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function getPlainTextFromRoot(el: HTMLElement): string {
  return normalizeComposerPlainText(el.innerText);
}
