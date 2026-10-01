import { WEDDING, aud } from '../brand-doc-parts';

import { CLIENT, DATES, type ReplayData } from './replay-data';
import { CardTitle, Dot, Eyebrow, Reveal, Row, Strip, type Beat } from './replay-parts';

/**
 * The replay's middle moments, all in the MC's brand: the proposal
 * going out and being read, the couple choosing their package, and the
 * contract with every field filled in from the call.
 *
 * @module app/design-system/v2/pages/onboarding/replay/cards-proposal
 */

/** 4. The proposal's cover, then delivery, opens and views on its strip. */
export function ProposalCard({ on, d }: { on: Beat; d: ReplayData }) {
  const status = ['Delivered', `Opened by ${CLIENT.first}`, 'Viewed 3 times'];
  return (
    <>
      <div className="flex h-12 shrink-0 items-center px-6">
        {d.logoUrl ? (
          // An object URL from the file the MC just dropped: next/image cannot take it.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.logoUrl} alt="" className="h-6 w-auto max-w-32 object-contain" />
        ) : (
          <span className="truncate type-heading font-normal text-zebra-950 font-[family-name:var(--b-heading)]">{d.business}</span>
        )}
      </div>
      <div className="flex h-44 shrink-0 flex-col justify-end bg-[image:var(--b-deep)] px-6 pb-6 text-[var(--b-on-primary)]">
        <p className="type-eyebrow opacity-90">A proposal for</p>
        <p className="mt-1.5 truncate type-display font-normal font-[family-name:var(--b-heading)]">{WEDDING.couple}</p>
        <p className="mt-3 type-body opacity-90">
          {WEDDING.date} · {WEDDING.venue}
        </p>
      </div>
      <div className="px-6 pt-5">
        <Eyebrow>Welcome</Eyebrow>
        <p className="mt-1.5 type-heading font-normal text-zebra-950 font-[family-name:var(--b-heading)]">Your day, beautifully run</p>
      </div>
      <Strip className="flex flex-wrap gap-x-4 gap-y-1 px-6 pb-3.5">
        {status.map((s, i) => (
          <Reveal key={s} on={on(i)} className="flex items-center gap-2 whitespace-nowrap type-body text-zebra-600">
            <Dot />
            {s}
          </Reveal>
        ))}
      </Strip>
    </>
  );
}

/** 5. The couple's choice: the MC's first package picked, its terms, then accepted. */
export function AcceptCard({ on, d }: { on: Beat; d: ReplayData }) {
  const accepted = on(2);
  return (
    <>
      <Eyebrow>Choose your package</Eyebrow>
      <CardTitle className="mt-3">{WEDDING.couple}</CardTitle>
      <div className="mt-5 space-y-2.5">
        {d.choices.map((p) => {
          const picked = p === d.pkg && on(0);
          return (
            <div
              key={p.name}
              className={`flex items-center gap-3.5 rounded-panel border px-4 py-3.5 transition-[border-color,box-shadow] duration-400 motion-reduce:transition-none ${
                picked ? 'border-[var(--b-primary)] shadow-[0_0_0_3px_var(--b-soft)]' : 'border-zebra-200'
              }`}
            >
              <span
                aria-hidden="true"
                className={`size-4 shrink-0 rounded-pill border shadow-[inset_0_0_0_3px_white] transition-colors duration-400 motion-reduce:transition-none ${
                  picked ? 'border-[var(--b-primary)] bg-[var(--b-primary)]' : 'border-zebra-300 bg-field'
                }`}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate type-label text-zebra-950">{p.name}</span>
                {p.lines.length ? <span className="block truncate type-body text-zebra-500">{p.lines.join(' · ')}</span> : null}
              </span>
              <span className="type-body text-zebra-950 tabular-nums">{aud(p.price)}</span>
            </div>
          );
        })}
      </div>
      {/* The payment schedule the pick locks in, as a real proposal shows
          it: the deposit today at their percentage, the balance and when. */}
      <Reveal on={on(1)} className="mt-4 type-body">
        <p className="type-label text-zebra-950">Payment schedule</p>
        <Row label={`Deposit, ${d.depositPercent}%, today`}>
          <span className="text-zebra-950 tabular-nums">{aud(d.due)}</span>
        </Row>
        <Row label={`Balance, due ${DATES.balanceDue}`} last>
          <span className="text-zebra-950 tabular-nums">{aud(d.balance)}</span>
        </Row>
      </Reveal>
      <div
        className={`mt-auto flex h-11 items-center justify-center rounded-button type-label transition-colors duration-400 motion-reduce:transition-none ${
          accepted ? 'bg-[var(--b-primary)] text-[var(--b-on-primary)]' : 'bg-zebra-100 text-zebra-400'
        }`}
      >
        {on(3) ? 'Accepted' : 'Accept proposal'}
      </div>
    </>
  );
}

/** 6. The agreement, each value lighting up in turn as it is filled from the CRM. */
export function ContractCard({ on, d }: { on: Beat; d: ReplayData }) {
  const fields = [
    { label: 'Event', value: `Wedding, ${WEDDING.date}` },
    { label: 'Venue', value: WEDDING.venue },
    { label: 'Package', value: `${d.pkg.name}, ${aud(d.pkg.price)}` },
    { label: 'Deposit', value: `${aud(d.due)} (${d.depositPercent}%), on signing` },
  ];
  return (
    <>
      <Eyebrow>Contract</Eyebrow>
      <CardTitle className="mt-3">
        {WEDDING.couple}, and {d.business}
      </CardTitle>
      <div className="mt-5">
        {fields.map((f, i) => (
          <Row key={f.label} label={f.label} last={i === fields.length - 1}>
            <span
              className={`-mr-2 truncate rounded-check px-2 py-0.5 text-zebra-950 transition-colors duration-500 motion-reduce:transition-none ${
                on(i) ? 'bg-[var(--b-soft)]' : ''
              }`}
            >
              {f.value}
            </span>
          </Row>
        ))}
      </div>
      <Strip className="flex items-center gap-2.5 type-body text-zebra-600">
        <Dot />
        Filled from the call. Sent to {CLIENT.email}
      </Strip>
    </>
  );
}
