'use client';

import { useActionState } from 'react';
import { loginAction } from '@/lib/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Lock, Terminal as TerminalIcon, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const [state, action, isPending] = useActionState(loginAction, null);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0F] terminal-theme p-4 selection:bg-[#00FFD1] selection:text-[#0A0A0F]">
      <Card className="w-full max-w-md border-2 border-[#00FFD1] bg-[#0A0A0F] rounded-none shadow-[0_0_15px_rgba(0,255,209,0.3)] animate-in fade-in zoom-in duration-500">
        <CardHeader className="space-y-1 border-b border-[#00FFD1]/30 pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#00FFD1]">
              <TerminalIcon size={20} />
              <CardTitle className="text-xl font-bold tracking-tighter uppercase tabular-nums">
                Access Gateway
              </CardTitle>
            </div>
            <div className="text-[10px] text-[#00FFD1]/50 uppercase tracking-widest font-mono">
              v1.0.4-stable
            </div>
          </div>
          <CardDescription className="text-[#E2E8F0]/70 font-mono text-xs mt-2">
            // Authentication required to access the terminal.
            <br />
            // Status: <span className="text-[#00FFD1]">Waiting for input...</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-8">
          <form action={action} className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="code" className="text-[#00FFD1] text-xs uppercase tracking-wider font-mono">
                  $ access_code --input
                </Label>
                <Lock size={14} className="text-[#00FFD1]/30" />
              </div>
              <div className="relative group">
                <Input
                  id="code"
                  name="code"
                  type="password"
                  placeholder="••••••"
                  required
                  className="bg-transparent border-[#00FFD1]/40 text-[#00FFD1] rounded-none focus:border-[#00FFD1] focus:ring-1 focus:ring-[#00FFD1] placeholder:text-[#00FFD1]/20 font-mono transition-all duration-200"
                />
                <div className="absolute inset-0 -z-10 bg-[#00FFD1]/5 opacity-0 group-focus-within:opacity-100 transition-opacity" />
              </div>
            </div>

            {state?.error && (
              <div className="text-[#EF4444] text-xs font-mono animate-pulse bg-[#EF4444]/10 p-2 border border-[#EF4444]/30">
                [ERROR]: {state.error.toUpperCase()}
              </div>
            )}

            <Button
              type="submit"
              disabled={isPending}
              className="w-full bg-transparent border-2 border-[#00FFD1] text-[#00FFD1] hover:bg-[#00FFD1] hover:text-[#0A0A0F] rounded-none font-bold uppercase tracking-widest transition-all duration-300 disabled:opacity-50 group relative overflow-hidden"
            >
              <span className="relative z-10 flex items-center gap-2">
                {isPending ? (
                  <>
                    <span className="animate-spin text-xs">/</span> VERIFYING...
                  </>
                ) : (
                  <>
                    EXECUTE ACCESS <ShieldCheck size={16} />
                  </>
                )}
              </span>
              <div className="absolute inset-0 bg-[#00FFD1] translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            </Button>

            <div className="pt-4 text-center">
              <p className="text-[10px] text-[#00FFD1]/30 font-mono italic">
                Unauthorized access is strictly prohibited.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Decorative terminal elements */}
      <div className="fixed top-8 left-8 hidden lg:block font-mono text-[10px] text-[#00FFD1]/20 space-y-1 pointer-events-none">
        <p>INITIALIZING_SECURITY_PROTOCOL...</p>
        <p>SESSION_ID: 7XA9-Q02J-KR8P</p>
        <p>GATEWAY: 192.168.1.254</p>
      </div>

      <div className="fixed bottom-8 right-8 hidden lg:block font-mono text-[10px] text-[#00FFD1]/20 space-y-1 text-right pointer-events-none">
        <p>© 2026 CRYPTO-BITER CO.</p>
        <p>ALL_RIGHTS_RESERVED</p>
      </div>
    </div>
  );
}
