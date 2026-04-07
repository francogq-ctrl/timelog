"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Category } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";

export async function getEntriesForDate(date: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  return prisma.timeEntry.findMany({
    where: {
      userId: session.user.id,
      date: new Date(date),
    },
    include: {
      workType: true,
      activity: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function createEntry(data: {
  date: string;
  category: Category;
  clientName?: string;
  asanaProjectId?: string;
  asanaTaskId?: string;
  asanaTaskName?: string;
  workTypeId?: string;
  activityId?: string;
  description?: string;
  hours: number;
  notes?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  // Validate hours (0.25 increments)
  if (data.hours <= 0 || data.hours % 0.25 !== 0) {
    throw new Error("Hours must be in 0.25 increments");
  }

  // Validate date is within last 7 days
  const entryDate = new Date(data.date);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  if (entryDate < sevenDaysAgo) {
    throw new Error("Cannot log entries older than 7 days");
  }

  await prisma.timeEntry.create({
    data: {
      userId: session.user.id,
      date: entryDate,
      category: data.category,
      clientName: data.clientName || null,
      asanaProjectId: data.asanaProjectId || null,
      asanaTaskId: data.asanaTaskId || null,
      asanaTaskName: data.asanaTaskName || null,
      workTypeId: data.workTypeId || null,
      activityId: data.activityId || null,
      description: data.description || null,
      hours: data.hours,
      notes: data.notes || null,
    },
  });

  revalidatePath("/log");
}

export async function updateEntry(
  id: string,
  data: {
    category: Category;
    clientName?: string;
    asanaProjectId?: string;
    asanaTaskId?: string;
    asanaTaskName?: string;
    workTypeId?: string;
    activityId?: string;
    description?: string;
    hours: number;
    notes?: string;
  }
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const entry = await prisma.timeEntry.findUnique({ where: { id } });
  if (!entry || entry.userId !== session.user.id) {
    throw new Error("Entry not found");
  }

  await prisma.timeEntry.update({
    where: { id },
    data: {
      category: data.category,
      clientName: data.clientName || null,
      asanaProjectId: data.asanaProjectId || null,
      asanaTaskId: data.asanaTaskId || null,
      asanaTaskName: data.asanaTaskName || null,
      workTypeId: data.workTypeId || null,
      activityId: data.activityId || null,
      description: data.description || null,
      hours: data.hours,
      notes: data.notes || null,
    },
  });

  revalidatePath("/log");
}

export async function deleteEntry(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const entry = await prisma.timeEntry.findUnique({ where: { id } });
  if (!entry || entry.userId !== session.user.id) {
    throw new Error("Entry not found");
  }

  await prisma.timeEntry.delete({ where: { id } });
  revalidatePath("/log");
}

export async function getWorkTypes() {
  return prisma.workType.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getActivities(category: Category) {
  return prisma.activity.findMany({
    where: { category, active: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getAsanaProjects() {
  return prisma.asanaProject.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
}

export async function getAsanaTasks(projectId: string) {
  return prisma.asanaTask.findMany({
    where: {
      project: { gid: projectId },
      completed: false,
    },
    orderBy: { name: "asc" },
  });
}
