'use client'

import { useState } from 'react'
import { Check, Loader2, CreditCard, Eye, EyeOff } from 'lucide-react'

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

  const [cardNumber, setCardNumber] = useState('')
  const [cardName, setCardName] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [cvv, setCvv] = useState('')
  const [showCvv, setShowCvv] = useState(false)
  const [savingCard, setSavingCard] = useState(false)

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId)
  }

  const handleSubscribe = () => {
    setRedirecting(true)
    window.location.href = '/api/stripe/checkout'
  }

  const handleSaveCard = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSavingCard(true)

    // TODO: Integrate with Stripe API to tokenize and save card
    // For now, this is a placeholder that would redirect to the Stripe portal for subscribed users
    if (status === 'active' || status === 'trialing') {
      window.location.href = '/api/stripe/portal'
    }

    setSavingCard(false)
  }

  const formatCardNumber = (value: string) => {
    return value.replace(/\s/g, '').replace(/(\d{4})/g, '$1 ').trim()
  }

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value)
    if (formatted.length <= 19) {
      setCardNumber(formatted)
    }
  }

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '')
    if (value.length >= 2) {
      value = value.slice(0, 2) + '/' + value.slice(2, 4)
    }
    if (value.length <= 5) {
      setExpiryDate(value)
    }
  }

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value.length <= 4) {
      setCvv(e.target.value)
    }
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
                      <Check size={14} strokeWidth={1.5} className="text-green-500 shrink-0 mt-0.5" />
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
              className="bg-black text-white text-sm font-medium rounded-xl px-4 py-2 hover:bg-neutral-800 disabled:opacity-50 transition inline-flex items-center gap-2 cursor-pointer"
            >
              {redirecting ? (
                <>
                  <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
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
          <div className="flex items-center gap-3 border border-gray-200 rounded-xl p-4">
            <CreditCard size={20} strokeWidth={1.5} className="text-gray-400" />
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
          <form onSubmit={handleSaveCard} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="card-name">
                Cardholder Name
              </label>
              <input
                id="card-name"
                type="text"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                placeholder="John Doe"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="card-number">
                Card Number
              </label>
              <input
                id="card-number"
                type="text"
                value={cardNumber}
                onChange={handleCardNumberChange}
                placeholder="4242 4242 4242 4242"
                maxLength={19}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-transparent transition"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="expiry">
                  Expiry Date
                </label>
                <input
                  id="expiry"
                  type="text"
                  value={expiryDate}
                  onChange={handleExpiryChange}
                  placeholder="MM/YY"
                  maxLength={5}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="cvv">
                  CVV
                </label>
                <div className="relative">
                  <input
                    id="cvv"
                    type={showCvv ? 'text' : 'password'}
                    value={cvv}
                    onChange={handleCvvChange}
                    placeholder="123"
                    maxLength={4}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-transparent transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCvv(!showCvv)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                    tabIndex={-1}
                  >
                    {showCvv ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingCard || !cardNumber || !cardName || !expiryDate || !cvv}
              className="w-full bg-black text-white text-sm font-medium rounded-xl px-4 py-2 hover:bg-neutral-800 disabled:opacity-50 transition cursor-pointer"
            >
              {savingCard ? (
                <>
                  <Loader2 size={14} strokeWidth={1.5} className="animate-spin inline mr-2" />
                  Saving...
                </>
              ) : (
                'Save Card'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
