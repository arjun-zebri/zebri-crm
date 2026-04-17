"use client";

import { useState, useEffect } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  Info,
  Lightbulb,
  XCircle,
} from "lucide-react";
import { Couple } from "./couples-types";

const SAMPLE = {
  score: 78,
  trend: 5,
  bookingProbability: 72,
  urgency: "High",
  subScores: [
    { label: "Fitness", value: 82, description: "How well this couple matches your ideal client profile across budget range, venue type, and wedding style." },
    { label: "Engagement", value: 61, description: "Measures response rate and message frequency. Low scores may indicate waning interest or competing options." },
    { label: "Intent", value: 90, description: "Signals of active decision-making, including asking specific questions, requesting contracts, or discussing dates." },
    { label: "Sentiment", value: 74, description: "Overall tone of the conversation. High scores reflect enthusiasm and positive language throughout." },
  ],
  summary:
    "Initial contact came through a referral, suggesting strong pre-existing trust in your services. Communication has been consistent and prompt throughout - all requested information was returned within 24 hours. The couple has shown genuine enthusiasm about their October date, with specific questions around the running order and ceremony music indicating they are actively planning. Budget expectations align closely with your standard package range, and there are no obvious blockers at this stage.",
  positiveSignals: [
    "Referral source with strong pre-existing trust",
    "All messages returned within 24 hours",
    "Actively planning running order and ceremony music",
    "Budget expectations match your standard package",
  ],
  riskFactors: [
    "Still comparing two venue options",
    "5 days since last message exchange",
  ],
  recommendation: {
    action: "Send a follow-up email",
    rationale:
      "Venue selection is the only open decision point. A timely check-in keeps you front of mind while they are deciding.",
    impact: "High likelihood of booking confirmation within 7 days",
  },
  activity: [
    { label: "Last contact", value: "3 days ago" },
    { label: "Messages", value: "12" },
    { label: "Avg response", value: "< 24hrs" },
    { label: "In pipeline", value: "21 days" },
  ],
};

const CIRCUMFERENCE = 2 * Math.PI * 40;

function scoreColor(v: number) {
  if (v >= 75) return { bar: "bg-emerald-500", text: "text-emerald-600" };
  if (v >= 50) return { bar: "bg-amber-400", text: "text-amber-600" };
  return { bar: "bg-red-400", text: "text-red-500" };
}

function getDescriptor(s: number) {
  if (s >= 80) return { text: "Strong prospect", color: "text-emerald-600" };
  if (s >= 65) return { text: "Warm lead", color: "text-emerald-500" };
  if (s >= 50) return { text: "Moderate interest", color: "text-amber-500" };
  return { text: "Cold lead", color: "text-red-400" };
}

interface CouplePulseProps {
  couple: Couple;
}

export function CouplePulse({ couple }: CouplePulseProps) {
  const hasEmail = !!couple.email;
  const target = CIRCUMFERENCE * (1 - SAMPLE.score / 100);
  const [offset, setOffset] = useState(CIRCUMFERENCE);
  const desc = getDescriptor(SAMPLE.score);

  useEffect(() => {
    const id = setTimeout(() => setOffset(target), 80);
    return () => clearTimeout(id);
  }, [target]);

  return (
    <div className="space-y-8">
      {/* Coming soon banner */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 ring-1 ring-gray-200">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-gray-900 text-white text-xs font-medium tracking-wide shrink-0">
          Coming soon
        </span>
        <p className="text-sm text-gray-500">
          Pulse will analyse your conversations and surface booking insights automatically.
        </p>
      </div>
    <div className="space-y-8 opacity-40 select-none pointer-events-none overflow-hidden">
      {/* Hero: score ring + metadata */}
      <div className="pb-6 border-b border-gray-100 space-y-5">
        <div className="flex items-center gap-5 sm:gap-8">
          {/* Ring */}
          <div className="relative w-28 h-28 sm:w-36 sm:h-36 shrink-0">
            <svg viewBox="0 0 96 96" className="w-28 h-28 sm:w-36 sm:h-36 -rotate-90">
              <circle cx="48" cy="48" r="40" fill="none" stroke="#f3f4f6" strokeWidth="5" />
              <circle
                cx="48" cy="48" r="40" fill="none" stroke="#10b981" strokeWidth="5"
                strokeLinecap="round" strokeDasharray={CIRCUMFERENCE} strokeDashoffset={offset}
                style={{ transition: "stroke-dashoffset 0.85s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl sm:text-4xl font-light text-gray-900 leading-none tabular-nums">{SAMPLE.score}</span>
              <span className={`text-xs font-medium mt-1.5 ${desc.color}`}>{desc.text}</span>
            </div>
          </div>

          {/* Metadata */}
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900">
              Opportunity Score
            </h3>
            <p className="text-sm text-gray-400 mt-1 mb-3">Overall assessment of booking likelihood</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ring-gray-200 text-gray-600">
                {SAMPLE.bookingProbability}% booking probability
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ring-emerald-200 text-emerald-700 bg-emerald-50">
                <ArrowUpRight size={11} strokeWidth={2} />+{SAMPLE.trend} this week
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ring-amber-200 text-amber-700 bg-amber-50">
                {SAMPLE.urgency} urgency
              </span>
            </div>
          </div>
        </div>

        {/* Score breakdown — 2 cols on mobile, 4 on sm+ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {SAMPLE.subScores.map((s) => {
            const c = scoreColor(s.value);
            return (
              <div key={s.label} className="relative ring-1 ring-gray-200 rounded-xl p-3 sm:p-4">
                <div className="absolute top-2.5 left-2.5 group">
                  <Info size={13} strokeWidth={1.75} className="text-gray-300 cursor-default" />
                  <div className="pointer-events-none absolute top-0 left-full ml-2 w-56 rounded-xl border border-black bg-white px-3 py-2.5 text-xs text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10 shadow-sm leading-relaxed">
                    {s.description}
                  </div>
                </div>
                <div className="pt-4 flex items-end justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">{s.label}</span>
                  <span className={`text-xl sm:text-2xl font-light tabular-nums leading-none ${c.text}`}>{s.value}</span>
                </div>
                <div className="h-1 rounded-full bg-gray-100">
                  <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${s.value}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary + Intelligence | Recommended Action */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-10 items-start">
        <div className="space-y-8">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 mb-4">Conversation Summary</h3>
            <p className="text-sm text-gray-700 leading-relaxed">{SAMPLE.summary}</p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 mb-4">Key Intelligence</h3>
            <div className="space-y-2.5">
              {SAMPLE.positiveSignals.map((s) => (
                <div key={s} className="flex items-start gap-2.5">
                  <CheckCircle2 size={14} strokeWidth={1.5} className="mt-0.5 text-emerald-500 shrink-0" />
                  <p className="text-sm text-gray-700">{s}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 mb-4">Risk factors</h3>
            <div className="space-y-2.5">
              {SAMPLE.riskFactors.map((s) => (
                <div key={s} className="flex items-start gap-2.5">
                  <XCircle size={14} strokeWidth={1.5} className="mt-0.5 text-red-400 shrink-0" />
                  <p className="text-sm text-gray-700">{s}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recommended Action */}
        <div className="ring-1 ring-gray-200 rounded-2xl p-5">
          <span className="inline-block px-2 py-0.5 bg-gray-900 text-white text-xs font-medium rounded-full mb-3">Recommended</span>
          <h4 className="text-sm font-semibold text-gray-900 mb-1.5 flex items-center gap-2">
            <Lightbulb size={14} strokeWidth={1.5} />
            {SAMPLE.recommendation.action}
          </h4>
          <p className="text-sm text-gray-500 leading-relaxed mb-3">{SAMPLE.recommendation.rationale}</p>
          <div className="bg-emerald-50 ring-1 ring-emerald-100 rounded-xl px-3 py-2 mb-4">
            <p className="text-xs text-emerald-700 flex items-center gap-1.5">
              <ArrowUpRight size={12} strokeWidth={2} />
              {SAMPLE.recommendation.impact}
            </p>
          </div>
          <a
            href={hasEmail ? `mailto:${couple.email}` : undefined}
            onClick={!hasEmail ? (e) => e.preventDefault() : undefined}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition ${
              hasEmail ? "bg-black text-white hover:bg-gray-800 cursor-pointer" : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            {SAMPLE.recommendation.action}
            {hasEmail && <ArrowUpRight size={13} strokeWidth={2} />}
          </a>
        </div>
      </div>

      {/* Activity signals — 2 cols on mobile, 4 on sm+ */}
      <div className="border-t border-gray-100 pt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
        {SAMPLE.activity.map((a) => (
          <div key={a.label}>
            <p className="text-xl font-light text-gray-900 tabular-nums leading-none">{a.value}</p>
            <p className="text-xs text-gray-400 mt-1.5 leading-none">{a.label}</p>
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}
