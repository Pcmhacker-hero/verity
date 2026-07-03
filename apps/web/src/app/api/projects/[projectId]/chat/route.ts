import { db, chatMessages, chatSessions } from '@verity/database';
import { WorkspaceService } from '@verity/services';
import { projectIdParamsSchema } from '@verity/shared/validation';
import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import type { UIMessage } from '@ai-sdk/react';
import { eq, and } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { withApiAuth } from '@/lib/api/handler';
import { parseParams } from '@/lib/api/validation';

const workspaceService = new WorkspaceService();

export const POST = withApiAuth<{ params: Promise<{ projectId: string }> }>(
  async (request: NextRequest, { auth }, routeContext) => {
    const params = parseParams(await routeContext.params, projectIdParamsSchema);
    const { messages } = (await request.json()) as { messages: UIMessage[] };

    // Verify project access
    await workspaceService.getProjectDetail({
      workspaceId: auth.workspaceId,
      projectId: params.projectId,
    });

    // Find or create chat session
    let session = await db.query.chatSessions.findFirst({
      where: and(
        eq(chatSessions.projectId, params.projectId),
        eq(chatSessions.userId, auth.userId)
      ),
    });

    if (!session) {
      const [newSession] = await db
        .insert(chatSessions)
        .values({
          projectId: params.projectId,
          userId: auth.userId,
        })
        .returning();
      session = newSession;
    }

    // Save the latest user message
    const lastMessage = messages[messages.length - 1];
    let content = '';
    if (lastMessage && Array.isArray((lastMessage as any).parts)) {
      content = (lastMessage as any).parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('');
    } else if (lastMessage && (lastMessage as any).content) {
      content = String((lastMessage as any).content);
    }

    if (lastMessage && lastMessage.role === 'user') {
      await db.insert(chatMessages).values({
        sessionId: session!.id,
        role: 'user',
        content,
      });
    }

    const systemPrompt = `You are Verity, an expert software architect and product manager. 
You are helping the user refine their product specifications and technical architecture.
Be concise, clear, and refer to their context.`;

    const result = streamText({
      // @ts-expect-error - version mismatch between ai and @ai-sdk/anthropic
      model: anthropic('claude-3-7-sonnet-20250219'),
      system: systemPrompt,
      messages: messages.map(m => {
        let textContent = '';
        if (Array.isArray((m as any).parts)) {
          textContent = (m as any).parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('');
        } else if ((m as any).content) {
          textContent = String((m as any).content);
        }
        return { 
          role: m.role as 'user' | 'assistant' | 'system', 
          content: textContent 
        };
      }),
      async onFinish({ text }: any) {
        if (session) {
          await db.insert(chatMessages).values({
            sessionId: session.id,
            role: 'assistant',
            content: text,
          });
        }
      },
    });

    return result.toTextStreamResponse();
  }
);
