import { DecisionOutcome, TicketStatus } from "@prisma/client";

import { prisma } from "./prisma";

const escalatedStatuses: TicketStatus[] = [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED];

const escalatedCaseFilter = {
  OR: [
    { status: TicketStatus.ESCALATED },
    { status: { in: escalatedStatuses }, escalationLevel: { gt: 0 } },
    { decisions: { some: { outcome: { in: [DecisionOutcome.ESCALATED, DecisionOutcome.HUMAN_REVIEW] } } } },
  ],
};

export async function listSupportCases() {
  return prisma.ticket.findMany({
    where: escalatedCaseFilter,
    include: {
      priority: { select: { name: true, severity: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getSupportCase(id: string) {
  return prisma.ticket.findFirst({
    where: { id, ...escalatedCaseFilter },
    include: {
      priority: { select: { name: true, severity: true } },
      messages: { orderBy: { createdAt: "asc" } },
      decisions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { evidence: { orderBy: { createdAt: "asc" } } },
      },
    },
  });
}

export async function replyToSupportCase(id: string, content: string) {
  const supportCase = await getSupportCase(id);
  if (!supportCase) return null;

  return prisma.$transaction(async (transaction) => {
    const message = await transaction.conversationMessage.create({
      data: { ticketId: id, authorRole: "SUPPORT", content },
    });
    await transaction.ticket.update({
      where: { id },
      data: { status: TicketStatus.IN_PROGRESS },
    });
    return message;
  });
}

export async function resolveSupportCase(id: string) {
  const supportCase = await getSupportCase(id);
  if (!supportCase) return null;

  return prisma.ticket.update({
    where: { id },
    data: { status: TicketStatus.RESOLVED },
    select: { id: true, status: true, updatedAt: true },
  });
}
