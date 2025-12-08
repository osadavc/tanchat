import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useSession } from "@/components/session-provider";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginFn } from "../-utils/actions";
import { authFormSchema } from "../-utils/validation";

export const Route = createFileRoute("/(auth)/login/")({
  component: Page,
});

function Page() {
  const router = useRouter();
  const { refetch } = useSession();

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    validators: {
      onBlur: authFormSchema,
    },
    onSubmit: async ({ value }) => {
      const result = await loginFn({ data: value });

      if (result.success) {
        toast({
          type: "success",
          description: "Signed in successfully!",
        });
        await refetch();
        await router.invalidate();
        await router.navigate({ to: "/" });
      } else {
        toast({
          type: "error",
          description: result.error || "Failed to sign in",
        });
      }
    },
  });

  return (
    <div className="flex h-dvh w-screen items-start justify-center bg-background pt-12 md:items-center md:pt-0">
      <div className="flex w-full max-w-md flex-col gap-12 overflow-hidden rounded-2xl">
        <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
          <h3 className="font-semibold text-xl dark:text-zinc-50">Sign In</h3>
          <p className="text-gray-500 text-sm dark:text-zinc-400">
            Use your email and password to sign in
          </p>
        </div>
        <form
          className="flex flex-col gap-4 px-4 sm:px-16"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit().catch(() => {
              toast({
                type: "error",
                description: "Failed to sign in",
              });
            });
          }}
        >
          <form.Field name="email">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label
                  className="font-normal text-zinc-600 dark:text-zinc-400"
                  htmlFor={field.name}
                >
                  Email Address
                </Label>
                <Input
                  autoComplete="email"
                  autoFocus
                  className="bg-muted text-md md:text-sm"
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="user@acme.com"
                  type="email"
                  value={field.state.value}
                />
                {field.state.meta.errors.length > 0 && (
                  <em className="text-red-500 text-sm">
                    {field.state.meta.errors[0]?.message}
                  </em>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="password">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label
                  className="font-normal text-zinc-600 dark:text-zinc-400"
                  htmlFor={field.name}
                >
                  Password
                </Label>
                <Input
                  className="bg-muted text-md md:text-sm"
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  type="password"
                  value={field.state.value}
                />
                {field.state.meta.errors.length > 0 && (
                  <em className="text-red-500 text-sm">
                    {field.state.meta.errors[0]?.message}
                  </em>
                )}
              </div>
            )}
          </form.Field>

          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
          >
            {([canSubmit, isSubmitting]) => (
              <SubmitButton
                canSubmit={canSubmit}
                isSubmitting={isSubmitting}
                isSuccessful={false}
              >
                Sign in
              </SubmitButton>
            )}
          </form.Subscribe>

          <p className="mt-4 text-center text-gray-600 text-sm dark:text-zinc-400">
            {"Don't have an account? "}
            <Link
              className="font-semibold text-gray-800 hover:underline dark:text-zinc-200"
              to="/register"
            >
              Sign up
            </Link>
            {" for free."}
          </p>
        </form>
      </div>
    </div>
  );
}
