-- Seed a production-grade "Wedding MC Service Agreement" template for every user.
-- Structured to resemble a professionally-drafted Australian service agreement.
-- This is scaffolding, not legal advice — MCs should have a lawyer in their
-- jurisdiction review once before using in paid engagements.

create or replace function seed_default_contract_template(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only seed when the user has no contract templates yet
  if not exists (select 1 from contract_templates where user_id = p_user_id) then
    insert into contract_templates (user_id, name, description, content, is_default, position)
    values (
      p_user_id,
      'Wedding MC Service Agreement',
      'Professional service agreement drafted for Australian wedding MCs',
      $template${
        "type": "doc",
        "content": [
          { "type": "heading", "attrs": { "level": 1 }, "content": [{ "type": "text", "text": "Wedding MC Service Agreement" }] },

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "Parties" }] },
          { "type": "paragraph", "content": [
            { "type": "text", "text": "This agreement is made on " },
            { "type": "mention", "attrs": { "id": "today" } },
            { "type": "text", "text": " between " },
            { "type": "mention", "attrs": { "id": "mc_business_name" } },
            { "type": "text", "marks": [{ "type": "italic" }], "text": " (the MC) " },
            { "type": "text", "text": "and " },
            { "type": "mention", "attrs": { "id": "couple_name" } },
            { "type": "text", "marks": [{ "type": "italic" }], "text": " (the Couple)" },
            { "type": "text", "text": ". Each a " },
            { "type": "text", "marks": [{ "type": "italic" }], "text": "Party" },
            { "type": "text", "text": " and together, the " },
            { "type": "text", "marks": [{ "type": "italic" }], "text": "Parties" },
            { "type": "text", "text": "." }
          ]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "1. Definitions and interpretation" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "In this agreement:" }] },
          { "type": "bulletList", "content": [
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [
              { "type": "text", "marks": [{ "type": "bold" }], "text": "Event " },
              { "type": "text", "text": "means the wedding reception described in clause 2." }
            ]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [
              { "type": "text", "marks": [{ "type": "bold" }], "text": "Services " },
              { "type": "text", "text": "means the wedding MC services described in clause 3." }
            ]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [
              { "type": "text", "marks": [{ "type": "bold" }], "text": "Fee " },
              { "type": "text", "text": "means the total amount payable under clause 4." }
            ]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [
              { "type": "text", "marks": [{ "type": "bold" }], "text": "Business Day " },
              { "type": "text", "text": "means a day other than a Saturday, Sunday or public holiday in the state in which the MC is registered." }
            ]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [
              { "type": "text", "marks": [{ "type": "bold" }], "text": "GST " },
              { "type": "text", "text": "has the meaning given in the A New Tax System (Goods and Services Tax) Act 1999 (Cth)." }
            ]}]}
          ]},
          { "type": "paragraph", "content": [{ "type": "text", "text": "Headings are for convenience only and do not affect interpretation. References to dollar amounts are in Australian Dollars. Words importing the singular include the plural and vice versa." }]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "2. Event details" }] },
          { "type": "paragraph", "content": [
            { "type": "text", "text": "Event date: " },
            { "type": "mention", "attrs": { "id": "event_date" } }
          ]},
          { "type": "paragraph", "content": [
            { "type": "text", "text": "Venue: " },
            { "type": "mention", "attrs": { "id": "venue" } }
          ]},
          { "type": "paragraph", "content": [{ "type": "text", "text": "Final call times, set-up time and run sheet will be confirmed in writing by the MC no later than 14 days before the Event." }]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "3. Services" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "The MC agrees to provide the following Services at the Event:" }]},
          { "type": "orderedList", "content": [
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Reception hosting, emceeing and formal announcements, including introduction of the bridal party, speeches, cake cutting, first dance and any other items agreed in the run sheet." }]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Pre-event planning consultation(s) and preparation of a detailed run sheet in consultation with the Couple." }]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "On-the-night coordination with the venue, photographer, DJ or band and other suppliers, as needed to deliver a smooth flow of formalities." }]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Guest engagement, crowd energy management and smooth handling of unexpected changes on the night." }]}]}
          ]},
          { "type": "paragraph", "content": [{ "type": "text", "text": "The Services commence at the agreed call time and conclude at the end of the formalities as specified in the run sheet, or as otherwise agreed in writing." }]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "4. Fees, deposit and payment" }] },
          { "type": "orderedList", "content": [
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [
              { "type": "text", "text": "The Fee for the Services is " },
              { "type": "mention", "attrs": { "id": "total_amount" } },
              { "type": "text", "text": ". All amounts are inclusive of GST unless otherwise stated on the accompanying quote." }
            ]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [
              { "type": "text", "text": "A non-refundable deposit of " },
              { "type": "mention", "attrs": { "id": "deposit_amount" } },
              { "type": "text", "text": " is payable within 7 days of signing this agreement. The Couple's booking is not secured until the deposit is received by the MC in cleared funds." }
            ]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "The balance of the Fee is payable no later than 14 days before the Event. Payment is to be made via bank transfer to the account details provided on the MC's invoice." }]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "If the balance is not paid by the due date, the MC may, at its discretion, suspend or terminate the Services and the Couple will remain liable for the full Fee. Amounts overdue by more than 14 days accrue interest at 2% per month (or part thereof) on the outstanding balance." }]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Any additional services requested outside the scope of this agreement (including overtime beyond the agreed end time, ceremony hosting or travel outside the metropolitan area of the venue) will be charged at the MC's standard rates and agreed in writing before being performed." }]}]}
          ]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "5. Cancellation by the Couple" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "The deposit is non-refundable under all circumstances. If the Couple cancels the Event:" }]},
          { "type": "bulletList", "content": [
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "60 or more days before the Event — no further amount is owed beyond the deposit." }]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "31 to 59 days before the Event — 50% of the remaining balance becomes immediately payable." }]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "30 days or less before the Event — the full remaining balance becomes immediately payable." }]}]}
          ]},
          { "type": "paragraph", "content": [{ "type": "text", "text": "Cancellation must be notified in writing to the MC. Cancellation amounts reflect the MC's reasonable estimate of loss arising from the late cancellation, including loss of opportunity to book alternative work." }]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "6. Cancellation or non-performance by the MC" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "If the MC is unable to perform the Services due to circumstances within the MC's reasonable control, the MC will:" }]},
          { "type": "orderedList", "content": [
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Notify the Couple in writing as soon as reasonably practicable; and" }]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Use reasonable endeavours to arrange a suitably qualified substitute MC acceptable to the Couple, or refund all amounts paid to the MC under this agreement, including the deposit." }]}]}
          ]},
          { "type": "paragraph", "content": [{ "type": "text", "text": "The Couple acknowledges that the MC's maximum liability in these circumstances is limited as set out in clause 14." }]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "7. Rescheduling" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "Rescheduling of the Event is subject to the MC's availability on the new proposed date. If the MC is available, the Fee and deposit carry forward to the new date. A rescheduling administration fee of $100 applies where the request is made within 30 days of the original Event date. If the MC is not available on the new date, the provisions of clause 5 apply as though the Event had been cancelled." }]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "8. Force majeure" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "Neither Party is liable for failure or delay in performing its obligations where that failure is caused by circumstances beyond its reasonable control, including (without limitation) natural disaster, serious illness or injury, pandemic, government-mandated restrictions, venue closure or public transport failure. In such circumstances the Parties agree to work in good faith to reschedule the Event. If rescheduling is not possible, amounts paid beyond the deposit will be refunded, and the deposit will be retained by the MC to cover work already performed up to the date of the force majeure event." }]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "9. MC obligations and conduct" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "The MC will:" }]},
          { "type": "bulletList", "content": [
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Perform the Services with due care, skill and in a professional manner." }]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Arrive at the venue at the agreed call time, appropriately attired, and remain on-site for the duration of the agreed formalities." }]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Refrain from consuming alcohol or non-prescription substances that would impair performance while on duty." }]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Comply with all reasonable directions of the venue relating to safety and conduct on site." }]}]}
          ]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "10. Couple obligations" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "The Couple will:" }]},
          { "type": "bulletList", "content": [
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Provide the MC with accurate and timely information required to prepare the run sheet, including names, phonetic pronunciations, song titles and any sensitivities to be avoided." }]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Ensure the venue provides safe access, adequate sound equipment, a suitable microphone input channel and mains power, or arrange alternative equipment through the MC at additional cost." }]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Provide a hot meal and access to non-alcoholic refreshments for the MC where the Services exceed 4 hours on-site." }]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Pay the Fee and any approved additional charges by the due dates specified in clause 4." }]}]}
          ]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "11. Equipment and technical requirements" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "The MC will supply a personal handheld microphone, in-ear monitor and basic audio feed cabling as reasonably required to deliver the Services. The Couple and venue are responsible for providing a compatible PA system, microphone input channel(s), mixing desk and adequate mains power. The MC is not liable for technical failures attributable to venue-supplied equipment, third-party audio systems or external contractors." }]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "12. Substitute MC" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "Where the MC is genuinely unable to attend due to illness, injury or other unavoidable circumstances, the MC may engage a suitably experienced substitute MC to perform the Services. The MC will notify the Couple of the substitute as soon as reasonably practicable. The MC remains responsible for the Fee arrangement and for ensuring the substitute is properly briefed with the Couple's run sheet and information." }]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "13. Insurance" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "The MC confirms that it holds current public liability insurance appropriate to the delivery of the Services. A certificate of currency is available on request. The Couple acknowledges that the MC does not insure the Couple or guests against personal loss, injury or damage occurring at the venue." }]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "14. Limitation of liability" }] },
          { "type": "orderedList", "content": [
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Subject to clause 15 (Consumer guarantees), the MC's total aggregate liability to the Couple under or in connection with this agreement is limited to the total Fee actually paid by the Couple to the MC." }]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "To the maximum extent permitted by law, the MC is not liable for any indirect, consequential, special or incidental loss or damage, including loss of profit, loss of enjoyment or loss of opportunity." }]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "The Couple indemnifies the MC against any claim, loss or damage arising from inaccurate or misleading information supplied by the Couple and used in good faith by the MC in performance of the Services." }]}]}
          ]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "15. Consumer guarantees" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "Nothing in this agreement excludes, restricts or modifies any right, guarantee, warranty or remedy conferred on the Couple by the Australian Consumer Law (Schedule 2 of the Competition and Consumer Act 2010 (Cth)) or any other law where to do so would be unlawful. Where the MC is entitled to limit liability for breach of a consumer guarantee, its liability is limited (at the MC's option) to re-supplying the Services or refunding the Fee paid for the Services." }]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "16. Creative control" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "The MC retains creative control over delivery, phrasing, tone, humour and timing while working from the agreed run sheet. The Couple acknowledges that the MC may use reasonable judgement on the night to adapt to unexpected changes. Content that is offensive, discriminatory, defamatory or otherwise inappropriate may be declined at the MC's reasonable discretion, notwithstanding any prior request by the Couple." }]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "17. Intellectual property" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "All scripts, run sheets, written material and creative work produced by the MC in connection with the Services remain the intellectual property of the MC. The Couple is granted a non-exclusive, non-transferable licence to use such materials solely for the purposes of the Event. Materials supplied by the Couple (including photographs and personal information) remain the property of the Couple." }]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "18. Privacy and confidentiality" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "The MC will handle personal information supplied by the Couple in accordance with the Privacy Act 1988 (Cth) and solely for the purposes of delivering the Services. The MC will not disclose personal information to third parties without the Couple's prior written consent, except where required by law or where disclosure is necessary to deliver the Services (for example, to the venue or other suppliers)." }]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "19. Photography and promotional use" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "The Couple consents to the MC referring to the Event in non-identifiable form in marketing materials, portfolio listings and testimonials (for example, referring to the season and venue in general terms). The MC will not publish identifiable photographs or footage of the Couple or guests without the Couple's prior written consent. The Couple may withdraw consent by written notice to the MC at any time." }]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "20. Notices" }] },
          { "type": "paragraph", "content": [
            { "type": "text", "text": "Any notice under this agreement must be in writing and sent to the Couple at " },
            { "type": "mention", "attrs": { "id": "couple_email" } },
            { "type": "text", "text": " or to the MC at the email address shown on the MC's invoice. A notice sent by email is taken to be received on the next Business Day after sending, unless the sender receives a delivery failure notification." }
          ]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "21. Dispute resolution" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "The Parties must first attempt to resolve any dispute arising out of or in connection with this agreement through good-faith discussion. If the dispute is not resolved within 14 days, either Party may refer the dispute to mediation through a mediator agreed between the Parties, or, failing agreement, a mediator nominated by the Resolution Institute. Each Party bears its own costs of mediation and shares the mediator's fees equally. Nothing in this clause prevents a Party from seeking urgent interlocutory relief." }]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "22. Governing law and jurisdiction" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "This agreement is governed by the laws of the State of Victoria, Australia. Each Party irrevocably submits to the exclusive jurisdiction of the courts of that State and courts of appeal from them." }]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "23. General" }] },
          { "type": "orderedList", "content": [
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [
              { "type": "text", "marks": [{ "type": "bold" }], "text": "Entire agreement. " },
              { "type": "text", "text": "This agreement constitutes the entire agreement between the Parties and supersedes all prior discussions, negotiations and representations. Any variation must be agreed in writing signed by both Parties." }
            ]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [
              { "type": "text", "marks": [{ "type": "bold" }], "text": "Assignment. " },
              { "type": "text", "text": "The Couple may not assign its rights under this agreement without the MC's prior written consent. Subject to clause 12, the MC may not subcontract its obligations without the Couple's consent, not to be unreasonably withheld." }
            ]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [
              { "type": "text", "marks": [{ "type": "bold" }], "text": "Severability. " },
              { "type": "text", "text": "If any provision of this agreement is held to be invalid or unenforceable, the remainder of the agreement continues in full force and effect." }
            ]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [
              { "type": "text", "marks": [{ "type": "bold" }], "text": "Waiver. " },
              { "type": "text", "text": "No failure or delay by a Party in exercising any right under this agreement operates as a waiver of that right. A waiver is only effective if given in writing." }
            ]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [
              { "type": "text", "marks": [{ "type": "bold" }], "text": "Counterparts and electronic signatures. " },
              { "type": "text", "text": "This agreement may be executed in counterparts and by typed-name electronic signature. The Parties acknowledge that a typed name, in combination with positive assent (such as ticking an acceptance box), constitutes a valid electronic signature under the Electronic Transactions Act 1999 (Cth) and applicable state legislation." }
            ]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [
              { "type": "text", "marks": [{ "type": "bold" }], "text": "Relationship. " },
              { "type": "text", "text": "The MC is engaged as an independent contractor. Nothing in this agreement creates an employment, partnership, joint venture or agency relationship between the Parties." }
            ]}]}
          ]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "24. Acknowledgement and acceptance" }] },
          { "type": "paragraph", "content": [
            { "type": "text", "text": "By signing below, " },
            { "type": "mention", "attrs": { "id": "couple_name" } },
            { "type": "text", "text": " confirms that they have read this agreement in full, have had the opportunity to seek independent legal advice, and agree to be legally bound by its terms." }
          ]}
        ]
      }$template$::jsonb,
      true,
      0
    );
  end if;
end;
$$;

-- Trigger function — called after every new user signup
create or replace function trigger_seed_contract_template()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform seed_default_contract_template(new.id);
  return new;
end;
$$;

drop trigger if exists on_new_user_seed_contract_template on auth.users;
create trigger on_new_user_seed_contract_template
  after insert on auth.users
  for each row execute function trigger_seed_contract_template();

-- Backfill: seed for all existing users who have no templates yet
do $$
declare
  r record;
begin
  for r in select id from auth.users loop
    perform seed_default_contract_template(r.id);
  end loop;
end;
$$;
