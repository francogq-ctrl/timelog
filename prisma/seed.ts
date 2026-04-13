import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const workTypes = [
    "Animation", "Editing", "Design", "Illustration", "3D",
    "Art Direction", "Storyboard", "Review/QA", "Project Management",
  ];

  for (let i = 0; i < workTypes.length; i++) {
    await prisma.workType.upsert({
      where: { name: workTypes[i] },
      update: {},
      create: { name: workTypes[i], sortOrder: i },
    });
  }

  const activities: { cat: "INTERNAL" | "ADMIN" | "TRAINING"; items: string[] }[] = [
    { cat: "INTERNAL", items: ["Team Meeting", "Creative Exploration", "R&D", "Portfolio", "Pitch/Proposal", "Company Social Media"] },
    { cat: "ADMIN", items: ["Invoicing", "HR/People", "Scheduling", "Tool Setup", "Email/Comms"] },
    { cat: "TRAINING", items: ["Course/Workshop", "Skill Development", "Tool Learning", "Mentoring"] },
  ];

  for (const { cat, items } of activities) {
    for (let i = 0; i < items.length; i++) {
      await prisma.activity.upsert({
        where: { category_name: { category: cat, name: items[i] } },
        update: {},
        create: { name: items[i], category: cat, sortOrder: i },
      });
    }
  }

  // Create admin user
  await prisma.user.upsert({
    where: { email: "franco@andgather.co" },
    update: { role: "ADMIN", active: true },
    create: {
      email: "franco@andgather.co",
      name: "Franco Garcia",
      role: "ADMIN",
      active: true,
    },
  });

  console.log("Seed completed successfully");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
