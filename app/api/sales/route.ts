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
  const { items, branchId, clientId } = body;

  if (!items || !Array.isArray(items) || items.length === 0 || !branchId) {
    return NextResponse.json(
      { message: "Missing or invalid data" },
      { status: 400 }
    );
  }

  try {
    const sale = await prisma.sale.create({
      data: {
        userId: decoded.userId,
        companyId: decoded.companyId,
        branchId,
        clientId,
        total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
        saleDetails: {
          create: items.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
          })),
        },
      },
    });

    for (const item of items) {
      await prisma.stockItem.updateMany({
        where: {
          productId: item.productId,
          branchId,
        },
        data: {
          quantity: {
            decrement: item.quantity,
          },
        },
      });
    }

    return NextResponse.json(sale);
  } catch (error) {
    return NextResponse.json(
      { message: "Error processing sale" },
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
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const sales = await prisma.sale.findMany({
    where: {
      companyId: decoded.companyId,
      ...(branchId && { branchId }),
      ...(from &&
        to && {
          createdAt: {
            gte: new Date(from),
            lte: new Date(to),
          },
        }),
    },
    include: {
      saleDetails: true,
      client: true,
      user: true,
    },
  });

  return NextResponse.json(sales);
}
