/** Canonical administrator identity shared by browser and server code. */
export const ADMIN_EMAIL = "igor1fontes@gmail.com";

export function isAdminEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && email.trim().toLowerCase() === ADMIN_EMAIL;
}
