import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || "secret";

export async function POST(req: Request) {
  const body = await req.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json(
      { message: "Missing credentials" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  const valid = await bcrypt.compare(password, user.password);

  if (!valid) {
    return NextResponse.json(
      { message: "Invalid credentials" },
      { status: 401 }
    );
  }

  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
  });

  if (company?.trialEndsAt && new Date(company.trialEndsAt) < new Date()) {
    return NextResponse.json({ message: "Trial expired" }, { status: 403 });
  }

  const token = jwt.sign(
    {
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  return NextResponse.json({ token });
}

export async function PUT(req: Request) {
  const body = await req.json();
  const { name, email, password } = body;

  if (!name || !email || !password) {
    return NextResponse.json({ message: "Missing fields" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    return NextResponse.json(
      { message: "Email already used" },
      { status: 409 }
    );
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const company = await prisma.company.create({
    data: {
      name: `${name}'s Business`,
      trialEndsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 15), // 15 días trial
    },
  });

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: "ADMIN",
      companyId: company.id,
    },
  });

  const token = jwt.sign(
    {
      userId: user.id,
      companyId: company.id,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  return NextResponse.json({ token });
}
