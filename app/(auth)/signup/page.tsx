"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/instantdb/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"info" | "code">("info");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { sendMagicCode, signInWithMagicCode } = useAuth();
  const router = useRouter();

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setLoading(true);

    try {
      await sendMagicCode(email);
      setStep("code");
    } catch (err: any) {
      setError(err.message || "Failed to send magic code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithMagicCode(email, code, name);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Invalid code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <h1 className="text-3xl font-bold mb-2 text-primary">Create Account</h1>
        <p className="text-gray-400 mb-6">Sign up to get started</p>

        {step === "info" ? (
          <form onSubmit={handleSendCode} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500 text-red-500 rounded-lg p-3 text-sm">
                {error}
              </div>
            )}

            <Input
              label="Name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Your name"
            />

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending code..." : "Send Magic Code"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500 text-red-500 rounded-lg p-3 text-sm">
                {error}
              </div>
            )}

            <p className="text-sm text-gray-400">
              We sent a magic code to <strong>{email}</strong>
            </p>

            <Input
              label="Magic Code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              placeholder="Enter 6-digit code"
              maxLength={6}
            />

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setStep("info");
                  setCode("");
                  setError("");
                }}
              >
                Back
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? "Verifying..." : "Verify Code"}
              </Button>
            </div>
          </form>
        )}

        <p className="mt-6 text-center text-gray-400 text-sm">
          Already have an account?{" "}
          <a href="/login" className="text-primary hover:text-primary-hover">
            Sign in
          </a>
        </p>
      </Card>
    </div>
  );
}
