"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, ArrowRight, CheckCircle2, Zap } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const justRegistered = searchParams.get("registered") === "1";
  const loggedOut = searchParams.get("logged_out") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    if (result?.error) {
      setError("Invalid email or password.");
      setLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => {
        window.location.href = callbackUrl;
      }, 400);
    }
  }

  return (
    <AnimatePresence mode="wait">
      {success ? (
        <motion.div
          key="success"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-950/95 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
          >
            <CheckCircle2 className="h-14 w-14 text-green-400 mb-6" />
          </motion.div>
          <p className="text-lg font-semibold text-gray-100 mb-2">로그인 성공</p>
          <p className="text-sm text-gray-500 mb-8">대시보드로 이동합니다</p>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="h-8 w-8 rounded-full border-2 border-[#EA002C]/30 border-t-[#EA002C]"
          />
        </motion.div>
      ) : (
      <motion.div
        key="form"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="rounded-2xl border border-gray-800/80 bg-gray-900/90 p-8 shadow-2xl shadow-black/40 backdrop-blur-md"
      >
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#FF8200] via-[#EA002C] to-[#B5008E] shadow-xl shadow-[#EA002C]/25">
            <Zap className="h-7 w-7 text-white drop-shadow-sm" fill="white" aria-hidden="true" />
            <span className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/20" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-100">
            DC <span className="text-[#EA002C]">Express</span>
          </h1>
          <p className="mt-1.5 text-sm text-gray-500">
            Data Center Infrastructure Management
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {justRegistered && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-400"
            >
              Registration complete. Please sign in.
            </motion.div>
          )}
          {loggedOut && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-4 py-3 text-sm text-blue-400"
            >
              로그아웃 되었습니다.
            </motion.div>
          )}
          {error && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400"
            >
              {error}
            </motion.div>
          )}

        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-xs font-semibold text-gray-400 uppercase tracking-wider"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-700/60 bg-gray-800/60 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="admin@example.com"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-xs font-semibold text-gray-400 uppercase tracking-wider"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-700/60 bg-gray-800/60 px-4 py-2.5 pr-10 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-gray-500 hover:text-gray-300 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="group flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 hover:shadow-blue-500/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <>
              Sign In
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
          >
            Sign Up
          </Link>
        </p>
      </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function LoginPage() {
  return (
    <div className="w-full max-w-md">
      <Suspense fallback={
        <div className="rounded-2xl border border-gray-800/80 bg-gray-900/90 p-8 shadow-2xl animate-pulse backdrop-blur-md">
          <div className="h-64" />
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}
