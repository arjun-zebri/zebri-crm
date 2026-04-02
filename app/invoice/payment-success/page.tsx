import { CheckCircle } from 'lucide-react'

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-sm w-full text-center">
        <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Payment successful</h1>
        <p className="text-sm text-gray-500">
          Thank you — your payment has been received. You&apos;ll receive a confirmation shortly.
        </p>
      </div>
    </div>
  )
}
