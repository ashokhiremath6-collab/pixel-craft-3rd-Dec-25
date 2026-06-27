import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, AlertCircle, Building2 } from "lucide-react";

interface PublicPaymentRequest {
  id: string;
  amount: string;
  description: string;
  status: string;
  requestedAt: string;
  clientPaidAt: string | null;
  clientUtr: string | null;
  vendorName: string;
  projectName: string | null;
  bankName: string | null;
  accountNumber: string | null;
  ifscCode: string | null;
  branch: string | null;
  orgName: string;
}

export default function PaymentRequestPublicPage() {
  const [, params] = useRoute("/pay/:token");
  const token = params?.token ?? "";
  const [utr, setUtr] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const { data: pr, isLoading, error } = useQuery<PublicPaymentRequest>({
    queryKey: ["/api/payment-requests/public", token],
    queryFn: () =>
      fetch(`/api/payment-requests/public/${token}`).then(async r => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    enabled: !!token,
    retry: false,
  });

  const confirmMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/payment-requests/public/${token}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientUtr: utr }),
      }).then(async r => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => setConfirmed(true),
  });

  const amount = pr
    ? `₹${Number(pr.amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "";

  const alreadyPaid = pr?.status === "client_paid" || pr?.status === "confirmed";

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-[#1d1d1f]">Olympik Design</h1>
          <p className="text-sm text-[#6e6e73] mt-1">Payment Request</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-[#e5e5ea] overflow-hidden">
          {isLoading && (
            <div className="p-10 text-center text-[#6e6e73]">Loading payment details…</div>
          )}

          {error && (
            <div className="p-8 text-center">
              <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
              <p className="font-semibold text-[#1d1d1f]">Link not found or expired</p>
              <p className="text-sm text-[#6e6e73] mt-1">Please contact your designer for a fresh link.</p>
            </div>
          )}

          {pr && !confirmed && (
            <>
              <div className="bg-[#0071e3] px-6 py-5">
                <p className="text-xs font-semibold text-blue-200 uppercase tracking-wide mb-1">Amount due</p>
                <p className="text-3xl font-bold text-white">{amount}</p>
                {pr.projectName && (
                  <p className="text-sm text-blue-200 mt-1">{pr.projectName}</p>
                )}
              </div>

              <div className="p-6 space-y-5">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[#6e6e73] uppercase tracking-wide">For</p>
                  <p className="text-[#1d1d1f] font-medium">{pr.vendorName}</p>
                  <p className="text-sm text-[#6e6e73]">{pr.description}</p>
                </div>

                {(pr.bankName || pr.accountNumber || pr.ifscCode) && (
                  <div className="rounded-xl bg-[#f5f5f7] p-4 space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="h-4 w-4 text-[#6e6e73]" />
                      <p className="text-xs font-semibold text-[#6e6e73] uppercase tracking-wide">Transfer to</p>
                    </div>
                    {pr.bankName && (
                      <div className="flex justify-between text-sm">
                        <span className="text-[#6e6e73]">Bank</span>
                        <span className="font-medium text-[#1d1d1f]">{pr.bankName}{pr.branch ? ` — ${pr.branch}` : ""}</span>
                      </div>
                    )}
                    {pr.accountNumber && (
                      <div className="flex justify-between text-sm">
                        <span className="text-[#6e6e73]">Account No</span>
                        <span className="font-mono font-medium text-[#1d1d1f]">{pr.accountNumber}</span>
                      </div>
                    )}
                    {pr.ifscCode && (
                      <div className="flex justify-between text-sm">
                        <span className="text-[#6e6e73]">IFSC</span>
                        <span className="font-mono font-medium text-[#1d1d1f]">{pr.ifscCode}</span>
                      </div>
                    )}
                  </div>
                )}

                {alreadyPaid ? (
                  <div className="rounded-xl bg-green-50 border border-green-200 p-4 flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                    <div>
                      <p className="font-semibold text-green-800 text-sm">Payment already confirmed</p>
                      {pr.clientUtr && (
                        <p className="text-xs text-green-700 mt-0.5">UTR: {pr.clientUtr}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 pt-2 border-t border-[#e5e5ea]">
                    <p className="text-sm text-[#3d3d3d]">
                      After transferring the amount, enter your UTR / transaction reference below so your designer can verify the payment.
                    </p>
                    <div className="space-y-1.5">
                      <Label htmlFor="utr" className="text-sm font-medium">UTR / Transaction Reference</Label>
                      <Input
                        id="utr"
                        value={utr}
                        onChange={e => setUtr(e.target.value)}
                        placeholder="e.g. HDFC0123456789"
                      />
                    </div>
                    {confirmMutation.error && (
                      <p className="text-sm text-red-600">{String(confirmMutation.error)}</p>
                    )}
                    <Button
                      className="w-full"
                      disabled={!utr.trim() || confirmMutation.isPending}
                      onClick={() => confirmMutation.mutate()}
                    >
                      {confirmMutation.isPending ? "Confirming…" : "I've Made the Payment"}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}

          {confirmed && (
            <div className="p-10 text-center space-y-3">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
              <p className="text-xl font-semibold text-[#1d1d1f]">Payment confirmed!</p>
              <p className="text-sm text-[#6e6e73]">
                Your designer has been notified. UTR <strong>{utr}</strong> has been recorded.
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-[#a1a1a6] mt-5">
          Powered by Olympik Design
        </p>
      </div>
    </div>
  );
}
