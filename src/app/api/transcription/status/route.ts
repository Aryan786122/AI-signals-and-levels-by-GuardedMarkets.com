import { NextResponse } from 'next/server';
import { localWhisperProvider } from '@/lib/providers/speech';

export async function GET() {
  try {
    const status = await localWhisperProvider.checkStatus();
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      {
        installed: false,
        cuda_available: false,
        device: 'cpu',
        compute_type: 'int8',
        model_cached: false,
        model: process.env.WHISPER_MODEL || 'small',
        stage: 'MODEL_NOT_INSTALLED',
        error: error instanceof Error ? error.message : 'Failed to check status',
      },
      { status: 500 }
    );
  }
}
