'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function VerifyOTPPage() {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const { toast } = useToast();

  useEffect(() => {
    if (!email) {
      router.push('/forgot-password');
    }
  }, [email, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'OTP Verified',
          description: 'OTP verified successfully. Redirecting...',
        });
        setTimeout(() => {
          router.push(`/reset-password?email=${encodeURIComponent(email)}&otp=${encodeURIComponent(otp)}`);
        }, 1000);
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Something went wrong',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Network error. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'OTP Resent',
          description: 'OTP resent to your email.',
        });
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Something went wrong',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Network error. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!email) {
    return null;
  }

  return (
    <div className="w-full max-w-md px-4">
      <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-white text-xl">Verify OTP</CardTitle>
          <CardDescription className="text-slate-400">
            Enter the 5-digit OTP sent to {email}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp" className="text-slate-200">OTP</Label>
              <Input
                id="otp"
                type="text"
                placeholder="Enter 5-digit OTP"
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 text-center text-2xl tracking-widest"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 5))}
                maxLength={5}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading || otp.length !== 5}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify OTP
            </Button>
          </form>

          <div className="mt-4 space-y-2 text-center">
            <Button
              variant="link"
              onClick={handleResendOTP}
              disabled={loading}
              className="w-full text-sm text-blue-400 hover:text-blue-300"
            >
              Resend OTP
            </Button>
            <Button
              variant="link"
              onClick={() => router.push('/forgot-password')}
              className="w-full text-sm text-slate-400 hover:text-slate-300"
            >
              Back to Forgot Password
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-slate-500 text-sm mt-6">
        &copy; {new Date().getFullYear()} Viros GST Billing. All rights reserved.
      </p>
    </div>
  );
}
