# Verified user journeys

All journeys begin by opening Steward and signing into a workspace. New accounts begin empty. Changes belong to the authenticated account and persist on the server.

## Capture and complete a reminder

1. Open Today and enter a title in the quick capture field.
2. Select Add. The server validates the record and saves it in the encrypted database.
3. Open Plan → Reminders. The same item appears; reloading retains it.
4. Select its completion checkbox. The saved status changes across views.
5. Switch the filter to Completed and select the checkbox again to reopen it.

For a deadline, priority, duration, or notes, select the reminder row to edit. A stale revision fails with a refresh message instead of overwriting someone else's newer edit.

## Recover overdue reminders

1. Create reminders with past deadlines, or wait for saved deadlines to pass.
2. Open Today → Needs your attention.
3. Select individual items or all overdue reminders.
4. Complete them together or move them to tomorrow at 6pm in the selected timezone.
5. The batch is atomic: if any selected item changed, none of the batch is applied. Refresh and review before trying again.

## Create or move an event and detect conflicts

1. Open Plan → Calendar → Add event.
2. Enter a title, start/end local times, optional location, and a travel buffer.
3. Save. Invalid intervals, nonexistent daylight-saving times, and repeated ambiguous hours are rejected while preserving input.
4. Navigate to the event's date. Select its row to change the schedule.
5. Create a second overlapping event, or increase its travel buffer. A conflict appears in Plan and Today.
6. Select the conflict to edit the affected event. Saving a non-overlapping interval removes the conflict.
7. To cancel a local event, use Delete and confirm. External provider calendars are not changed.

## Prepare and approve an assistant change

1. Open Ask and send “Remind me to call Grandma tomorrow”.
2. The local parser resolves tomorrow in the user's timezone and prepares a 6pm deadline.
3. A persistent proposal appears in the review queue. No reminder exists yet in approval mode.
4. Inspect the exact title, deadline, and timezone. Select Approve change.
5. Application code checks the current permission mode, validates the tool input, executes the mutation transactionally, validates the output, and records a completed result.
6. Open Plan → Reminders to inspect the real saved record. Approval of the same action again returns its existing result and does not duplicate it.

Observe mode permits summaries/searches but prevents proposals. Suggest mode permits proposals but prevents execution. Limited autopilot preapproves only reminder creation and completion; event changes and reminder rescheduling still require approval. Payments, sending messages, provider bookings, and device commands have no executable tools.

If a proposed record changes before approval, execution fails and is recorded as failed. It is not automatically retried. Prepare a new proposal using the current record instead.

## Search saved information

1. Select Find anything or press Command/Ctrl+K.
2. Search a saved record's title.
3. Select a result to open its editor. Saved provider searches have an editable handoff record, never a confirmation state.
4. Alternatively, send “Search contacts: Jordan” or another supported search in Ask. A read tool returns only records owned by the account and records its verified result in action history.

## Research a reservation or trip

1. Open Discover and choose Dining, Flights, Stays, Getting around, or Experiences.
2. Enter a destination or place, then prepare a provider search.
3. Inspect the explicit provider-handoff state. Prices and availability are not represented as live.
4. Open the provider in a separate tab to search and complete any checkout there.
5. Optionally save the research link to return to it later. Its status remains unverified provider handoff.
6. Create a Trip in Plan and manually add actual events after obtaining provider confirmations.

Steward cannot verify or submit these bookings. No confirmation identifier, cancellation success, or purchased itinerary is fabricated.

## Track a relationship

1. Open Life → People → Add person.
2. Enter a name and optionally authorized contact details, a birthday, group, or relationship notes.
3. Save and search the contact by title. Birthdays are shown from the explicitly entered date.
4. Select Draft follow-up reminder. Edit and save the prefilled reminder; it links to the same person ID.
5. After actual outreach, select Mark contact today. This is manual self-reported contact, not inferred communication history.
6. A birthday matching today appears in Today's attention inbox.

Steward never sends a message or invents a relationship fact. Remove linked reminders before deleting a person to prevent dangling relationships.

## Track bills, document dates, and wellness

- Life → Money: add an amount, currency, and due date. Totals remain separated by currency. Mark paid only after paying through an actual payment service. The app only records the status. Bills due today appear in Today.
- Life → Documents: save metadata and an expiration date. There is no upload or encrypted file vault. Do not enter sensitive document contents or identifier numbers.
- Life → Health & wellness: enter a manual measurement, unit, timestamp, or symptom note. Same-unit sleep measurements can be compared to the previous manual entry. Wearable metrics and medical diagnoses are unavailable.

Each item can be edited or deleted through the same persistent record workflow.

## Manage memory and routines

1. Open Life → Assistant memory and enter an explicit preference.
2. Edit, pause, or delete any preference. Disable memory globally to retain records while excluding them from AI context.
3. Open Life → Routines and enter a time, duration, and weekdays. Enabled blocks appear on Today on the selected weekdays, using the user's timezone.
4. Pause a routine to remove its daily timeline block.

Routines do not currently create provider events, push notifications, or background jobs.

## Inspect an automation without side effects

1. Open Life → Automations → Add automation.
2. Choose a trigger and suggested action, then save.
3. Select Dry run. It reads saved data, returns a suggestion, and records the result in the assistant conversation.
4. Review the result, pause the automation, edit it, or delete it.

There is no unattended scheduler in this version. Dry runs execute no mutations or external actions.

## Export or delete the workspace

1. Open Life → Preferences & privacy.
2. Export workspace to download the decrypted JSON representation of settings, records, messages, and action history.
3. To remove the account, select Delete account, confirm with the password, and submit.
4. Database foreign-key cascades remove active records, messages, action history, and sessions; the app returns to sign-in.

Exports and backups are outside this deletion operation. Physical erasure of SQLite pages and backup copies is not guaranteed.
