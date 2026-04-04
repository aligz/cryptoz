import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { botService } from '@/lib/service/botService';

export async function GET() {
  let config = await prisma.botConfig.findUnique({ where: { id: 'global' } });
  if (!config) {
    config = await prisma.botConfig.create({
      data: { id: 'global' }
    });
  }
  return NextResponse.json(config);
}

export async function PUT(req: Request) {
  try {
    const data = await req.json();
    
    const config = await prisma.botConfig.update({
      where: { id: 'global' },
      data: {
        timeframe: data.timeframe,
        smaPeriod: parseInt(data.smaPeriod),
        volumeMultiplier: parseFloat(data.volumeMultiplier),
        minVolume: parseFloat(data.minVolume),
        minGreenCandles: parseInt(data.minGreenCandles || 0)
      }
    });

    // Update memory
    botService.updateConfig({
      timeframe: config.timeframe,
      smaPeriod: config.smaPeriod,
      volumeMultiplier: config.volumeMultiplier,
      minVolume: config.minVolume,
      minGreenCandles: config.minGreenCandles
    });

    // If bot is running, force it to restart to apply new config
    if (botService.getStatus() === 'RUNNING') {
      await botService.stop();
      setTimeout(() => botService.start(), 1000);
    }

    return NextResponse.json(config);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
