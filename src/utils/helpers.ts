import { createHash } from 'crypto';

export function generateHash(content: string, algorithm: string = 'sha256'): string {
  return createHash(algorithm)
    .update(content)
    .digest('hex');
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    secs.toString().padStart(2, '0')
  ].join(':');
}

export function urlToFilename(url: string): string {
  let filename = url.replace(/^https?:\/\/sdk\.vercel\.ai\/?/, '');
  filename = filename.replace(/[\/?<>\\:*|"]/g, '-');
  filename = filename.replace(/-+/g, '-');
  filename = filename.replace(/^-|-$/g, '');

  if (filename.length > 100) {
    const hash = createHash('md5').update(url).digest('hex').substring(0, 8);
    filename = filename.substring(0, 92) + '-' + hash;
  }

  if (!filename || filename === '-') {
    filename = 'index';
  }

  return filename + '.json';
}