"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { signIn } from "@/auth";

export interface LoginState {
  error?: string;
}

export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/admin",
    });
    return {};
  } catch (error) {
    if (error instanceof CredentialsSignin && error.code === "rate_limited") {
      return { error: "Demasiados intentos. Esperá un minuto y probá de nuevo." };
    }
    if (error instanceof AuthError) {
      return { error: "Email o contraseña incorrectos." };
    }
    // signIn redirects by throwing; let Next.js handle it.
    throw error;
  }
}
