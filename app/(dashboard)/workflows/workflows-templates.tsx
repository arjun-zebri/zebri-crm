'use client';

/**
 * The template library: the workflows the MC has built.
 *
 * A grid of cards rather than a list. A workflow is a thing an MC owns
 * and reasons about ("is this running, and on how many couples?"), and
 * the two facts that decide whether they touch one were the hardest to
 * see in a row of columns.
 *
 * Presentational apart from the search and tag-filter state; all data
 * and mutations arrive from {@link useWorkflowLibrary} via the shell.
 *
 * @module app/(dashboard)/workflows/workflows-templates
 */

import { GitBranch } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import type { TemplateStatus } from '@/types/workflows';

import { DescribeWorkflow } from './describe-workflow';
import { NewWorkflowMenu } from './new-workflow-menu';
import { TagEditorModal } from './tag-editor-modal';
import { TemplateCard } from './template-card';
import { TemplateTagFilter } from './template-tag-filter';
import { TemplateTagsModal } from './template-tags-modal';
import type { WorkflowLibrary } from './use-workflow-library';
import { WorkflowsEmpty } from './workflows-empty';
import { TemplatesSkeleton } from './workflows-skeletons';

export interface WorkflowsTemplatesProps {
  library: WorkflowLibrary;
}

/** The Templates tab. See {@link WorkflowsTemplatesProps}. */
export function WorkflowsTemplates({ library }: WorkflowsTemplatesProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [taggingId, setTaggingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [describeOpen, setDescribeOpen] = useState(false);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return library.templates.filter((t) => {
      // Either/or on tags, not both: an MC scanning for "enquiry or
      // package" work wants the union.
      const taggedIn =
        selectedTags.length === 0 || t.tagIds.some((id) => selectedTags.includes(id));
      const matches =
        needle.length === 0 ||
        t.name.toLowerCase().includes(needle) ||
        (t.description ?? '').toLowerCase().includes(needle);
      return taggedIn && matches;
    });
  }, [library.templates, selectedTags, search]);

  const tagging = library.templates.find((t) => t.id === taggingId) ?? null;

  async function handleCreate() {
    setCreating(true);
    try {
      const id = await library.createTemplate('Untitled workflow');
      if (id) router.push(`/workflows/${id}`);
    } finally {
      setCreating(false);
    }
  }

  const filtering = search.trim().length > 0 || selectedTags.length > 0;

  // No card around the grid: the cards are the structure, and wrapping
  // them in a second bordered box put a border inside a border. Same
  // shell as the Upcoming tab -- toolbar on the page, body below it
  // taking the rest of the height -- so switching tabs does not look
  // like switching apps.
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <Input
          aria-label="Search workflows"
          placeholder="Search workflows"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          className="w-56"
        />
        <TemplateTagFilter
          tags={library.tags}
          selected={selectedTags}
          onChange={setSelectedTags}
          onManageTags={() => setTagsOpen(true)}
        />
        <NewWorkflowMenu
          busy={creating}
          onBuildMyself={() => void handleCreate()}
          onGenerate={() => setDescribeOpen(true)}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {library.isLoading ? (
          <TemplatesSkeleton />
        ) : library.error ? (
          <ErrorState
            title="Could not load your workflows"
            error={library.error}
            onRetry={library.refetch}
          />
        ) : visible.length === 0 ? (
          <WorkflowsEmpty
            icon={GitBranch}
            title={filtering ? 'Nothing matches' : 'No workflows yet'}
            description={
              filtering
                ? 'Clear the search or the tag filter to see every workflow.'
                : 'A workflow is your repeatable process: the emails, documents and to-dos you run for every couple, in order. Build one from "New workflow", or describe yours and let Zebri draft it.'
            }
            {...(filtering
              ? {
                  action: (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearch('');
                        setSelectedTags([]);
                      }}
                    >
                      Clear filters
                    </Button>
                  ),
                }
              : {})}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                tags={library.tags}
                onOpen={(id) => router.push(`/workflows/${id}`)}
                onDuplicate={(id) => void library.duplicateTemplate(id)}
                onDelete={setPendingDelete}
                onEditTags={setTaggingId}
                onSetStatus={(id, status: TemplateStatus) => void library.setStatus(id, status)}
              />
            ))}
          </div>
        )}
      </div>

      <DescribeWorkflow isOpen={describeOpen} onClose={() => setDescribeOpen(false)} />

      <TemplateTagsModal
        template={tagging}
        tags={library.tags}
        onClose={() => setTaggingId(null)}
        onSave={library.setTags}
        onManageTags={() => setTagsOpen(true)}
      />

      <TagEditorModal
        isOpen={tagsOpen}
        onClose={() => setTagsOpen(false)}
        tags={library.tags}
        onCreate={library.createTag}
        onUpdate={library.updateTag}
        onDelete={library.deleteTag}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) void library.deleteTemplate(pendingDelete);
          setPendingDelete(null);
        }}
        title="Delete this workflow?"
        description="Couples already running it keep their steps. Only the template goes."
        confirmLabel="Delete"
      />
    </div>
  );
}
