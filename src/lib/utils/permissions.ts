export const hasManageAdminPermissions = (p: { role: string }) => {
    return p.role === "ADMIN" || p.role === "EDITOR";
};