import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { APIError } from "better-auth/api";
import { auth } from "./auth";
import { authFormSchema } from "./validation";

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator(authFormSchema)
  .handler(async ({ data }) => {
    try {
      await auth.api.signInEmail({
        body: {
          email: data.email,
          password: data.password,
        },
        headers: getRequestHeaders(),
      });

      return { success: true };
    } catch (error) {
      if (error instanceof APIError) {
        return { success: false, error: "Invalid credentials" };
      }

      return { success: false, error: "Failed to sign in" };
    }
  });

export const registerFn = createServerFn({ method: "POST" })
  .inputValidator(authFormSchema)
  .handler(async ({ data }) => {
    try {
      await auth.api.signUpEmail({
        body: {
          email: data.email,
          password: data.password,
          name: data.email.split("@")[0],
        },
        headers: getRequestHeaders(),
      });

      return { success: true };
    } catch (error) {
      if (error instanceof APIError) {
        if (error.status === 409) {
          return { success: false, error: "Account already exists" };
        }

        return { success: false, error: "Failed to create account" };
      }

      return { success: false, error: "Failed to create account" };
    }
  });
