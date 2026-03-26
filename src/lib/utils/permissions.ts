export const hasManageAdminPermissions = (p) => {
    return p.role === "ADMIN" || p.role === "EDITOR";
};