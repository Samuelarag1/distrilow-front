import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const decoded = token ? verifyToken(token) : null;
  if (!decoded)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const clients = await prisma.client.findMany({
    where: { companyId: decoded.companyId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(clients);
}

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const decoded = token ? verifyToken(token) : null;
  if (!decoded)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, phone, email } = body;
  if (!name)
    return NextResponse.json({ message: "Name is required" }, { status: 400 });

  const newClient = await prisma.client.create({
    data: {
      name,
      phone,
      email,
      companyId: decoded.companyId,
    },
  });

  return NextResponse.json(newClient);
}

export async function PUT(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const decoded = token ? verifyToken(token) : null;
  if (!decoded)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, name, phone, email } = body;
  if (!id || !name)
    return NextResponse.json({ message: "Missing fields" }, { status: 400 });

  const updatedClient = await prisma.client.update({
    where: { id },
    data: { name, phone, email },
  });

  return NextResponse.json(updatedClient);
}

export async function DELETE(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const decoded = token ? verifyToken(token) : null;
  if (!decoded)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ message: "Missing id" }, { status: 400 });

  await prisma.client.delete({ where: { id } });
  return NextResponse.json({ message: "Deleted" });
}
