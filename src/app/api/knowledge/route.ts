import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { CanonicalBrainService } from '@/lib/services/canonicalBrainService';

export async function GET() {
  try {
    const snapshot = await CanonicalBrainService.getBrainSnapshot();

    const [examples, counterExamples, conflicts] = await Promise.all([
      db.example.findMany({
        include: { concept: true, rule: true },
      }),
      db.counterExample.findMany({
        include: { concept: true, rule: true },
      }),
      db.knowledgeConflict.findMany({
        include: {
          ruleA: true,
          ruleB: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const flatExceptions = snapshot.rules.flatMap(r =>
      (r.exceptions || []).map((e: any) => ({
        ...e,
        rule: { title: r.title, concept: r.concept },
      }))
    );

    return NextResponse.json({
      version: snapshot.version,
      versionTag: snapshot.versionTag,
      lastUpdated: snapshot.lastUpdated,
      itemCounts: snapshot.itemCounts,
      concepts: snapshot.concepts,
      rules: snapshot.rules,
      claims: snapshot.claims,
      stateTransitions: snapshot.stateTransitions,
      learnedLevels: snapshot.learnedLevels,
      relationships: snapshot.relationships,
      exceptions: flatExceptions,
      examples,
      counterExamples,
      conflicts,
      mastery: snapshot.mastery,
    });
  } catch (error) {
    console.error('Failed to fetch canonical knowledge:', error);
    return NextResponse.json({ error: 'Failed to fetch knowledge base' }, { status: 500 });
  }
}
