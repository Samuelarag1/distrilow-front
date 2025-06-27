import jwt from "jsonwebtoken";

export function verifyToken(token: string) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    return decoded as { userId: string; companyId: string; role: string };
  } catch {
    return null;
  }
}
export function generateToken(userId: string, companyId: string, role: string) {
  return jwt.sign({ userId, companyId, role }, process.env.JWT_SECRET!, {
    expiresIn: "7d",
  });
}
export function isAuthenticated(token: string | null) {
  if (!token) return false;
  const decoded = verifyToken(token);
  return !!decoded;
}
