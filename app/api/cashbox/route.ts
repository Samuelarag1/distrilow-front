import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const decoded = token ? verifyToken(token) : null;

  if (!decoded) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { branchId, amount, type, note } = body;

  if (
    !branchId ||
    typeof amount !== "number" ||
    !["OPENING", "CLOSURE", "MOVEMENT"].includes(type)
  ) {
    return NextResponse.json(
      { message: "Missing or invalid fields" },
      { status: 400 }
    );
  }

  try {
    const entry = await prisma.cashboxLog.create({
      data: {
        branchId,
        userId: decoded.userId,
        amount,
        type,
        note,
      },
    });

    return NextResponse.json(entry);
  } catch (error) {
    return NextResponse.json(
      { message: "Error registering cashbox entry" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const decoded = token ? verifyToken(token) : null;

  if (!decoded) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const branchId = url.searchParams.get("branchId");
  const date = url.searchParams.get("date");

  if (!branchId || !date) {
    return NextResponse.json(
      { message: "Missing branchId or date" },
      { status: 400 }
    );
  }

  const start = new Date(date);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  try {
    const logs = await prisma.cashboxLog.findMany({
      where: {
        branchId,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return NextResponse.json(logs);
  } catch (error) {
    return NextResponse.json(
      { message: "Error fetching cashbox logs" },
      { status: 500 }
    );
  }
}
