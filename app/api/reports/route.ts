import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { subMonths, startOfMonth, endOfMonth } from "date-fns";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
export async function GET(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const decoded = token ? verifyToken(token) : null;

  if (!decoded) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const months = Array.from({ length: 6 })
    .map((_, i) => {
      const date = subMonths(now, i);
      return {
        label: `${date.getFullYear()}-${(date.getMonth() + 1)
          .toString()
          .padStart(2, "0")}`,
        from: startOfMonth(date),
        to: endOfMonth(date),
      };
    })
    .reverse();

  const data = await Promise.all(
    months.map(async ({ label, from, to }) => {
      const totalSales = await prisma.sale.aggregate({
        _sum: {
          total: true,
        },
        where: {
          companyId: decoded.companyId,
          createdAt: {
            gte: from,
            lte: to,
          },
        },
      });

      return {
        month: label,
        total: totalSales._sum.total || 0,
      };
    })
  );

  const monthlyGrowth = data.map((d, i) => {
    const prev = data[i - 1]?.total || 0;
    return {
      ...d,
      growth: prev > 0 ? ((d.total - prev) / prev) * 100 : null,
    };
  });

  const projectedNextMonth = (() => {
    const last = monthlyGrowth.at(-1)?.total || 0;
    const prev = monthlyGrowth.at(-2)?.total || 0;
    if (last && prev) {
      const avgGrowth = (last - prev) / prev;
      return last + last * avgGrowth;
    }
    return null;
  })();

  return NextResponse.json({ data: monthlyGrowth, projectedNextMonth });
}
