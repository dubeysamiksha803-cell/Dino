import AuthForm from "@/components/auth/AuthForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-white text-zinc-900 dark:from-[#0b0c10] dark:via-[#0c1020] dark:to-[#0a0a14] dark:bg-gradient-to-br dark:text-zinc-50">
      <div className="w-full max-w-md p-6 md:p-10">
        <AuthForm mode="signin" />
      </div>
    </div>
  );
}
