import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { CanonicalBrainService } from '@/lib/services/canonicalBrainService';

export async function GET() {
  try {
    const [dbScenarios, snapshot] = await Promise.all([
      db.scenario.findMany({
        include: {
          conditions: {
            orderBy: { stepOrder: 'asc' },
          },
          setup: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      CanonicalBrainService.getBrainSnapshot(),
    ]);

    // Map any state transition sequences as scenarios if not already present
    const scenarioNames = new Set(dbScenarios.map(s => s.name.toLowerCase()));
    const dynamicScenarios = [...dbScenarios];

    for (const seq of snapshot.stateTransitions || []) {
      if (!scenarioNames.has(seq.name.toLowerCase())) {
        dynamicScenarios.push({
          id: seq.id,
          setupId: null,
          setup: null,
          name: seq.name,
          marketContext: seq.description,
          expectedAction: 'WATCH / SETUP_FORMING',
          invalidationCondition: 'Price penetrates structural boundary without expected reaction.',
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
          conditions: (seq.states || []).map((st, idx) => ({
            id: `st_${seq.id}_${idx}`,
            scenarioId: seq.id,
            stepOrder: st.step || idx + 1,
            description: `${st.stateName}: ${st.description}`,
            logicOp: idx === 0 ? 'IF' : 'THEN',
            isMet: st.observed,
          })),
        } as any);
      }
    }

    return NextResponse.json({
      scenarios: dynamicScenarios,
      versionTag: snapshot.versionTag,
      lastUpdated: snapshot.lastUpdated,
    });
  } catch (error) {
    console.error('Failed to fetch scenarios:', error);
    return NextResponse.json({ error: 'Failed to fetch scenarios' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, marketContext, expectedAction, invalidationCondition, conditions } = body;

    if (!name || !expectedAction) {
      return NextResponse.json({ error: 'Name and expected action are required' }, { status: 400 });
    }

    const scenario = await db.scenario.create({
      data: {
        name,
        marketContext: marketContext || '',
        expectedAction,
        invalidationCondition: invalidationCondition || 'Price breaks invalidation boundary',
        conditions: {
          create: (conditions || []).map((c: any, idx: number) => ({
            stepOrder: idx + 1,
            description: c.description,
            logicOp: c.logicOp || 'AND',
          })),
        },
      },
      include: {
        conditions: true,
      },
    });

    CanonicalBrainService.invalidateCache();

    return NextResponse.json({ success: true, scenario });
  } catch (error) {
    console.error('Failed to create scenario:', error);
    return NextResponse.json({ error: 'Failed to create scenario' }, { status: 500 });
  }
}
