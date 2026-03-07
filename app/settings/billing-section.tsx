'use client'

import { useState } from 'react'
import { Check, Loader2, CreditCard } from 'lucide-react'

interface BillingSectionProps {
  status: string | null
  trialEnd: string | null
  subscriptionEnd: string | null
}

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: '/month',
    features: [
      'Up to 5 couples',
      'Up to 5 events',
      'Basic task tracking',
      'Community support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$50',
    period: '/month',
    features: [
      'Unlimited couples & events',
      'Vendor management',
      'Advanced task tracking',
      'Priority support',
      'Custom packages',
      'Analytics & reporting',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    price: '$100',
    period: '/month',
    features: [
      'Everything in Pro',
      'Team collaboration',
      'Dedicated account manager',
      'Custom integrations',
      'AI-powered insights',
      'AI event planning assistant',
    ],
  },
]

export function BillingSection({ status }: BillingSectionProps) {
  const [selectedPlan, setSelectedPlan] = useState('pro')
  const [redirecting, setRedirecting] = useState(false)

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId)
  }

  const handleSubscribe = () => {
    setRedirecting(true)
    window.location.href = '/api/stripe/checkout'
  }

  return (
    <div className="max-w-4xl space-y-10">
      {/* Select Your Plan */}
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-4">Select Your Plan</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isSelected = selectedPlan === plan.id
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => handleSelectPlan(plan.id)}
                className={`relative text-left border rounded-xl p-5 transition ${
                  isSelected
                    ? 'border-gray-900 ring-1 ring-gray-900'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {isSelected && (
                  <span className="absolute -top-2.5 left-4 bg-gray-900 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                    Selected
                  </span>
                )}
                <div className="mb-3">
                  <span className="text-sm font-medium text-gray-900">{plan.name}</span>
                </div>
                <div className="mb-4">
                  <span className="text-2xl font-semibold text-gray-900">{plan.price}</span>
                  <span className="text-sm text-gray-500">{plan.period}</span>
                </div>
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-gray-600">
                      <Check size={14} className="text-green-500 shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>
        {selectedPlan !== 'free' && (
          <div className="mt-4">
            <button
              onClick={handleSubscribe}
              disabled={redirecting}
              className="bg-black text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-neutral-800 disabled:opacity-50 transition inline-flex items-center gap-2"
            >
              {redirecting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Redirecting...
                </>
              ) : (
                `Subscribe to ${plans.find((p) => p.id === selectedPlan)?.name}`
              )}
            </button>
          </div>
        )}
      </div>

      {/* Card Details */}
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-4">Card Details</h3>
        {status === 'active' || status === 'trialing' ? (
          <div className="flex items-center gap-3 border border-gray-200 rounded-lg p-4">
            <CreditCard size={20} className="text-gray-400" />
            <div className="flex-1">
              <p className="text-sm text-gray-900">&bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; 4242</p>
              <p className="text-xs text-gray-500">Expires 12/27</p>
            </div>
            <button
              onClick={() => { window.location.href = '/api/stripe/portal' }}
              className="text-sm text-gray-500 hover:text-gray-700 font-medium transition"
            >
              Update
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No payment method on file. Subscribe to a plan to add one.</p>
        )}
      </div>
    </div>
  )
}
