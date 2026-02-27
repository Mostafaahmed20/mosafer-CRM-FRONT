type UserLike = {
  role?: string | null;
  canViewAllAnalytics?: boolean | null;
} | null | undefined;

export function isGlobalAdmin(user: UserLike): boolean {
  return String(user?.role || "").toLowerCase() === "admin";
}

export function canManageGlobalUsers(user: UserLike): boolean {
  return isGlobalAdmin(user);
}

export function canAccessAnalytics(user: UserLike): boolean {
  return isGlobalAdmin(user) && Boolean(user?.canViewAllAnalytics);
}
