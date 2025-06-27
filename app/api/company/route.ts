import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { name, email, password } = await req.json();
  const prisma = new PrismaClient();
  // Validate input
  if (!name || !email || !password) {
    return NextResponse.json(
      { error: "All fields are required" },
      { status: 400 }
    );
  }
  // Check if company already exists
  const existingCompany = await prisma.company.findUnique({
    where: { email },
  });
  if (existingCompany) {
    return NextResponse.json(
      { error: "Company already exists" },
      { status: 400 }
    );
  }
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });
  if (existingUser) {
    return NextResponse.json({ error: "User already exists" }, { status: 400 });
  }

  const hashed = await hash(password, 10);
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 15);

  const company = await prisma.company.create({
    data: {
      name,
      email,
      trialEndsAt,
      users: {
        create: {
          email,
          password: hashed,
          role: "ADMIN",
          name: "Administrador",
        },
      },
      branches: {
        create: {
          name: "Sucursal Principal",
        },
      },
    },
  });

  return NextResponse.json({ success: true });
}
