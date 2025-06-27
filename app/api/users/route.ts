import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const decoded = token ? verifyToken(token) : null;
  if (!decoded || decoded.role !== "ADMIN")
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const users = await prisma.user.findMany({
    where: { companyId: decoded.companyId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  return NextResponse.json(users);
}

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const decoded = token ? verifyToken(token) : null;
  if (!decoded || decoded.role !== "ADMIN")
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, email, password, role } = body;

  if (!name || !email || !password || !role)
    return NextResponse.json({ message: "Missing fields" }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing)
    return NextResponse.json(
      { message: "Email already in use" },
      { status: 409 }
    );

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role,
      companyId: decoded.companyId,
    },
  });

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  });
}

export async function PUT(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const decoded = token ? verifyToken(token) : null;
  if (!decoded || decoded.role !== "ADMIN")
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, name, role } = body;

  if (!id || !name || !role)
    return NextResponse.json({ message: "Missing fields" }, { status: 400 });

  const updated = await prisma.user.update({
    where: { id },
    data: { name, role },
  });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    role: updated.role,
  });
}

export async function DELETE(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const decoded = token ? verifyToken(token) : null;
  if (!decoded || decoded.role !== "ADMIN")
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ message: "Missing id" }, { status: 400 });

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ message: "Deleted" });
}
