declare module 'jschardet' {
  export function detect(buffer: Buffer | string): { encoding: string; confidence: number };
}
