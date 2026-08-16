/**
 * Compose modal for the `send_email` step.
 *
 * Writing an email needs room: recipients, a template choice, a
 * subject, a rich body, the files that go with it, and the delivery
 * options. That is a document, not a row of controls squeezed into a
 * 340px canvas node, so the step card opens this and shows only a
 * summary of what is configured.
 *
 * Deliberately the same three controls as the email-template editor
 * (`templates/template-editor-modal`), reusing its `SubjectField`,
 * `RichTextEditor` and `TemplateAttachments` rather than restating
 * them: an MC writing an automation email and one writing a template
 * should not meet two different editors.
 *
 * @module app/(dashboard)/automations/[id]/email-composer-modal
 */
'use client'

import * as Popover from '@radix-ui/react-popover'
import type { JSONContent } from '@tiptap/react'
import { Check, ChevronDown, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { MenuPanel } from '@/components/ui/menu'
import { Modal } from '@/components/ui/modal'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { Select } from '@/components/ui/select'
import { EMPTY_DOC, textToDoc } from '@/lib/automations/mustache-doc'
import { EMAIL_TEMPLATE_VARIABLES } from '@/lib/email/template-variables'

import { EmailTemplatePicker } from '../../templates/email-template-picker'
import { SubjectField } from '../../templates/subject-field'
import { TemplateAttachments } from '../../templates/template-attachments'
import { useTemplates } from '../../templates/use-templates'

import { EMAIL_OPTION_CHIPS } from './action-chips'
import { TriggerFilterList, type FilterConfig } from './trigger-filter-list'

/** Empty TipTap doc — an editor needs a paragraph to put a caret in. */
const EMPTY_BODY = EMPTY_DOC as JSONContent

/** Recipient roles, in the order the picker lists them. */
const ROLES = ['primary', 'spouse', 'family', 'vendor', 'me'] as const
type Role = (typeof ROLES)[number]

const ROLE_LABELS: Record<Role, string> = {
  primary: 'Primary couple email',
  spouse: 'Spouse',
  family: 'Family contacts',
  vendor: 'Vendor contacts',
  me: 'Myself (your email)',
}

interface RecipientSpec {
  roles: Role[]
  fallback: 'primary_only' | 'skip' | 'error'
}

const DEFAULT_RECIPIENTS: RecipientSpec = { roles: ['primary'], fallback: 'primary_only' }

/**
 * The whole step config. The composer owns every field — recipients,
 * template, content, attachments, options — so the card is a summary
 * and the modal is the one place an email is configured.
 */
export type EmailDraft = Record<string, unknown>

interface Props {
  isOpen: boolean
  onClose: () => void
  /** The step's saved config. Read once per open, not live-bound. */
  config: Record<string, unknown>
  onSave: (draft: EmailDraft) => void
  /** Modal heading; the action's own name reads better than a generic one. */
  title?: string
  /**
   * Whether this action chooses its own recipients. False for the
   * pre-composed sends (thank-you, review request…), whose handlers
   * address the couple directly — offering a picker there would be a
   * control that changes nothing.
   */
  showRecipients?: boolean
  /** Whether a saved template can stand in for the inline body. */
  showTemplate?: boolean
  /** Whether the delivery-option chips apply. */
  showOptions?: boolean
}

/**
 * Read the body out of a saved config.
 *
 * `content` is the composer's TipTap doc. `body` is the plain string
 * the action stored before this modal existed; `textToDoc` lifts it,
 * turning its `{{variables}}` into the mention nodes the composer's
 * render path actually resolves — as literal text they would be
 * mailed verbatim.
 */
function initialContent(config: Record<string, unknown>): JSONContent {
  const content = config['content']
  if (content && typeof content === 'object') return content as JSONContent
  const body = typeof config['body'] === 'string' ? config['body'] : ''
  return textToDoc(body) as JSONContent
}

/**
 * Multi-select for the recipient roles.
 *
 * A dropdown rather than a grid of checkboxes: five permanently
 * visible tickboxes dominated a modal whose subject is the email, and
 * the roles are one decision, not five.
 */
function RecipientSelect({
  value,
  onChange,
}: {
  value: Role[]
  onChange: (roles: Role[]) => void
}) {
  const [open, setOpen] = useState(false)
  const summary = value.length
    ? value.map((r) => ROLE_LABELS[r]).join(', ')
    : 'Nobody selected'

  return (
    <div className="space-y-1">
      <p className="block text-body font-medium text-text">Send to</p>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-control border border-border bg-surface px-3 text-body text-text transition-colors hover:border-border-strong"
          >
            <span className="min-w-0 flex-1 truncate text-left">{summary}</span>
            <ChevronDown className="shrink-0 text-text-muted" size={16} strokeWidth={1.5} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          {/* z-[90]: the shared popover tier, above the modal panel. */}
          <Popover.Content align="start" sideOffset={6} className="z-[90]">
            <MenuPanel>
              {ROLES.map((role) => {
                const checked = value.includes(role)
                return (
                  <button
                    key={role}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={checked}
                    onClick={() => {
                      const next = checked
                        ? value.filter((r) => r !== role)
                        : [...value, role]
                      // Never empty: a send with no role silently does
                      // nothing at run time.
                      onChange(next.length ? next : ['primary'])
                    }}
                    className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-1.5 text-left text-body text-text transition-colors hover:bg-surface-emphasis"
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border ${
                        checked ? 'border-brand-fg bg-brand-fg text-text-inverse' : 'border-border'
                      }`}
                    >
                      {checked ? <Check size={11} strokeWidth={2.5} /> : null}
                    </span>
                    {ROLE_LABELS[role]}
                  </button>
                )
              })}
            </MenuPanel>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}

/** Usable addresses on a config key, ignoring half-typed entries. */
function addressList(config: Record<string, unknown>, key: string): string[] {
  const raw = config[key]
  return Array.isArray(raw)
    ? raw.filter((e): e is string => typeof e === 'string' && e.includes('@'))
    : []
}

/**
 * A CC / BCC field: a dropdown that holds typed addresses plus one
 * standing option (the couple's vendor contacts, or yourself).
 *
 * Addresses are a list rather than free text so each can be removed on
 * its own, and so a half-typed one never reaches the config the runner
 * parses — the same rule the chips follow.
 */
function AddressField({
  label,
  emails,
  onEmailsChange,
  toggle,
}: {
  label: string
  emails: string[]
  onEmailsChange: (emails: string[]) => void
  toggle: { label: string; summaryLabel: string; checked: boolean; onChange: (v: boolean) => void }
}) {
  const [open, setOpen] = useState(false)
  const [entry, setEntry] = useState('')

  const parts: string[] = []
  if (toggle.checked) parts.push(toggle.summaryLabel)
  parts.push(...emails)
  const summary = parts.length ? parts.join(', ') : 'Nobody'

  function commit(raw: string) {
    // A paste of several addresses lands as several rows.
    const added = raw
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter((e) => e.includes('@') && !emails.includes(e))
    setEntry('')
    if (added.length > 0) onEmailsChange([...emails, ...added])
  }

  return (
    <div className="space-y-1">
      <p className="block text-body font-medium text-text">{label}</p>
      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          // Closing with something typed keeps it: clicking away must
          // never silently drop an address.
          if (!next) commit(entry)
          setOpen(next)
        }}
      >
        <Popover.Trigger asChild>
          <button
            type="button"
            className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-control border border-border bg-surface px-3 text-body text-text transition-colors hover:border-border-strong"
          >
            <span
              className={`min-w-0 flex-1 truncate text-left ${
                parts.length ? '' : 'text-text-subtle'
              }`}
            >
              {summary}
            </span>
            <ChevronDown className="shrink-0 text-text-muted" size={16} strokeWidth={1.5} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          {/* z-[90]: the shared popover tier, above the modal panel. */}
          {/* No `onOpenAutoFocus` override: Radix's focus scope lands
              on the first tabbable element, which is the address
              input. Taking focus manually races the scope, and losing
              that race leaves the caret on the panel while the MC
              types into nothing. */}
          <Popover.Content align="start" sideOffset={6} className="z-[90]">
            <MenuPanel width="lg">
              {/* MenuPanel owns the panel's own `py-1`; the rows'
                  padding is theirs, so it lives on this wrapper
                  rather than as a `p-*` override that would only win
                  on the inline axis. */}
              <div className="px-3 py-1">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <input
                    type="text"
                    placeholder="name@example.com"
                    value={entry}
                    onChange={(e) => {
                      // A typed comma ends an address, the way a mail
                      // client's own To: field behaves.
                      if (e.target.value.includes(',')) commit(e.target.value)
                      else setEntry(e.target.value)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        commit(entry)
                      }
                    }}
                    // Clicking the toggle, the ✕ or anywhere outside
                    // keeps what was typed: an address that vanishes
                    // because it was never "submitted" is the bug this
                    // control is most likely to have.
                    onBlur={() => commit(entry)}
                    aria-label={`Add a ${label} address`}
                    className="min-w-0 flex-1 bg-transparent text-body text-text placeholder:text-text-subtle focus:outline-none"
                  />
                  {/* The only way to commit, so it says so — but as a
                      hint beside the caret, not a paragraph under it. */}
                  <span className="shrink-0 text-body text-text-subtle">
                    {entry.trim() ? 'Enter to add' : ''}
                  </span>
                </div>

                {emails.length > 0 && (
                  <ul className="space-y-1 py-2">
                    {emails.map((email) => (
                      <li key={email} className="flex items-center gap-2 text-body text-text">
                        <span className="min-w-0 flex-1 truncate">{email}</span>
                        <button
                          type="button"
                          onClick={() => onEmailsChange(emails.filter((e) => e !== email))}
                          aria-label={`Remove ${email}`}
                          className="cursor-pointer text-text-subtle transition-colors hover:text-danger"
                        >
                          <X size={13} strokeWidth={1.5} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <button
                  type="button"
                  role="checkbox"
                  aria-checked={toggle.checked}
                  onClick={() => toggle.onChange(!toggle.checked)}
                  className="flex w-full cursor-pointer items-center gap-2.5 py-2 text-left text-body text-text"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border ${
                      toggle.checked
                        ? 'border-brand-fg bg-brand-fg text-text-inverse'
                        : 'border-border'
                    }`}
                  >
                    {toggle.checked ? <Check size={11} strokeWidth={2.5} /> : null}
                  </span>
                  {toggle.label}
                </button>
              </div>
            </MenuPanel>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}

export function EmailComposerModal({
  isOpen,
  onClose,
  config,
  onSave,
  title = 'Compose email',
  showRecipients = true,
  showTemplate = true,
  showOptions = true,
}: Props) {
  // One draft object for the whole step, so unrelated fields (the
  // option chips especially) survive a save untouched.
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  const [content, setContent] = useState<JSONContent>(EMPTY_BODY)

  const { data: templates = [] } = useTemplates()

  // Hydrate on open, not on every config change: the card autosaves as
  // the draft changes, and re-seeding mid-edit would fight typing.
  useEffect(() => {
    if (!isOpen) return
    setDraft({ ...config })
    setContent(initialContent(config))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const patch = (fields: Record<string, unknown>) =>
    setDraft((prev) => ({ ...prev, ...fields }))

  const recipients = (draft['recipients'] as RecipientSpec | undefined) ?? DEFAULT_RECIPIENTS
  const draftTemplateId = typeof draft['templateId'] === 'string' ? draft['templateId'] : ''
  const sourceTemplateId =
    typeof draft['sourceTemplateId'] === 'string' ? draft['sourceTemplateId'] : ''
  const sourceTemplateName = templates.find((t) => t.id === sourceTemplateId)?.name
  const attachFiles = Array.isArray(draft['attachFiles'])
    ? (draft['attachFiles'] as string[])
    : []

  /**
   * Copy a saved template into the editable fields and drop the link
   * to it.
   *
   * The modal is what gets sent: showing a subject and body that the
   * runner would then ignore in favour of a linked template is the
   * kind of trap that mails the wrong email. So a template is a
   * starting point here, never a live binding — pick one, it fills the
   * fields, and edits from then on belong to this step alone.
   */
  function loadTemplate(id: string) {
    const tpl = templates.find((t) => t.id === id)
    if (!tpl) return
    setDraft((prev) => ({
      ...prev,
      templateId: undefined,
      // Display only — it names the picker's selection and nothing
      // else. The runner never reads it, so editing the body below
      // can't fall out of step with what the picker says.
      sourceTemplateId: tpl.id,
      subject: tpl.subject,
    }))
    setContent((tpl.content as JSONContent | null) ?? EMPTY_BODY)
  }

  // An automation saved before the composer may still point at a
  // template. Materialise it the first time the modal opens so the MC
  // sees the real words, then it follows the rule above.
  useEffect(() => {
    if (!isOpen || !draftTemplateId) return
    loadTemplate(draftTemplateId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, draftTemplateId, templates])

  function save() {
    onSave({
      ...draft,
      content,
      // The composer supersedes the legacy plain-text body wherever a
      // handler prefers `content`. Pre-composed sends keep theirs as
      // the schema-required default, so only clear it when the field
      // is optional (send_email).
      ...(showRecipients ? { body: undefined } : {}),
      // Cleared by loadTemplate, restated here so a save can never
      // leave a link the runner would follow instead of this body.
      templateId: undefined,
      attachFiles: attachFiles.length ? attachFiles : undefined,
    })
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </div>
      }
    >
      <div className="space-y-5">
        {showRecipients && (
          <RecipientSelect
            value={recipients.roles}
            onChange={(roles) => patch({ recipients: { ...recipients, roles } })}
          />
        )}

        {/* CC and BCC sit with the recipients, not behind an options
            menu: who else sees the email is part of addressing it. */}
        {showRecipients && (
          <div className="grid gap-4 sm:grid-cols-2">
            <AddressField
              label="CC"
              emails={addressList(draft, 'ccEmails')}
              onEmailsChange={(emails) => patch({ ccEmails: emails })}
              toggle={{
                label: "This couple's vendor contacts",
                summaryLabel: "This couple's vendors",
                checked: draft['ccVendors'] === true,
                onChange: (v) => patch({ ccVendors: v }),
              }}
            />
            <AddressField
              label="BCC"
              emails={addressList(draft, 'bccEmails')}
              onEmailsChange={(emails) => patch({ bccEmails: emails })}
              toggle={{
                label: 'Myself (your email)',
                summaryLabel: 'You',
                checked: draft['bccSelf'] === true,
                onChange: (v) => patch({ bccSelf: v }),
              }}
            />
          </div>
        )}

        {/* Two secondary choices, side by side once there is room:
            neither needs a full row of its own. */}
        <div className="grid gap-4 sm:grid-cols-2">
          {showRecipients && (
            <Select
              label="If none of those resolve"
              value={recipients.fallback}
              onValueChange={(v) =>
                patch({ recipients: { ...recipients, fallback: v as RecipientSpec['fallback'] } })
              }
              options={[
                { value: 'primary_only', label: 'Fall back to the primary couple email' },
                { value: 'skip', label: 'Skip this step silently' },
                { value: 'error', label: 'Fail the run' },
              ]}
            />
          )}
          {showTemplate && (
            <EmailTemplatePicker
              label="Start from a template"
              // Shows the template the words came from. It is a label,
              // not a binding: the fields below are what gets sent.
              value={sourceTemplateId}
              placeholder="Choose a template…"
              onChange={loadTemplate}
            />
          )}
        </div>

        {sourceTemplateName && (
          <p className="text-body text-text-muted">
            Filled in from “{sourceTemplateName}”. Editing here changes this step only, not the
            saved template.
          </p>
        )}

        <SubjectField
          value={typeof draft['subject'] === 'string' ? draft['subject'] : ''}
          onChange={(v) => patch({ subject: v })}
        />

        <div>
          <p className="mb-1 text-body font-medium text-text">Body</p>
          <RichTextEditor
            value={content}
            onChange={setContent}
            variables={EMAIL_TEMPLATE_VARIABLES}
            placeholder="Write the email the couple receives…"
          />
        </div>

        {/* templateId is null: these files belong to the automation
            step, not a template, so the ids live in the action config
            and hydrate the list through `fileIds`. */}
        <TemplateAttachments
          templateId={null}
          fileIds={attachFiles}
          emptyHint="Files attached here are sent every time this step runs."
          onPendingChange={(ids) => patch({ attachFiles: [...new Set([...attachFiles, ...ids])] })}
        />

        {showOptions && (
          <div>
            <p className="mb-1.5 text-body font-medium text-text">Options</p>
            <TriggerFilterList
              filters={EMAIL_OPTION_CHIPS}
              config={draft as FilterConfig}
              setConfig={(c) => setDraft(c as Record<string, unknown>)}
              addLabel="Add option"
            />
          </div>
        )}
      </div>
    </Modal>
  )
}
