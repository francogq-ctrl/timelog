import { prisma } from "@/lib/db";
import { fetchProjects, fetchTasks } from "@/lib/asana";

export async function syncAsana() {
  const projects = await fetchProjects();

  for (const project of projects) {
    // Upsert project
    await prisma.asanaProject.upsert({
      where: { gid: project.gid },
      update: { name: project.name, lastSynced: new Date() },
      create: { gid: project.gid, name: project.name },
    });

    // Fetch and upsert tasks
    const tasks = await fetchTasks(project.gid);
    const dbProject = await prisma.asanaProject.findUnique({
      where: { gid: project.gid },
    });
    if (!dbProject) continue;

    for (const task of tasks) {
      await prisma.asanaTask.upsert({
        where: { gid: task.gid },
        update: {
          name: task.name,
          completed: task.completed,
          lastSynced: new Date(),
        },
        create: {
          gid: task.gid,
          name: task.name,
          completed: task.completed,
          projectId: dbProject.id,
        },
      });
    }
  }

  // Mark projects not in Asana as inactive
  const activeGids = projects.map((p) => p.gid);
  await prisma.asanaProject.updateMany({
    where: { gid: { notIn: activeGids } },
    data: { active: false },
  });

  return { projectsSync: projects.length };
}
