"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle } from "lucide-react";

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

  const [bankAccountName, setBankAccountName] = useState(initialBankAccountName);
  const [bankBsb, setBankBsb] = useState(initialBankBsb);
  const [bankAccountNumber, setBankAccountNumber] = useState(initialBankAccountNumber);
  const [bankSaving, setBankSaving] = useState(false);
  const [bankSaved, setBankSaved] = useState(false);

  const [disconnecting, setDisconnecting] = useState(false);

  const saveBankDetails = async () => {
    setBankSaving(true);
    setBankSaved(false);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.auth.updateUser({
      data: {
        ...user.user_metadata,
        bank_account_name: bankAccountName,
        bank_bsb: bankBsb,
        bank_account_number: bankAccountNumber,
      },
    });
    setBankSaving(false);
    setBankSaved(true);
    setTimeout(() => setBankSaved(false), 3000);
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
          Auto-filled into invoice Notes when you create a new invoice.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Account name</label>
            <input
              type="text"
              value={bankAccountName}
              onChange={(e) => setBankAccountName(e.target.value)}
              placeholder="e.g. John Smith Events"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">BSB</label>
            <input
              type="text"
              value={bankBsb}
              onChange={(e) => setBankBsb(e.target.value)}
              placeholder="e.g. 062-000"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Account number</label>
            <input
              type="text"
              value={bankAccountNumber}
              onChange={(e) => setBankAccountNumber(e.target.value)}
              placeholder="e.g. 12345678"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <button
            onClick={saveBankDetails}
            disabled={bankSaving}
            className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {bankSaving ? "Saving..." : bankSaved ? "Saved" : "Save bank details"}
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
            {justConnected && (
              <p className="text-sm text-green-600 mb-3">
                Stripe connected successfully.
              </p>
            )}
            <a
              href="/api/stripe/connect"
              className="inline-flex px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
            >
              Connect Stripe
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
