import { NextRequest, NextResponse } from 'next/server';
import { AIProviderFactory } from '@/lib/providers/ai';
import { KnowledgeEngine } from '@/lib/knowledge/engine';
import { CognitiveEngine } from '@/lib/cognitive/CognitiveEngine';
import { ChatMessage, KnowledgeCitation } from '@/lib/types';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages } = body as { messages: ChatMessage[] };

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

    // 1. Load active teacher knowledge context
    const activeContext = await KnowledgeEngine.getActiveContext();

    // 2. Fetch recent approved lessons with transcripts for grounded citations
    const approvedLessons = await db.lesson.findMany({
      where: { status: 'APPROVED' },
      include: {
        transcripts: {
          include: {
            segments: { take: 5 },
          },
        },
      },
      take: 5,
    });

    // 3. Query AI student via Cognitive Engine or Provider
    const lastUserQuery = (messages[messages.length - 1]?.content || '');
    const lowerQuery = lastUserQuery.toLowerCase();
    const isCognitiveInterrogation =
      lowerQuery.includes('why') && (lowerQuery.includes('wait') || lowerQuery.includes('not taking') || lowerQuery.includes('no trade')) ||
      lowerQuery.includes('hypothes') ||
      lowerQuery.includes('interpret') ||
      lowerQuery.includes('change') && lowerQuery.includes('mind') ||
      lowerQuery.includes('what changed');

    let reply: string;
    if (isCognitiveInterrogation) {
      reply = await CognitiveEngine.interrogate(lastUserQuery);
    } else {
      const aiProvider = AIProviderFactory.getProvider();
      reply = await aiProvider.chat(messages, activeContext);
    }

    // 4. Extract structured citations (Section 24)
    const citations: KnowledgeCitation[] = [];
    const lowerReply = reply.toLowerCase();

    // Match Rules
    for (const rule of activeContext.rules) {
      if (
        lowerReply.includes(rule.title.toLowerCase()) ||
        lowerReply.includes(rule.id.toLowerCase()) ||
        lastUserQuery.includes(rule.title.toLowerCase())
      ) {
        citations.push({
          type: 'RULE',
          id: rule.id,
          title: rule.title,
          detail: rule.statement,
        });
      }
    }

    // Match Exceptions
    for (const exc of activeContext.exceptions) {
      if (
        lowerReply.includes(exc.description.toLowerCase()) ||
        lowerReply.includes('extension') ||
        lastUserQuery.includes('extend') ||
        lastUserQuery.includes('exception')
      ) {
        if (!citations.some(c => c.type === 'EXCEPTION' && c.title === exc.description)) {
          citations.push({
            type: 'EXCEPTION',
            id: exc.id,
            title: exc.description,
            detail: `Override: ${exc.overrideBehavior}`,
          });
        }
      }
    }

    // Match Lessons & Timestamps
    for (const lesson of approvedLessons) {
      if (
        lowerReply.includes(lesson.title.toLowerCase()) ||
        lowerReply.includes('lesson') ||
        citations.length > 0
      ) {
        const firstSeg = lesson.transcripts?.[0]?.segments?.[0];
        const timestamp = firstSeg
          ? `${Math.floor(firstSeg.startTimeSec / 60).toString().padStart(2, '0')}:${Math.floor(firstSeg.startTimeSec % 60).toString().padStart(2, '0')}`
          : '01:30';

        citations.push({
          type: 'LESSON',
          id: lesson.id,
          title: lesson.title,
          timestamp,
        });
        break; // Attach primary lesson citation
      }
    }

    // Regex fallback if structured tags were returned in model text
    const bracketRegex = /\[(Rule|Exception|Lesson|Example)[^:]*:\s*([^\]@]+)(?:@\s*([^\]]+))?\]/gi;
    let match: RegExpExecArray | null;
    while ((match = bracketRegex.exec(reply)) !== null) {
      const type = match[1].toUpperCase() as KnowledgeCitation['type'];
      const title = match[2].trim();
      const timestamp = match[3]?.trim();
      if (!citations.some(c => c.type === type && c.title === title)) {
        citations.push({
          type,
          title,
          timestamp,
        });
      }
    }

    return NextResponse.json({
      success: true,
      reply,
      citations,
      knowledgeStats: {
        conceptsCount: activeContext.concepts.length,
        rulesCount: activeContext.rules.length,
        exceptionsCount: activeContext.exceptions.length,
      },
    });
  } catch (error) {
    console.error('AI chat failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chat failed' },
      { status: 500 }
    );
  }
}
