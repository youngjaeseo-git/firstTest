import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await hash("adminyj", 12);
  const user = await prisma.user.upsert({
    where: { email: "adminyj@dcim.local" },
    update: { password, role: "ADMIN" },
    create: {
      email: "adminyj@dcim.local",
      name: "Admin YJ",
      password,
      role: "ADMIN",
    },
  });
  console.log("Created admin:", user.email, user.role);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
