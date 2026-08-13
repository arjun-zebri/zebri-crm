# AI Copilot — 103 test prompts

Manual test corpus for the Zebri AI automations copilot (2026-08-09).
Realistic things Wedding MCs and celebrants would type into the panel.
Grouped by what they exercise; sections 11 and 12 are deliberate edge
cases (placement bugs we've hit, and requests the AI should decline
honestly rather than fake).

Tip when testing: watch the canvas after every prompt and check the
step ORDER matches what the AI claims it did.

## 1. Enquiry and lead follow-up (create from scratch)

1. When a couple enquires, send them an acknowledgement email straight away
2. When a new couple is added, wait 15 minutes then send the enquiry acknowledgement template
3. When a couple enquires, email them my pricing guide and create a task to call them tomorrow
4. New enquiry: send a welcome email, then wait 2 days, then create a follow-up task
5. When someone enquires from my website, send the enquiry acknowledgement template after 10 minutes
6. When a couple is added, wait an hour, send the welcome email, then wait 3 days and create a task to check in
7. Set up a follow-up sequence: acknowledgement email immediately, then a task to call them in 2 days
8. When a couple enquires, add a note saying "came through the website"
9. When an enquiry comes in on a weekend, still send the acknowledgement but create the call task for Monday
10. When a couple enquires and their wedding is less than 6 months away, email them straight away; otherwise wait a day

## 2. Booking and pipeline stage changes

11. When a couple moves to booked, send them a welcome email
12. When a couple books, wait 20 minutes, then send them a welcome email
13. When a couple's stage changes to confirmed, create a task to send their invoice
14. When a couple books, send the onboarding email and then send them their portal link
15. When a couple moves to paid, add a note that the deposit is in
16. When a couple books, wait a day, then send them the client portal link
17. When a stage changes to complete, create a task to ask for a review
18. When a couple becomes booked, send my welcome template and create a task to schedule the planning call
19. When a couple books, pause any other automations running for them
20. When a booking is cancelled, create a task to follow up and add a note with the date it happened

## 3. Waits and timing

21. Add a 15 minute wait between the trigger and the action
22. Add a wait of 2 days before the email goes out
23. Change the wait to 5 days
24. Make the wait 48 hours instead
25. Wait until the day before the wedding, then send the final run sheet
26. Add a wait for 1 week after the email, then create a task
27. Move the wait so it runs before the email
28. Wait until 2 weeks before the event date, then send the pre-event checklist
29. Change the first wait to only 5 minutes
30. Remove the wait entirely

## 4. Invoices and payments

31. When an invoice is sent, wait 3 days, and if it hasn't been paid create a reminder task
32. When a payment is received, send a thank-you email
33. When an invoice is overdue, email the couple a friendly nudge
34. When an invoice is due, send a payment reminder
35. When a payment comes in, add a note with a reminder to reconcile it
36. When an invoice is created, send it to the couple
37. When an invoice becomes overdue, create a task for me to chase it and add a note
38. When payment is received, wait an hour, then send the receipt acknowledgement template
39. When an invoice is overdue by a week, trigger the payment reminder
40. When a payment is received, update the couple's stage to paid

## 5. Contracts

41. When a contract is signed, send a confirmation email
42. When a contract is signed, update their stage to booked and send the welcome email
43. When a contract is sent, wait 3 days, then create a task to follow up if needed
44. When a contract is declined, create a task to call the couple
45. When a contract expires, email me a heads up via an approval step
46. When a contract is signed, wait 30 minutes, then send the invoice
47. When a contract is created, add a note with today's date
48. When a contract is signed, send the couple their portal link and create an onboarding task
49. When a contract is declined, pause their other automations
50. When a contract is sent, send the couple an email letting them know to look out for it

## 6. Wedding day timing (relative to event)

51. Two weeks before the wedding, send the pre-event checklist
52. One week before the event, send the timeline to the vendors
53. The day before the wedding, send the final run sheet
54. Three days after the wedding, send a thank-you message
55. A week after the wedding, ask them for a review
56. Two weeks after the wedding, send a referral request
57. On their first anniversary, send a congratulations email
58. A month before the wedding, create a task to confirm the running order
59. 90 days before the event, send the planning questionnaire
60. The morning after the wedding, create a task to pack down and invoice any extras

## 7. Portal, questionnaires and timeline

61. When a couple completes a questionnaire, create a task for me to review their answers
62. When a couple uploads a file to their portal, add a note so I know to look at it
63. When a couple adds a song to their playlist, create a task to review it
64. When a couple completes their vows, send them a congratulations email
65. When the timeline is edited, create a task to double-check the changes
66. When a couple finishes a portal section, send them an encouragement email
67. When a questionnaire is completed, wait a day, then email them my thoughts template
68. When a couple uploads a file, email me an approval request before I respond
69. Send the couple a questionnaire when they move to booked
70. When the timeline gets edited within 2 weeks of the wedding, create an urgent task

## 8. Tasks and contacts

71. When a task is completed, create the next one: confirm the venue details
72. When a task becomes overdue, send me an approval prompt so I decide what to do
73. When a task is created, add a note on the couple
74. When a contact is added, create a task to introduce myself
75. When a contact is linked to a couple, add a note saying who they are
76. When a vendor contact is created, send the timeline to vendors
77. When a task is overdue by 2 days, create a second reminder task
78. When an event is created, create a task to block out my calendar
79. When an event is updated, create a task to re-check my travel time
80. When an event is created, send the couple a confirmation that the date is locked in

## 9. Edit existing automations

81. Rename the email step to "Welcome email"
82. Change the email to use the enquiry acknowledgement template
83. Swap the trigger to fire when a contract is signed instead
84. Remove the second step
85. Add another email after the wait thanking them again
86. Change the task title to "Call the couple re: booking"
87. Make the wait respect quiet hours
88. Change the trigger so it only fires for couples with an event date
89. Update the email step to also go to the partner's email
90. Delete everything after the first email

## 10. Branching (if/else)

91. If the couple has signed the contract, send the planning email; otherwise send a contract reminder
92. If their wedding is less than 30 days away, create an urgent task; otherwise just add a note
93. If the deposit is paid, send the confirmation; if not, send a payment reminder
94. If the couple has an event date set, send the timeline email; otherwise ask them for their date
95. After the wait, branch: signed contract goes to onboarding, unsigned gets a nudge email

## 11. Placement traps (watch the canvas order carefully)

96. Add a 10 minute wait between the trigger and the first step
97. Add a stop step at the very start so I can turn this off quickly
98. Put a wait before the email on the yes side of the branch

## 12. Should be declined honestly (no faking)

99. Text the couple an SMS reminder the day before the wedding
100. When a couple opens my email, notify me on WhatsApp

## 13. Scope and email-content traps (regressions from live use)

101. (After building any automation in the same chat) Now create another automation that sends a thank-you email when a couple's stage changes to complete
102. Great, that's done. Next one: when a quote is sent, wait 3 days, then send a follow-up email
103. When a couple enquires send an acknowledgement email, then when a quote is sent wait 3 days and send a follow-up email

## What to check as you go

- Step order on the canvas matches the AI's claim (96–98 are the trap).
- Template references resolve by name, never a UUID question (2, 5, 38, 67, 82).
- Branch steps land on the right yes/no side (91–95, 98).
- Edits on an ACTIVE automation are refused with "pause it first" (81–90 after activating).
- 99–100 get an honest "not available yet" plus the closest alternative, not a fake step.
- Relative-to-event waits use the event date anchor (51–60).
- 101–102 must NOT touch the current automation (no trigger swap, no new steps); the AI directs the user to create a new automation from the Automations page.
- 103's follow-up email body must be a genuine follow-up (refers back to the quote), not a copy of the acknowledgement email, and the two subjects must differ.
