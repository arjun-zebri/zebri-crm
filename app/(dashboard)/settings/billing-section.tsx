'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Check, X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

interface BillingSectionProps {
  status: string | null
  trialEnd: string | null
  subscriptionEnd: string | null
  subscriptionPlan: string | null
  hasStripeCustomer: boolean
}

type PlanId = 'starter' | 'pro' | 'max'

interface Feature {
  label: string
  included: boolean
  soon?: boolean
}

interface Plan {
  id: PlanId
  name: string
  price: string
  period: string
  description: string
  badge?: string
  features: Feature[]
}

const allFeatures = [
  'Up to 5 couples',
  'Unlimited couples',
  'CRM & pipeline',
  'Quotes, invoices & payment links',
  'Task management',
  'Couple portal',
  'Song selection & file transfer',
  'Timeline Builder',
  'Pulse',
  'Event Mode',
  'Up to 5 team members',
  'Dedicated account manager & priority support',
]

const plans: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 'Free',
    period: '',
    description: 'For MCs getting started.',
    features: [
      { label: 'Up to 5 couples', included: true },
      { label: 'CRM & pipeline', included: true },
      { label: 'Quotes, invoices & payment links', included: true },
      { label: 'Task management', included: true },
      { label: 'Couple portal', included: false },
      { label: 'Song selection & file transfer', included: false },
      { label: 'Timeline Builder', included: false },
      { label: 'Pulse', included: false },
      { label: 'Event Mode', included: false },
      { label: 'Up to 5 team members', included: false },
      { label: 'Dedicated account manager & priority support', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$49',
    period: '/mo',
    description: 'For working MCs building their business.',
    badge: 'MOST POPULAR',
    features: [
      { label: 'Unlimited couples', included: true },
      { label: 'CRM & pipeline', included: true },
      { label: 'Quotes, invoices & payment links', included: true },
      { label: 'Task management', included: true },
      { label: 'Couple portal', included: true },
      { label: 'Song selection & file transfer', included: true },
      { label: 'Timeline Builder', included: true },
      { label: 'Pulse', included: false },
      { label: 'Event Mode', included: false },
      { label: 'Up to 5 team members', included: false },
      { label: 'Dedicated account manager & priority support', included: false },
    ],
  },
  {
    id: 'max',
    name: 'Max',
    price: '$89',
    period: '/mo',
    description: 'For full-time MCs running a business.',
    features: [
      { label: 'Unlimited couples', included: true },
      { label: 'CRM & pipeline', included: true },
      { label: 'Quotes, invoices & payment links', included: true },
      { label: 'Task management', included: true },
      { label: 'Couple portal', included: true },
      { label: 'Song selection & file transfer', included: true },
      { label: 'Timeline Builder', included: true },
      { label: 'Pulse', included: true, soon: true },
      { label: 'Event Mode', included: true, soon: true },
      { label: 'Up to 5 team members', included: true, soon: true },
      { label: 'Dedicated account manager & priority support', included: true },
    ],
  },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function StatusBanner({
  status,
  trialEnd,
  subscriptionEnd,
  subscriptionPlan,
  onManageBilling,
  redirecting,
}: {
  status: string
  trialEnd: string | null
  subscriptionEnd: string | null
  subscriptionPlan: string | null
  onManageBilling: () => void
  redirecting: boolean
}) {
  const planLabel = subscriptionPlan === 'max' ? 'Max' : 'Pro'

  if (status === 'trialing') {
    return (
      <div className="flex items-center justify-between gap-4 border border-gray-200 rounded-xl px-4 py-3">
        <div className="flex items-center gap-3">
          <CheckCircle2 size={16} strokeWidth={1.5} className="text-green-500 shrink-0" />
          <p className="text-sm text-gray-700">
            You&apos;re on a free trial of <span className="font-medium">Zebri {planLabel}</span>
            {trialEnd && <>, trial ends <span className="font-medium">{formatDate(trialEnd)}</span></>}
          </p>
        </div>
        <button
          onClick={onManageBilling}
          disabled={redirecting}
          className="cursor-pointer text-sm font-medium text-gray-900 hover:text-gray-600 transition shrink-0 inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          {redirecting ? <Loader2 size={13} strokeWidth={1.5} className="animate-spin" /> : null}
          Manage Billing
        </button>
      </div>
    )
  }

  if (status === 'active') {
    return (
      <div className="flex items-center justify-between gap-4 border border-gray-200 rounded-xl px-4 py-3">
        <div className="flex items-center gap-3">
          <CheckCircle2 size={16} strokeWidth={1.5} className="text-green-500 shrink-0" />
          <p className="text-sm text-gray-700">
            You&apos;re subscribed to <span className="font-medium">Zebri {planLabel}</span>
          </p>
        </div>
        <button
          onClick={onManageBilling}
          disabled={redirecting}
          className="cursor-pointer text-sm font-medium text-gray-900 hover:text-gray-600 transition shrink-0 inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          {redirecting ? <Loader2 size={13} strokeWidth={1.5} className="animate-spin" /> : null}
          Manage Billing
        </button>
      </div>
    )
  }

  if (status === 'cancelled') {
    return (
      <div className="flex items-center justify-between gap-4 border border-amber-200 bg-amber-50 rounded-xl px-4 py-3">
        <div className="flex items-center gap-3">
          <AlertCircle size={16} strokeWidth={1.5} className="text-amber-500 shrink-0" />
          <p className="text-sm text-gray-700">
            Your subscription is cancelled
            {subscriptionEnd && <>, access ends <span className="font-medium">{formatDate(subscriptionEnd)}</span></>}
          </p>
        </div>
        <button
          onClick={onManageBilling}
          disabled={redirecting}
          className="cursor-pointer text-sm font-medium text-gray-900 hover:text-gray-600 transition shrink-0 inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          {redirecting ? <Loader2 size={13} strokeWidth={1.5} className="animate-spin" /> : null}
          Resubscribe
        </button>
      </div>
    )
  }

  if (status === 'past_due') {
    return (
      <div className="flex items-center justify-between gap-4 border border-red-200 bg-red-50 rounded-xl px-4 py-3">
        <div className="flex items-center gap-3">
          <AlertCircle size={16} strokeWidth={1.5} className="text-red-500 shrink-0" />
          <p className="text-sm text-gray-700">
            Payment failed. Please update your payment method to keep access.
          </p>
        </div>
        <button
          onClick={onManageBilling}
          disabled={redirecting}
          className="cursor-pointer text-sm font-medium text-red-600 hover:text-red-700 transition shrink-0 inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          {redirecting ? <Loader2 size={13} strokeWidth={1.5} className="animate-spin" /> : null}
          Update Payment
        </button>
      </div>
    )
  }

  return null
}

function PlanCard({
  plan,
  isCurrentPlan,
  isSubscribed,
  onSubscribe,
  onManageBilling,
  redirectingPlan,
}: {
  plan: Plan
  isCurrentPlan: boolean
  isSubscribed: boolean
  onSubscribe: (planId: PlanId) => void
  onManageBilling: () => void
  redirectingPlan: PlanId | null
}) {
  const isPro = plan.id === 'pro'
  const isRedirecting = redirectingPlan === plan.id

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-5 transition shrink-0 w-[90%] sm:w-auto snap-center sm:snap-align-none ${
        isPro
          ? 'border-gray-900 ring-1 ring-gray-900'
          : 'border-gray-200'
      }`}
    >
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-[#6EE7B7] text-gray-900 text-[10px] font-semibold tracking-wide px-3 py-1 rounded-full uppercase">
            {plan.badge}
          </span>
        </div>
      )}

      <div className="mb-1">
        <span className="text-sm font-semibold text-gray-900">{plan.name}</span>
      </div>

      <div className="mb-1 flex items-baseline gap-0.5">
        <span className="text-3xl font-semibold text-gray-900">{plan.price}</span>
        {plan.period && <span className="text-sm text-gray-500">{plan.period}</span>}
      </div>

      <p className="text-sm text-gray-500 min-h-[2.5rem] mb-5">{plan.description}</p>

      {plan.id === 'starter' ? (
        <button
          onClick={isSubscribed ? onManageBilling : undefined}
          disabled={!isSubscribed}
          className={`w-full text-sm font-semibold rounded-xl px-4 py-2.5 ${
            isSubscribed
              ? 'bg-gray-100 text-gray-500 hover:bg-gray-200 cursor-pointer'
              : 'bg-[#6EE7B7] text-gray-900 opacity-60 cursor-default'
          }`}
        >
          {isSubscribed ? 'Downgrade' : 'Get Started Free'}
        </button>
      ) : (
        <button
          onClick={isCurrentPlan ? undefined : isSubscribed ? onManageBilling : () => onSubscribe(plan.id)}
          disabled={isCurrentPlan || isRedirecting}
          className={`w-full text-sm font-semibold rounded-xl px-4 py-2.5 transition inline-flex items-center justify-center gap-2 ${
            isCurrentPlan
              ? 'bg-[#6EE7B7] text-gray-900 cursor-default'
              : isSubscribed
              ? 'bg-gray-100 text-gray-500 hover:bg-gray-200 cursor-pointer'
              : 'bg-[#6EE7B7] text-gray-900 hover:bg-[#4ade80] cursor-pointer'
          }`}
        >
          {isRedirecting ? (
            <><Loader2 size={14} strokeWidth={1.5} className="animate-spin" /> Redirecting…</>
          ) : isCurrentPlan ? (
            'Current Plan'
          ) : isSubscribed ? (
            'Switch Plan'
          ) : (
            'Start Free Trial'
          )}
        </button>
      )}

      {/* Always reserve space for trial text to keep feature lists aligned across cards */}
      <p className={`text-xs text-gray-400 text-center mt-1.5 mb-4 ${!isCurrentPlan && plan.id !== 'starter' && !isSubscribed ? 'visible' : 'invisible'}`}>
        14-day free trial · No credit card required
      </p>

      <ul className="space-y-2.5 flex-1">
        {plan.features.map((feature) => (
          <li key={feature.label} className="flex items-start gap-2.5">
            {feature.included ? (
              <Check size={13} strokeWidth={2} className="text-green-500 shrink-0 mt-0.5" />
            ) : (
              <X size={13} strokeWidth={2} className="text-gray-300 shrink-0 mt-0.5" />
            )}
            <span className={`text-sm ${feature.included ? 'text-gray-700' : 'text-gray-400'}`}>
              {feature.label}
              {feature.soon && (
                <span className="ml-1.5 text-[10px] font-medium bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                  Soon
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function BillingSection({ status, trialEnd, subscriptionEnd, subscriptionPlan, hasStripeCustomer }: BillingSectionProps) {
  const [redirectingPlan, setRedirectingPlan] = useState<PlanId | null>(null)
  const [redirectingPortal, setRedirectingPortal] = useState(false)
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const justSubscribed = searchParams.get('checkout') === 'success'

  // Only treat as subscribed if Stripe has actually created a customer — guards against stale metadata
  const isSubscribed = hasStripeCustomer && (status === 'trialing' || status === 'active')

  const handleSubscribe = async (planId: PlanId) => {
    setRedirectingPlan(planId)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.url) {
        window.location.href = data.url
      } else {
        console.error('[checkout error]', data)
        toast('Something went wrong starting your trial. Please try again.', 'error')
        setRedirectingPlan(null)
      }
    } catch (err) {
      console.error('[checkout fetch error]', err)
      toast('Something went wrong starting your trial. Please try again.', 'error')
      setRedirectingPlan(null)
    }
  }

  const handleManageBilling = async () => {
    setRedirectingPortal(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        toast('Billing portal unavailable. Subscribe to a plan first.', 'error')
        setRedirectingPortal(false)
      }
    } catch {
      toast('Could not connect to billing. Check your connection and try again.', 'error')
      setRedirectingPortal(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      {justSubscribed && !isSubscribed && (
        <div className="flex items-center gap-3 border border-green-200 bg-green-50 rounded-xl px-4 py-3">
          <CheckCircle2 size={16} strokeWidth={1.5} className="text-green-500 shrink-0" />
          <p className="text-sm text-gray-700">
            Payment successful — your subscription is being activated. This page will update shortly.
          </p>
        </div>
      )}

      {hasStripeCustomer && status && ['trialing', 'active', 'cancelled', 'past_due'].includes(status) && (
        <StatusBanner
          status={status}
          trialEnd={trialEnd}
          subscriptionEnd={subscriptionEnd}
          subscriptionPlan={subscriptionPlan}
          onManageBilling={handleManageBilling}
          redirecting={redirectingPortal}
        />
      )}

      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-4">Plans</h3>
        <div className="flex overflow-x-auto sm:overflow-visible snap-x snap-mandatory sm:snap-none gap-4 sm:grid sm:grid-cols-3 pt-4 sm:pt-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrentPlan={
                (plan.id === 'starter' && !isSubscribed) ||
                (isSubscribed && plan.id === (subscriptionPlan ?? 'pro'))
              }
              isSubscribed={isSubscribed}
              onSubscribe={handleSubscribe}
              onManageBilling={handleManageBilling}
              redirectingPlan={redirectingPlan}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
