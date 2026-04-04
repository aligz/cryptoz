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
    
    // Robust parsing to avoid NaN which causes Prisma errors
    const parsedData = {
      timeframe: data.timeframe || '5m',
      smaPeriod: parseInt(data.smaPeriod) || 20,
      volumeMultiplier: parseFloat(data.volumeMultiplier) || 3.0,
      minVolume: parseFloat(data.minVolume) || 10000.0,
      minGreenCandles: parseInt(data.minGreenCandles) || 0,
      minPriceChange: parseFloat(data.minPriceChange) || 0.0
    };

    const config = await prisma.botConfig.upsert({
      where: { id: 'global' },
      update: parsedData,
      create: {
        id: 'global',
        ...parsedData,
        isActive: false
      }
    });

    // Update memory
    botService.updateConfig({
      timeframe: config.timeframe,
      smaPeriod: config.smaPeriod,
      volumeMultiplier: config.volumeMultiplier,
      minVolume: config.minVolume,
      minGreenCandles: config.minGreenCandles,
      minPriceChange: config.minPriceChange
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
