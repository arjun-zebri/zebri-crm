"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface PaymentSettingsSectionProps {
  initialBankAccountName: string;
  initialBankBsb: string;
  initialBankAccountNumber: string;
  stripeConnectAccountId: string | null;
  stripeConnectEnabled: boolean;
  justConnected?: boolean;
}

export function PaymentSettingsSection({
  initialBankAccountName,
  initialBankBsb,
  initialBankAccountNumber,
  stripeConnectAccountId,
  stripeConnectEnabled,
  justConnected,
}: PaymentSettingsSectionProps) {
  const supabase = createClient();
  const { toast } = useToast();

  const [bankAccountName, setBankAccountName] = useState(initialBankAccountName);
  const [bankBsb, setBankBsb] = useState(initialBankBsb);
  const [bankAccountNumber, setBankAccountNumber] = useState(initialBankAccountNumber);
  const [bankSaving, setBankSaving] = useState(false);

  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    if (justConnected) {
      toast("Stripe connected successfully.");
    }
  }, []);

  const saveBankDetails = async () => {
    setBankSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBankSaving(false); return; }
    const { error } = await supabase.auth.updateUser({
      data: {
        ...user.user_metadata,
        bank_account_name: bankAccountName,
        bank_bsb: bankBsb,
        bank_account_number: bankAccountNumber,
      },
    });
    setBankSaving(false);
    if (error) {
      toast(error.message, "error");
    } else {
      toast("Bank details saved.");
    }
  };

  const disconnectStripe = async () => {
    setDisconnecting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.auth.updateUser({
      data: {
        ...user.user_metadata,
        stripe_connect_account_id: null,
        stripe_connect_enabled: false,
      },
    });
    window.location.reload();
  };

  const maskedAccountId = stripeConnectAccountId
    ? stripeConnectAccountId.slice(0, 8) + "..." + stripeConnectAccountId.slice(-4)
    : null;

  return (
    <div className="max-w-2xl space-y-8">
      {/* Bank Details */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Bank details</h2>
        <p className="text-sm text-gray-500 mb-5">
          Auto-filled into invoice notes when you create a new invoice.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Account name</label>
            <input
              type="text"
              value={bankAccountName}
              onChange={(e) => setBankAccountName(e.target.value)}
              placeholder="e.g. John Smith Events"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-transparent transition"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">BSB</label>
            <input
              type="text"
              value={bankBsb}
              onChange={(e) => setBankBsb(e.target.value)}
              placeholder="e.g. 062-000"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-transparent transition"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Account number</label>
            <input
              type="text"
              value={bankAccountNumber}
              onChange={(e) => setBankAccountNumber(e.target.value)}
              placeholder="e.g. 12345678"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-transparent transition"
            />
          </div>
          <button
            onClick={saveBankDetails}
            disabled={bankSaving}
            className="px-4 py-2 bg-black text-white text-sm font-medium rounded-xl hover:bg-neutral-800 disabled:opacity-50 transition cursor-pointer"
          >
            {bankSaving ? "Saving..." : "Save bank details"}
          </button>
        </div>
      </div>

      <hr className="border-gray-100" />

      {/* Stripe Connect */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Card payments</h2>
        <p className="text-sm text-gray-500 mb-5">
          Connect your Stripe account so couples can pay invoices by credit card.
        </p>

        {stripeConnectEnabled && stripeConnectAccountId ? (
          <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">Stripe connected</p>
                <p className="text-sm text-gray-500">{maskedAccountId}</p>
              </div>
            </div>
            <button
              onClick={disconnectStripe}
              disabled={disconnecting}
              className="text-sm text-gray-500 hover:text-red-600 transition-colors disabled:opacity-50"
            >
              {disconnecting ? "Disconnecting..." : "Disconnect"}
            </button>
          </div>
        ) : (
          <div>
            <a
              href="/api/stripe/connect"
              className="inline-flex px-4 py-2 bg-black text-white text-sm font-medium rounded-xl hover:bg-neutral-800 transition"
            >
              Connect Stripe
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
