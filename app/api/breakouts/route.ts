import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    const alerts = await prisma.breakoutAlert.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return NextResponse.json(alerts);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
