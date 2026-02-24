import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const token = (await cookies()).get("access_token")?.value;
  const branchId = (await cookies()).get("branchId")?.value;

  const res = await fetch(`${process.env.API_URL}/branches`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Branch-Id": branchId || "",
    },
  });

  const data = await res.json();

  return NextResponse.json(data);
}
