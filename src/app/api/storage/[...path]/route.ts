import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';

export async function GET(
  _request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const parts = params.path;
  if (parts.length < 2) {
    return new NextResponse('Invalid storage path', { status: 400 });
  }

  const category = parts[0] as 'videos' | 'audio' | 'frames' | 'screenshots';
  const fileName = parts.slice(1).join('/');

  const fileBuffer = await storage.get(category, fileName);
  if (!fileBuffer) {
    return new NextResponse('File not found', { status: 404 });
  }

  // Determine mime type
  let mimeType = 'application/octet-stream';
  if (fileName.endsWith('.mp4')) mimeType = 'video/mp4';
  else if (fileName.endsWith('.webm')) mimeType = 'video/webm';
  else if (fileName.endsWith('.mov')) mimeType = 'video/quicktime';
  else if (fileName.endsWith('.png')) mimeType = 'image/png';
  else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) mimeType = 'image/jpeg';
  else if (fileName.endsWith('.wav')) mimeType = 'audio/wav';
  else if (fileName.endsWith('.mp3')) mimeType = 'audio/mpeg';

  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      'Content-Type': mimeType,
      'Content-Length': fileBuffer.length.toString(),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
