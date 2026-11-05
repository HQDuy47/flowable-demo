import type { Role } from "@demo/shared/auth/session";
import type { IconName } from "@demo/shared/ui";

/** Menu trái. Mỗi mục gắn một vai trò: maker (employee), checker (approver), admin; superadmin thấy tất cả. */
export const NAV: { path: string; name: string; icon: IconName; role: Role }[] =
  [
    { path: "/new", name: "New request", icon: "add", role: "employee" },
    {
      path: "/request-types",
      name: "Request types",
      icon: "doc",
      role: "admin",
    },
    { path: "/approvals", name: "Approvals", icon: "task", role: "approver" },
  ];

/** Mục menu ứng với đường dẫn hiện tại (vd. "/approvals/abc" → Approvals). */
export const navOf = (pathname: string) =>
  NAV.find((n) => pathname === n.path || pathname.startsWith(n.path + "/"));

/** Chữ trên thanh tab trình duyệt theo vai trò, để phân biệt tab maker / checker / admin. */
export const TAB_TITLE: Record<Role, string> = {
  employee: "Maker",
  approver: "Checker",
  admin: "Admin",
  superadmin: "Super admin",
};

/** Vai trò này có được mở mục menu này không. */
export const canSee = (item: (typeof NAV)[number], role: Role) =>
  role === "superadmin" || item.role === role;

/** Màn đầu tiên của một vai trò. */
export const homeOf = (role: Role) =>
  NAV.find((n) => canSee(n, role))?.path ?? "/login";
