import { removeStep, uid, type DocKind, type Step, type Timing, type Workflow } from './model';

/**
 * Zebri building and editing workflows, faked for the preview. The real
 * version is the workflows copilot (`lib/workflows/ai-copilot/`); this
 * reads the MC's sentence clause by clause with keyword rules, so the
 * demo responds to what was typed rather than replaying one canned
 * answer. Every email it adds comes written, in the MC's voice.
 *
 * @module app/design-system/v2/pages/dashboard/workflows/zebri-build
 */

const sign = '\n\nSpeak soon,\nArjun';

/** A written email for a clause, by what the clause is about. */
function emailFor(clause: string): { subject: string; body: string } {
  const c = clause.toLowerCase();
  if (/thank|review/.test(c)) return { subject: 'Thank you both', body: `Hi {{first names}},\n\nWhat a day! Thank you for having me. If you have a minute, a review would mean the world: {{review link}}${sign}` };
  if (/again|second/.test(c) && /deposit|pay|invoice/.test(c)) return { subject: 'Your invoice is now overdue', body: `Hi {{first names}},\n\nI know life gets busy! Your invoice for {{balance}} is now a few days overdue. If anything's changed, just reply and we'll sort it out: {{invoice link}}${sign}` };
  if (/deposit|pay|invoice/.test(c)) return { subject: 'A quick reminder about your invoice', body: `Hi {{first names}},\n\nJust a friendly reminder that {{balance}} is due on {{due date}}. You can pay by card here: {{invoice link}}${sign}` };
  if (/welcome|book/.test(c)) return { subject: 'Welcome aboard!', body: `Hi {{first names}},\n\nI'm so excited to be part of {{event date}}. Your planning portal is here: {{portal link}}${sign}` };
  if (/chase|nudge|remind|follow/.test(c)) return { subject: 'Just checking in', body: `Hi {{first names}},\n\nJust checking in on this. No rush, and happy to help if anything's unclear.${sign}` };
  if (/enquir|reply|lead/.test(c)) return { subject: 'Thanks for getting in touch', body: `Hi {{first names}},\n\nThanks so much for reaching out about {{event date}}. Here's a link to grab 20 minutes with me: {{booking link}}${sign}` };
  return { subject: 'A quick note', body: `Hi {{first names}},\n\nA quick note ahead of {{event date}}.${sign}` };
}

/** "in 3 days", "2 weeks before", "the day after" as a timing. */
function timingIn(clause: string, fallback: Timing): Timing {
  const m = clause.match(/(\d+|a|one|two|three)\s+(minute|hour|day|week|month)s?\s*(before|after|later)?/i);
  if (!m) return /straight|right away|immediately|then/i.test(clause) ? { mode: 'now' } : fallback;
  const n = { a: 1, one: 1, two: 2, three: 3 }[m[1]!.toLowerCase() as 'a'] ?? Number(m[1]);
  const unit = `${m[2]!.toLowerCase()}s` as 'minutes' | 'hours' | 'days' | 'weeks' | 'months';
  const rel = m[3]?.toLowerCase();
  if ((rel === 'before' || rel === 'after') && /event|wedding|day\b/.test(clause.slice(m.index! + m[0].length)))
    return { mode: rel === 'before' ? 'before-event' : 'after-event', n, unit: unit === 'weeks' || unit === 'months' ? unit : 'days' };
  return { mode: 'after', n, unit };
}

const DOCS: [RegExp, DocKind][] = [
  [/questionnaire/, 'Questionnaire'],
  [/contract/, 'Contract'],
  [/proposal/, 'Proposal'],
  [/run ?sheet/, 'Run sheet'],
  [/invoice/, 'Invoice'],
];

/** One clause of the MC's description as a step, or null to skip it. */
function stepFor(clause: string, i: number, context = ''): Step | null {
  const c = clause.toLowerCase();
  const timing = timingIn(c, i === 0 ? { mode: 'now' } : { mode: 'after', n: 2, unit: 'days' });
  if (/^\s*if |unless|not back|hasn'?t|haven'?t/.test(c))
    return { id: uid(), kind: 'if', timing, condition: /question/.test(c) ? "the questionnaire isn't back" : /sign/.test(c) ? "the contract isn't signed" : /pay|deposit/.test(c) ? "the deposit isn't paid" : "they haven't replied", then: [/call|remind me/.test(c) ? { id: uid(), kind: 'todo', timing: { mode: 'now' }, title: 'Give them a call' } : { id: uid(), kind: 'email', timing: { mode: 'now' }, approve: false, ...emailFor(`nudge ${context}`) }] };
  if (/\bcall|meet|catch up/.test(c)) return { id: uid(), kind: 'appointment', timing, title: /plan/.test(c) ? 'Planning call' : 'Call them' };
  if (/\btodo|to-do|remind me|check /.test(c)) return { id: uid(), kind: 'todo', timing, title: clause.trim().replace(/^(and |then )/i, '').replace(/^./, (x) => x.toUpperCase()) };
  const doc = DOCS.find(([re]) => re.test(c));
  if (doc && /send|share|ask|get/.test(c) && !/chase|nudge|remind/.test(c)) return { id: uid(), kind: 'document', timing, doc: doc[1], approve: false };
  if (c.trim().length < 3) return null;
  return { id: uid(), kind: 'email', timing, approve: false, ...emailFor(`${c} ${context}`) };
}

/** Picks the trigger a description implies. */
function triggerFor(text: string): string {
  const t = text.toLowerCase();
  if (/deposit|overdue|chase .*pay/.test(t)) return 'invoice_overdue';
  if (/after the (wedding|event|day)|thank/.test(t)) return 'days_after_event';
  if (/book|accept|sign/.test(t)) return 'proposal_accepted';
  if (/consult|call booked/.test(t)) return 'consultation_booked';
  return 'new_enquiry';
}

/** A workflow built from the MC's description. Always starts Off. */
export function buildWorkflow(description: string, name?: string): Workflow {
  const clauses = description.split(/,|;|\.\s|\bthen\b|\band then\b/i).map((c) => c.trim()).filter(Boolean);
  const body = clauses.slice(/^when|^after|^once/i.test(clauses[0] ?? '') && clauses.length > 1 ? 1 : 0);
  const trigger = triggerFor(description);
  // An overdue-invoice workflow's reminders are about the money, whatever the clause says.
  const context = trigger === 'invoice_overdue' ? 'invoice' : '';
  const steps = body.map((c, i) => stepFor(c, i, context)).filter((s): s is Step => s !== null);
  return {
    id: uid('wf'),
    name: name ?? (trigger === 'invoice_overdue' ? 'Deposit chaser' : trigger === 'days_after_event' ? 'After the day' : trigger === 'proposal_accepted' ? 'Booked client' : 'New workflow'),
    on: false,
    trigger: { id: trigger, filters: [] },
    steps: steps.length ? steps : [{ id: uid(), kind: 'email', timing: { mode: 'now' }, approve: false, ...emailFor(description) }],
    clients: [],
    sentThisWeek: 0,
  };
}

/** What Zebri did to a workflow when asked, or why it did nothing. */
export interface EditResult {
  steps: Step[];
  changed: string[];
  reply: string;
}

/** Applies one plain-words instruction to a workflow's story. */
export function editWorkflow(wf: Workflow, prompt: string): EditResult {
  const p = prompt.toLowerCase();
  const emails = (steps: Step[]): Step[] => steps.flatMap((s) => (s.kind === 'email' ? [s] : s.kind === 'if' ? emails(s.then) : []));
  if (/check|approve|ask me/.test(p)) {
    const ids = emails(wf.steps).map((s) => s.id);
    const set = (steps: Step[]): Step[] => steps.map((s) => (s.kind === 'email' ? { ...s, approve: true } : s.kind === 'if' ? { ...s, then: set(s.then) } : s));
    return { steps: set(wf.steps), changed: ids, reply: `Every email now waits for your OK in Up next (${ids.length}).` };
  }
  if (/warm|friendl|short|formal|casual/.test(p)) {
    const tone = (b: string) => (/short/.test(p) ? b.split('\n\n').filter((_, i, a) => i === 0 || i === 1 || i === a.length - 1).join('\n\n') : b.replace(/^Hi \{\{first names\}\},/, /formal/.test(p) ? 'Dear {{first names}},' : 'Hi {{first names}}, I hope you\'re both well!'));
    const set = (steps: Step[]): Step[] => steps.map((s) => (s.kind === 'email' ? { ...s, body: tone(s.body) } : s.kind === 'if' ? { ...s, then: set(s.then) } : s));
    const ids = emails(wf.steps).map((s) => s.id);
    return { steps: set(wf.steps), changed: ids, reply: `Rewrote ${ids.length} emails.` };
  }
  const remove = p.match(/(?:remove|delete|drop) (?:the )?(.+)/);
  if (remove) {
    const target = emails(wf.steps).find((s) => s.kind === 'email' && s.subject.toLowerCase().includes(remove[1]!.trim()));
    if (target) return { steps: removeStep(wf.steps, target.id), changed: [], reply: 'Removed that email.' };
    return { steps: wf.steps, changed: [], reply: `I couldn't find a step matching "${remove[1]}".` };
  }
  const step = stepFor(prompt.replace(/^(add|and|also)\s+/i, ''), 1);
  if (!step) return { steps: wf.steps, changed: [], reply: 'Tell me what should happen, for example "add a nudge if the contract isn\'t signed in 3 days".' };
  return { steps: [...wf.steps, step], changed: [step.id], reply: 'Added it at the end. Change its timing if it belongs earlier.' };
}
