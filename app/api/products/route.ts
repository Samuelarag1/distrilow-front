import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const decoded = token ? verifyToken(token) : null;

  if (!decoded) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const products = await prisma.product.findMany({
    where: { companyId: decoded.companyId },
  });

  return NextResponse.json(products);
}

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const decoded = token ? verifyToken(token) : null;

  if (!decoded || decoded.role !== "ADMIN") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, categoryId, price } = body;

  if (!name || !categoryId || price === undefined) {
    return NextResponse.json({ message: "Missing fields" }, { status: 400 });
  }

  const product = await prisma.product.create({
    data: {
      name,
      price,
      categoryId,
      companyId: decoded.companyId,
    },
  });

  return NextResponse.json(product);
}
