"use server";

import { cookies } from "next/headers";

export async function setServerCookie(
  name: string,
  value: string,
  days: number = 7,
) {
  const cookieStore = await cookies();

  cookieStore.set(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: days * 24 * 60 * 60,
  });
}

export async function getServerCookie(name: string) {
  const cookieStore = await cookies();
  return cookieStore.get(name)?.value;
}

export async function deleteServerCookie(name: string) {
  const cookieStore = await cookies();
  cookieStore.delete(name);
}
