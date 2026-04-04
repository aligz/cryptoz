import { NextResponse } from 'next/server';
import { botService } from '@/lib/service/botService';

export async function GET() {
  return NextResponse.json({
    status: botService.getStatus(),
    config: botService.getConfig(),
    monitoredCount: botService.getMonitoredCount()
  });
}

export async function POST(req: Request) {
  try {
    const { action } = await req.json();

    if (action === 'start') {
      await botService.start();
      return NextResponse.json({ success: true, status: botService.getStatus() });
    } else if (action === 'stop') {
      await botService.stop();
      return NextResponse.json({ success: true, status: botService.getStatus() });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
