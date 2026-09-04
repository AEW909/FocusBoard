"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  addFocusBoardSectionAction,
  addFocusBoardMetricAction,
  deleteFocusBoardMetricAction,
  deleteFocusBoardTaskAction,
  reorderFocusBoardSectionsAction,
  reorderFocusBoardTasksAction,
  toggleFocusBoardSectionVisibilityAction,
  toggleFocusBoardMetricVisibilityAction,
  toggleFocusBoardTaskVisibilityAction,
  updateFocusBoardSectionAction,
  updateFocusBoardMetricAction,
  updateFocusBoardTaskAction,
} from "@/app/focus-control/actions";
import { FocusDeleteButton } from "@/components/focus/focus-delete-button";
import { FocusImageSelect } from "@/components/focus/focus-image-select";
import type { FocusAssetOption } from "@/lib/focus-board/assets";
import {
  DEFAULT_FOCUS_CHECKBOX_OPTIONS,
  normaliseFocusCheckboxOptions,
  type FocusBoardSection,
  type FocusBoardTask,
  type FocusCheckboxOption,
  type FocusMetricKind,
} from "@/lib/focus-board/config";

type FocusControlExistingGoalsProps = {
  adminSlug: string;
  assets: FocusAssetOption[];
  sections: FocusBoardSection[];
  tasks: FocusBoardTask[];
};

type SectionDraft = {
  title: string;
  description: string;
};

type TaskDraft = {
  sectionId: string;
  title: string;
  icon: string;
  description: string;
  stickerSrc: string;
  stickerAlt: string;
  isBoosted: string;
};

type MetricDraft = {
  label: string;
  target: string;
  points: string;
  kind: FocusMetricKind;
  checkboxOptions: FocusCheckboxOption[];
};

function useUnsavedChangesWarning(hasUnsavedChanges: boolean) {
  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const warning = "You have unsaved focus-board changes. Leave without saving?";

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = warning;
    };

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[href]");
      if (!anchor) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) {
        return;
      }

      if (!window.confirm(warning)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [hasUnsavedChanges]);
}

function metricToDraft(metric: FocusBoardTask["metrics"][number]): MetricDraft {
  return {
    label: metric.label,
    target: String(metric.target),
    points: String(metric.points),
    kind: metric.kind,
    checkboxOptions:
      metric.kind === "checkbox" && metric.checkboxOptions?.length
        ? metric.checkboxOptions
        : DEFAULT_FOCUS_CHECKBOX_OPTIONS,
  };
}

function taskToDraft(task: FocusBoardTask): TaskDraft {
  return {
    sectionId: task.sectionId ?? "",
    title: task.title,
    icon: task.icon,
    description: task.description,
    stickerSrc: task.stickerSrc,
    stickerAlt: task.stickerAlt,
    isBoosted: task.isBoosted ? "true" : "false",
  };
}

function sectionToDraft(section: FocusBoardSection): SectionDraft {
  return {
    title: section.title,
    description: section.description,
  };
}

function draftsMatch<T>(left: T, right: T) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function getPreparedCheckboxOptions(options: FocusCheckboxOption[]) {
  const prepared = normaliseFocusCheckboxOptions(options);
  return prepared.length > 0 ? prepared : DEFAULT_FOCUS_CHECKBOX_OPTIONS;
}

function updateCheckboxOptionLabel(
  options: FocusCheckboxOption[],
  optionKey: string,
  label: string,
) {
  return options.map((option) => (option.key === optionKey ? { ...option, label } : option));
}

function addCheckboxOption(options: FocusCheckboxOption[]) {
  let nextNumber = options.length + 1;
  while (options.some((option) => option.key === `box_${nextNumber}`)) {
    nextNumber += 1;
  }

  return [
    ...options,
    {
      key: `box_${nextNumber}`,
      label: `BOX ${nextNumber}`,
    },
  ];
}

function removeCheckboxOption(options: FocusCheckboxOption[], optionKey: string) {
  return options.filter((option) => option.key !== optionKey);
}

type FocusCheckboxOptionsEditorProps = {
  options: FocusCheckboxOption[];
  onChange: (options: FocusCheckboxOption[]) => void;
};

function FocusCheckboxOptionsEditor({ options, onChange }: FocusCheckboxOptionsEditorProps) {
  return (
    <div className="focus-checkbox-options-editor">
      <div className="focus-checkbox-options-head">
        <span>Checkbox labels</span>
        <button
          className="button button-secondary button-small"
          onClick={() => onChange(addCheckboxOption(options))}
          type="button"
        >
          Add checkbox
        </button>
      </div>
      <div className="focus-checkbox-options-list">
        {options.map((option, index) => (
          <div className="focus-checkbox-option-row" key={option.key}>
            <label className="field">
              <span>Box {index + 1}</span>
              <input
                onChange={(event) => onChange(updateCheckboxOptionLabel(options, option.key, event.target.value))}
                value={option.label}
              />
            </label>
            <button
              aria-label={`Remove checkbox ${option.label}`}
              className="focus-delete-icon"
              disabled={options.length <= 1}
              onClick={() => onChange(removeCheckboxOption(options, option.key))}
              type="button"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FocusControlExistingGoals({ adminSlug, assets, sections, tasks }: FocusControlExistingGoalsProps) {
  const [dirtyKeys, setDirtyKeys] = useState<Record<string, boolean>>({});
  const router = useRouter();
  const activeSections = useMemo(
    () => sections.filter((section) => section.isActive !== false),
    [sections],
  );
  const visibleSections = useMemo(
    () => activeSections.filter((section) => section.isVisible !== false),
    [activeSections],
  );
  const hiddenSections = useMemo(
    () => activeSections.filter((section) => section.isVisible === false),
    [activeSections],
  );
  const [orderedSections, setOrderedSections] = useState(visibleSections);
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionDescription, setNewSectionDescription] = useState("");
  const [isAddingSection, startAddSectionTransition] = useTransition();
  const [isReorderingSections, startReorderSectionsTransition] = useTransition();
  const [activeSectionId, setActiveSectionId] = useState<string | null>(
    () => visibleSections[0]?.id ?? null,
  );

  const hasUnsavedChanges = useMemo(
    () => Object.values(dirtyKeys).some(Boolean),
    [dirtyKeys],
  );

  useUnsavedChangesWarning(hasUnsavedChanges);

  useEffect(() => {
    setOrderedSections(visibleSections);
  }, [visibleSections]);

  useEffect(() => {
    if (activeSectionId && !orderedSections.find((s) => s.id === activeSectionId)) {
      setActiveSectionId(orderedSections[0]?.id ?? null);
    }
  }, [orderedSections, activeSectionId]);

  const activeSectionObj = orderedSections.find((s) => s.id === activeSectionId) ?? orderedSections[0] ?? null;

  const setDirtyState = (key: string, dirty: boolean) => {
    setDirtyKeys((current) => {
      if (dirty === Boolean(current[key])) {
        return current;
      }

      if (!dirty) {
        const next = { ...current };
        delete next[key];
        return next;
      }

      return {
        ...current,
        [key]: true,
      };
    });
  };

  const persistSectionOrder = (nextSections: FocusBoardSection[]) => {
    setOrderedSections(nextSections);
    setOrderError(null);
    startReorderSectionsTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("adminSlug", adminSlug);
        nextSections.forEach((section) => {
          if (section.id) {
            formData.append("sectionIds", section.id);
          }
        });

        await reorderFocusBoardSectionsAction(formData);
      } catch (error) {
        setOrderError(error instanceof Error ? error.message : "Could not save the section order.");
        setOrderedSections(visibleSections);
      }
    });
  };

  const moveSection = (sectionId: string | undefined, direction: -1 | 1) => {
    if (!sectionId || isReorderingSections || hasUnsavedChanges) {
      return;
    }

    const currentIndex = orderedSections.findIndex((section) => section.id === sectionId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= orderedSections.length) {
      return;
    }

    const nextSections = [...orderedSections];
    const [section] = nextSections.splice(currentIndex, 1);
    nextSections.splice(nextIndex, 0, section);
    persistSectionOrder(nextSections);
  };

  const dropSection = (targetSectionId: string | undefined) => {
    if (!draggedSectionId || !targetSectionId || draggedSectionId === targetSectionId || hasUnsavedChanges) {
      setDraggedSectionId(null);
      return;
    }

    const fromIndex = orderedSections.findIndex((section) => section.id === draggedSectionId);
    const toIndex = orderedSections.findIndex((section) => section.id === targetSectionId);
    if (fromIndex < 0 || toIndex < 0) {
      setDraggedSectionId(null);
      return;
    }

    const nextSections = [...orderedSections];
    const [section] = nextSections.splice(fromIndex, 1);
    nextSections.splice(toIndex, 0, section);
    setDraggedSectionId(null);
    persistSectionOrder(nextSections);
  };

  const addSection = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startAddSectionTransition(async () => {
      try {
        await addFocusBoardSectionAction(formData);
        setNewSectionTitle("");
        setNewSectionDescription("");
        setSectionError(null);
        router.refresh();
      } catch (error) {
        setSectionError(error instanceof Error ? error.message : "Could not add the section.");
      }
    });
  };

  return (
    <div className="focus-control-stack">
      {orderError ? <p className="focus-control-error-tag">{orderError}</p> : null}
      {sectionError ? <p className="focus-control-error-tag">{sectionError}</p> : null}
      {hasUnsavedChanges ? (
        <p className="focus-control-order-note">Save open section or challenge edits before changing the order.</p>
      ) : null}
      <form className="focus-control-section-new" onSubmit={addSection}>
        <input name="adminSlug" type="hidden" value={adminSlug} />
        <label className="field">
          <span>New section name</span>
          <input
            name="title"
            onChange={(event) => setNewSectionTitle(event.target.value)}
            placeholder="Personal goals"
            required
            value={newSectionTitle}
          />
        </label>
        <label className="field">
          <span>Description</span>
          <input
            name="description"
            onChange={(event) => setNewSectionDescription(event.target.value)}
            placeholder="Optional helper text"
            value={newSectionDescription}
          />
        </label>
        <button className="button button-primary button-small" disabled={isAddingSection} type="submit">
          {isAddingSection ? "Adding..." : "Add section"}
        </button>
      </form>
      {orderedSections.length > 0 && (
        <div className="focus-control-section-tabs">
          {orderedSections.map((section) => {
            const tabKey = section.id ?? section.key;
            const isActive = tabKey === (activeSectionObj?.id ?? activeSectionObj?.key);
            return (
              <button
                className={`focus-control-section-tab${isActive ? " focus-control-section-tab-active" : ""}`}
                key={tabKey}
                onClick={() => setActiveSectionId(section.id ?? null)}
                type="button"
              >
                {section.title || "Untitled"}
              </button>
            );
          })}
        </div>
      )}
      {activeSectionObj && (
        <FocusControlSectionEditor
          adminSlug={adminSlug}
          assets={assets}
          availableSections={activeSections}
          canReorder={!hasUnsavedChanges && !isReorderingSections}
          isDragging={draggedSectionId === activeSectionObj.id}
          key={activeSectionObj.id ?? activeSectionObj.key}
          onDragEnd={() => setDraggedSectionId(null)}
          onDragOver={(event) => event.preventDefault()}
          onDragStart={() => setDraggedSectionId(activeSectionObj.id ?? null)}
          onDrop={() => dropSection(activeSectionObj.id)}
          onDirtyChange={setDirtyState}
          onMoveDown={() => moveSection(activeSectionObj.id, 1)}
          onMoveUp={() => moveSection(activeSectionObj.id, -1)}
          section={activeSectionObj}
          sectionIndex={orderedSections.findIndex((s) => s.id === activeSectionObj.id)}
          sectionTotal={orderedSections.length}
          hasUnsavedChanges={hasUnsavedChanges}
        />
      )}
      {hiddenSections.length ? (
        <details className="focus-control-hidden-list">
          <summary className="focus-control-hidden-list-head">
            <p className="eyebrow">Paused sections</p>
            <span>{hiddenSections.length}</span>
            <span className="focus-control-collapse-icon" aria-hidden="true">
              <svg fill="none" height="14" viewBox="0 0 14 9" width="14"><path d="M1 1.5L7 7.5L13 1.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"/></svg>
            </span>
          </summary>
          {hiddenSections.map((section, index) => (
            <FocusControlSectionEditor
              adminSlug={adminSlug}
              assets={assets}
              availableSections={activeSections}
              canReorder={false}
              hasUnsavedChanges={hasUnsavedChanges}
              isDragging={false}
              key={section.id ?? section.key}
              onDirtyChange={setDirtyState}
              onDragEnd={() => undefined}
              onDragOver={() => undefined}
              onDragStart={() => undefined}
              onDrop={() => undefined}
              onMoveDown={() => undefined}
              onMoveUp={() => undefined}
              section={section}
              sectionIndex={index}
              sectionTotal={hiddenSections.length}
            />
          ))}
        </details>
      ) : null}
    </div>
  );
}

type FocusControlSectionEditorProps = {
  adminSlug: string;
  assets: FocusAssetOption[];
  availableSections: FocusBoardSection[];
  section: FocusBoardSection;
  sectionIndex: number;
  sectionTotal: number;
  canReorder: boolean;
  hasUnsavedChanges: boolean;
  isDragging: boolean;
  onDragStart: () => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: () => void;
  onDragEnd: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDirtyChange: (key: string, dirty: boolean) => void;
};

function FocusControlSectionEditor({
  adminSlug,
  assets,
  availableSections,
  section,
  sectionIndex,
  sectionTotal,
  canReorder,
  hasUnsavedChanges,
  isDragging,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMoveUp,
  onMoveDown,
  onDirtyChange,
}: FocusControlSectionEditorProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<SectionDraft>(() => sectionToDraft(section));
  const [baseline, setBaseline] = useState<SectionDraft>(() => sectionToDraft(section));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(section.isActive !== false && section.isVisible !== false);
  const [orderedTasks, setOrderedTasks] = useState(section.tasks.filter((task) => task.isActive !== false && task.isVisible !== false));
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [taskOrderError, setTaskOrderError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isReorderingTasks, startReorderTransition] = useTransition();
  const hiddenTasks = section.tasks.filter((task) => task.isActive !== false && task.isVisible === false);
  const dirty = !draftsMatch(draft, baseline);
  const dirtyKey = `section:${section.id ?? section.key}`;

  useEffect(() => {
    setOrderedTasks(section.tasks.filter((task) => task.isActive !== false && task.isVisible !== false));
  }, [section.tasks]);

  useEffect(() => {
    onDirtyChange(dirtyKey, dirty);
    return () => onDirtyChange(dirtyKey, false);
  }, [dirty, dirtyKey, onDirtyChange]);

  const saveSection = () => {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("adminSlug", adminSlug);
        formData.set("sectionId", section.id ?? "");
        formData.set("title", draft.title);
        formData.set("description", draft.description);
        await updateFocusBoardSectionAction(formData);
        setBaseline(draft);
        setSaved(true);
        setError(null);
        router.refresh();
        window.setTimeout(() => setSaved(false), 1800);
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : "Could not save the section.");
      }
    });
  };

  const toggleVisibility = () => {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("adminSlug", adminSlug);
        formData.set("sectionId", section.id ?? "");
        formData.set("nextVisible", isVisible ? "false" : "true");
        await toggleFocusBoardSectionVisibilityAction(formData);
        setIsVisible((current) => !current);
        setError(null);
        router.refresh();
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : "Could not change section visibility.");
      }
    });
  };

  const persistTaskOrder = (nextTasks: FocusBoardTask[]) => {
    setOrderedTasks(nextTasks);
    setTaskOrderError(null);
    startReorderTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("adminSlug", adminSlug);
        formData.set("sectionId", section.id ?? "");
        nextTasks.forEach((task) => {
          if (task.id) {
            formData.append("taskIds", task.id);
          }
        });
        await reorderFocusBoardTasksAction(formData);
      } catch (actionError) {
        setTaskOrderError(actionError instanceof Error ? actionError.message : "Could not save the challenge order.");
        setOrderedTasks(section.tasks.filter((task) => task.isActive !== false && task.isVisible !== false));
      }
    });
  };

  const moveTask = (taskId: string | undefined, direction: -1 | 1) => {
    if (!taskId || isReorderingTasks || hasUnsavedChanges) {
      return;
    }

    const currentIndex = orderedTasks.findIndex((task) => task.id === taskId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= orderedTasks.length) {
      return;
    }

    const nextTasks = [...orderedTasks];
    const [task] = nextTasks.splice(currentIndex, 1);
    nextTasks.splice(nextIndex, 0, task);
    persistTaskOrder(nextTasks);
  };

  const dropTask = (targetTaskId: string | undefined) => {
    if (!draggedTaskId || !targetTaskId || draggedTaskId === targetTaskId || hasUnsavedChanges) {
      setDraggedTaskId(null);
      return;
    }

    const fromIndex = orderedTasks.findIndex((task) => task.id === draggedTaskId);
    const toIndex = orderedTasks.findIndex((task) => task.id === targetTaskId);
    if (fromIndex < 0 || toIndex < 0) {
      setDraggedTaskId(null);
      return;
    }

    const nextTasks = [...orderedTasks];
    const [task] = nextTasks.splice(fromIndex, 1);
    nextTasks.splice(toIndex, 0, task);
    setDraggedTaskId(null);
    persistTaskOrder(nextTasks);
  };

  return (
    <section
      className={`focus-control-section-shell ${isDragging ? "focus-control-task-shell-dragging" : ""}`}
      draggable={canReorder}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDrop={onDrop}
    >
      <div className="focus-control-task-panel focus-control-task-panel-rich">
        <div className="focus-control-section-panel-header">
          <div className="focus-control-drag-cluster">
            <span className="focus-control-drag-handle" role="button" tabIndex={canReorder ? 0 : -1}>
              <svg fill="currentColor" height="16" viewBox="0 0 10 16" width="10"><circle cx="3" cy="4" r="1.5"/><circle cx="7" cy="4" r="1.5"/><circle cx="3" cy="8" r="1.5"/><circle cx="7" cy="8" r="1.5"/><circle cx="3" cy="12" r="1.5"/><circle cx="7" cy="12" r="1.5"/></svg>
            </span>
            <div className="focus-control-order-buttons">
              <button disabled={!canReorder || sectionIndex === 0} onClick={onMoveUp} type="button">
                <svg fill="none" height="7" viewBox="0 0 10 7" width="10"><path d="M1 6L5 1L9 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></svg>
              </button>
              <button disabled={!canReorder || sectionIndex === sectionTotal - 1} onClick={onMoveDown} type="button">
                <svg fill="none" height="7" viewBox="0 0 10 7" width="10"><path d="M1 1L5 6L9 1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></svg>
              </button>
            </div>
          </div>
          <div className="focus-control-task-summary-meta">
            <span className={`focus-control-task-status ${isVisible ? "focus-control-task-status-live" : "focus-control-task-status-hidden"}`}>
              {isVisible ? "Visible" : "Paused"}
            </span>
            {dirty ? <span className="focus-control-dirty-pill">Unsaved</span> : null}
            <button
              aria-label={isVisible ? `Hide section ${section.title}` : `Show section ${section.title}`}
              className={`focus-visibility-icon ${isVisible ? "focus-visibility-icon-live" : "focus-visibility-icon-hidden"}`}
              disabled={isPending}
              onClick={toggleVisibility}
              type="button"
            >
              {isVisible ? "◉" : "○"}
            </button>
          </div>
        </div>
        <div className="focus-control-section-fields">
          <label className="field">
            <span>Section name</span>
            <input
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              value={draft.title}
            />
          </label>
          <label className="field">
            <span>Description</span>
            <input onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} value={draft.description} />
          </label>
          <button
            className={`button ${dirty ? "button-primary focus-control-save-button-active" : "button-secondary"} button-small`}
            disabled={isPending}
            onClick={saveSection}
            type="button"
          >
            {isPending ? "Saving..." : "Save section"}
          </button>
          {saved ? <span className="focus-control-saved-tag">SAVED!</span> : null}
          {error ? <span className="focus-control-error-tag">{error}</span> : null}
        </div>
        {taskOrderError ? <p className="focus-control-error-tag">{taskOrderError}</p> : null}
        <div className="focus-control-drag-list">
          {orderedTasks.map((task, index) => (
            <FocusControlTaskEditor
              adminSlug={adminSlug}
              assets={assets}
              availableSections={availableSections}
              canReorder={!hasUnsavedChanges && !isReorderingTasks}
              isDragging={draggedTaskId === task.id}
              key={task.id ?? task.key}
              onDragEnd={() => setDraggedTaskId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDragStart={() => setDraggedTaskId(task.id ?? null)}
              onDrop={() => dropTask(task.id)}
              onDirtyChange={onDirtyChange}
              onMoveDown={() => moveTask(task.id, 1)}
              onMoveUp={() => moveTask(task.id, -1)}
              task={task}
              taskIndex={index}
              taskTotal={orderedTasks.length}
            />
          ))}
        </div>
        {hiddenTasks.length ? (
          <details className="focus-control-hidden-list focus-control-hidden-list-compact">
            <summary className="focus-control-hidden-list-head">
              <p className="eyebrow">Paused challenges</p>
              <span>{hiddenTasks.length}</span>
              <span className="focus-control-collapse-icon" aria-hidden="true">
                <svg fill="none" height="14" viewBox="0 0 14 9" width="14"><path d="M1 1.5L7 7.5L13 1.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"/></svg>
              </span>
            </summary>
            {hiddenTasks.map((task, index) => (
              <FocusControlTaskEditor
                adminSlug={adminSlug}
                assets={assets}
                availableSections={availableSections}
                canReorder={false}
                isDragging={false}
                key={task.id ?? task.key}
                onDragEnd={() => undefined}
                onDragOver={() => undefined}
                onDragStart={() => undefined}
                onDrop={() => undefined}
                onDirtyChange={onDirtyChange}
                onMoveDown={() => undefined}
                onMoveUp={() => undefined}
                task={task}
                taskIndex={index}
                taskTotal={hiddenTasks.length}
              />
            ))}
          </details>
        ) : null}
      </div>
    </section>
  );
}

type FocusControlTaskEditorProps = {
  adminSlug: string;
  assets: FocusAssetOption[];
  availableSections: FocusBoardSection[];
  task: FocusBoardTask;
  taskIndex: number;
  taskTotal: number;
  canReorder: boolean;
  isDragging: boolean;
  onDragStart: () => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: () => void;
  onDragEnd: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDirtyChange: (key: string, dirty: boolean) => void;
};

function FocusControlTaskEditor({
  adminSlug,
  assets,
  availableSections,
  task,
  taskIndex,
  taskTotal,
  canReorder,
  isDragging,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMoveUp,
  onMoveDown,
  onDirtyChange,
}: FocusControlTaskEditorProps) {
  const router = useRouter();
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(() => taskToDraft(task));
  const [taskBaseline, setTaskBaseline] = useState<TaskDraft>(() => taskToDraft(task));
  const [taskSaved, setTaskSaved] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(task.isActive !== false && task.isVisible !== false);
  const [addMetricError, setAddMetricError] = useState<string | null>(null);
  const [newMetricKind, setNewMetricKind] = useState<FocusMetricKind>("count");
  const [newCheckboxOptions, setNewCheckboxOptions] = useState<FocusCheckboxOption[]>(
    DEFAULT_FOCUS_CHECKBOX_OPTIONS,
  );
  const [isAddingMetric, startAddMetricTransition] = useTransition();
  const [isPendingTask, startTaskTransition] = useTransition();

  const taskDirty = !draftsMatch(taskDraft, taskBaseline);
  const taskDirtyKey = `task:${task.id ?? task.key}`;

  useEffect(() => {
    onDirtyChange(taskDirtyKey, taskDirty);
    if (taskDirty) {
      setIsOpen(true);
    }

    return () => onDirtyChange(taskDirtyKey, false);
  }, [onDirtyChange, taskDirty, taskDirtyKey]);

  const saveTask = () => {
    startTaskTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("adminSlug", adminSlug);
        formData.set("taskId", task.id ?? "");
        formData.set("title", taskDraft.title);
        formData.set("icon", taskDraft.icon);
        formData.set("description", taskDraft.description);
        formData.set("stickerSrc", taskDraft.stickerSrc);
        formData.set("stickerAlt", taskDraft.stickerAlt);
        formData.set("isBoosted", taskDraft.isBoosted);
        formData.set("sectionId", taskDraft.sectionId);

        await updateFocusBoardTaskAction(formData);
        setTaskBaseline(taskDraft);
        setTaskSaved(true);
        setTaskError(null);
        router.refresh();
        window.setTimeout(() => setTaskSaved(false), 1800);
      } catch (error) {
        setTaskError(error instanceof Error ? error.message : "Could not save the goal details.");
      }
    });
  };

  const toggleVisibility = () => {
    startTaskTransition(async () => {
      const formData = new FormData();
      formData.set("adminSlug", adminSlug);
      formData.set("taskId", task.id ?? "");
      formData.set("nextVisible", isVisible ? "false" : "true");
      await toggleFocusBoardTaskVisibilityAction(formData);
      setIsVisible((current) => !current);
      router.refresh();
    });
  };

  const addMetric = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    startAddMetricTransition(async () => {
      try {
        await addFocusBoardMetricAction(formData);
        setAddMetricError(null);
        form.reset();
        setNewMetricKind("count");
        setNewCheckboxOptions(DEFAULT_FOCUS_CHECKBOX_OPTIONS);
        router.refresh();
      } catch (error) {
        setAddMetricError(error instanceof Error ? error.message : "Could not add the metric.");
      }
    });
  };
  const activeMetrics = task.metrics.filter((metric) => metric.isActive !== false);
  const visibleMetrics = activeMetrics.filter((metric) => metric.isVisible !== false);
  const hiddenMetrics = activeMetrics.filter((metric) => metric.isVisible === false);

  return (
    <section
      className={`focus-control-task-shell ${isDragging ? "focus-control-task-shell-dragging" : ""}`}
      draggable={canReorder}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDrop={onDrop}
    >
      <details
        className={`focus-control-task-collapsible ${isOpen ? "focus-control-task-collapsible-open" : ""}`}
        onToggle={(event) => setIsOpen(event.currentTarget.open)}
        open={isOpen}
      >
        <summary className="focus-control-task-summary">
          <div
            className="focus-control-drag-cluster"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            <span
              aria-label={`Drag ${task.title} to reorder`}
              className="focus-control-drag-handle"
              role="button"
              tabIndex={canReorder ? 0 : -1}
              title="Drag to reorder"
            >
              <svg fill="currentColor" height="16" viewBox="0 0 10 16" width="10"><circle cx="3" cy="4" r="1.5"/><circle cx="7" cy="4" r="1.5"/><circle cx="3" cy="8" r="1.5"/><circle cx="7" cy="8" r="1.5"/><circle cx="3" cy="12" r="1.5"/><circle cx="7" cy="12" r="1.5"/></svg>
            </span>
            <div className="focus-control-order-buttons">
              <button
                aria-label={`Move ${task.title} up`}
                disabled={!canReorder || taskIndex === 0}
                onClick={onMoveUp}
                type="button"
              >
                <svg fill="none" height="7" viewBox="0 0 10 7" width="10"><path d="M1 6L5 1L9 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></svg>
              </button>
              <button
                aria-label={`Move ${task.title} down`}
                disabled={!canReorder || taskIndex === taskTotal - 1}
                onClick={onMoveDown}
                type="button"
              >
                <svg fill="none" height="7" viewBox="0 0 10 7" width="10"><path d="M1 1L5 6L9 1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></svg>
              </button>
            </div>
          </div>
          <div className="focus-control-task-summary-copy">
            <p className="eyebrow">Challenge</p>
            <h3
              onDoubleClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsOpen(true);
                window.setTimeout(() => {
                  titleInputRef.current?.focus();
                  titleInputRef.current?.select();
                }, 0);
              }}
              title="Double-click to edit"
            >
              {taskDraft.title || "Untitled goal"}
            </h3>
            <p>
              {visibleMetrics.length} visible metric{visibleMetrics.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="focus-control-task-summary-meta">
            <span
              className={`focus-control-task-status ${
                isVisible ? "focus-control-task-status-live" : "focus-control-task-status-hidden"
              }`}
            >
              {isVisible ? "Visible" : "Paused"}
            </span>
            {taskDraft.isBoosted === "true" ? <span className="focus-control-boost-pill">Boost x2</span> : null}
            {taskDirty ? <span className="focus-control-dirty-pill">Unsaved</span> : null}
            <span className="focus-control-collapse-icon" aria-hidden="true">
              <svg fill="none" height="14" viewBox="0 0 14 9" width="14"><path d="M1 1.5L7 7.5L13 1.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"/></svg>
            </span>
          </div>
        </summary>

        <div className="focus-control-task-panel focus-control-task-panel-rich">
          <div className="focus-control-corner-actions">
            <button
              aria-label={isVisible ? `Hide ${task.title}` : `Show ${task.title}`}
              className={`focus-visibility-icon ${isVisible ? "focus-visibility-icon-live" : "focus-visibility-icon-hidden"}`}
              onClick={toggleVisibility}
              type="button"
            >
              {isVisible ? "◉" : "○"}
            </button>
            <FocusDeleteButton
              action={deleteFocusBoardTaskAction}
              confirmMessage={`Delete "${task.title}" from future use? Existing historical points will be preserved.`}
              hiddenFields={{
                adminSlug,
                taskId: task.id,
              }}
              label={`Delete ${task.title}`}
            />
          </div>

          <div className="focus-control-form">
            <div className="focus-control-two-up">
              <label className="field">
                <span>Section</span>
                <select
                  className="select-field"
                  onChange={(event) => setTaskDraft((current) => ({ ...current, sectionId: event.target.value }))}
                  value={taskDraft.sectionId}
                >
                  {availableSections.map((section) => (
                    <option key={section.id ?? section.key} value={section.id ?? ""}>
                      {section.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Task title</span>
                <input
                  onChange={(event) => setTaskDraft((current) => ({ ...current, title: event.target.value }))}
                  ref={titleInputRef}
                  value={taskDraft.title}
                />
              </label>
              <label className="field">
                <span>Badge text</span>
                <input
                  onChange={(event) => setTaskDraft((current) => ({ ...current, icon: event.target.value }))}
                  value={taskDraft.icon}
                />
              </label>
            </div>

            <label className="field">
              <span>Description</span>
              <textarea
                onChange={(event) => setTaskDraft((current) => ({ ...current, description: event.target.value }))}
                value={taskDraft.description}
              />
            </label>

            <div className="focus-control-two-up">
              <FocusImageSelect
                assets={assets}
                label="Sticker image"
                onChange={(value) => setTaskDraft((current) => ({ ...current, stickerSrc: value }))}
                value={taskDraft.stickerSrc}
              />
              <label className="field">
                <span>Sticker alt</span>
                <input
                  onChange={(event) => setTaskDraft((current) => ({ ...current, stickerAlt: event.target.value }))}
                  value={taskDraft.stickerAlt}
                />
              </label>
            </div>

            <label className="focus-control-boost-toggle">
              <input
                checked={taskDraft.isBoosted === "true"}
                onChange={(event) =>
                  setTaskDraft((current) => ({
                    ...current,
                    isBoosted: event.target.checked ? "true" : "false",
                  }))
                }
                type="checkbox"
              />
              <span>
                <strong>Boost this challenge</strong>
                <small>Show a boosted tag on the board and double new points while active.</small>
              </span>
            </label>

            <div className="focus-control-task-action-row">
              <button
                className={`button ${taskDirty ? "button-primary focus-control-save-button-active" : "button-secondary"} focus-control-save-button`}
                disabled={isPendingTask}
                onClick={saveTask}
                type="button"
              >
                {isPendingTask ? "Saving goal..." : "Save goal details"}
              </button>
              {taskSaved ? <span className="focus-control-saved-tag">SAVED!</span> : null}
              {taskError ? <span className="focus-control-error-tag">{taskError}</span> : null}
            </div>
          </div>

          <div className="focus-control-metric-stack">
            {visibleMetrics.map((metric) => (
              <FocusControlMetricEditor
                adminSlug={adminSlug}
                key={metric.id ?? metric.key}
                metric={metric}
                metricsCount={activeMetrics.length}
                onDirtyChange={onDirtyChange}
                task={task}
              />
            ))}

            <form className="focus-control-metric-card focus-control-metric-card-new" onSubmit={addMetric}>
              <input name="adminSlug" type="hidden" value={adminSlug} />
              <input name="taskId" type="hidden" value={task.id} />
              <div className="focus-control-metric-card-head">
                <div>
                  <p className="eyebrow">Add metric</p>
                  <h4>New way to score this challenge</h4>
                </div>
              </div>
              <div className="focus-control-metric-fields">
                <label className="field">
                  <span>New metric label</span>
                  <input name="metricLabel" placeholder="Bonus review" />
                </label>
                <label className="field">
                  <span>Kind</span>
                  <select
                    className="select-field"
                    name="kind"
                    onChange={(event) => setNewMetricKind(event.target.value as FocusMetricKind)}
                    value={newMetricKind}
                  >
                    <option value="count">Count</option>
                    <option value="checkbox">Checkboxes</option>
                  </select>
                </label>
                {newMetricKind === "count" ? (
                  <label className="field">
                    <span>Target</span>
                    <input defaultValue={0} min={0} name="target" type="number" />
                  </label>
                ) : null}
                <label className="field">
                  <span>{newMetricKind === "checkbox" ? "Points per checkbox" : "Points"}</span>
                  <input defaultValue={5} name="points" type="number" />
                </label>
              </div>
              {newMetricKind === "checkbox" ? (
                <>
                  <input
                    name="checkboxOptions"
                    type="hidden"
                    value={JSON.stringify(getPreparedCheckboxOptions(newCheckboxOptions))}
                  />
                  <FocusCheckboxOptionsEditor
                    onChange={setNewCheckboxOptions}
                    options={newCheckboxOptions}
                  />
                </>
              ) : null}
              <button className="button button-primary button-small" disabled={isAddingMetric} type="submit">
                {isAddingMetric ? "Adding metric..." : "Add metric"}
              </button>
              {addMetricError ? <p className="focus-control-error-tag">{addMetricError}</p> : null}
            </form>
            {hiddenMetrics.length ? (
              <details className="focus-control-hidden-list focus-control-hidden-list-compact">
                <summary className="focus-control-hidden-list-head">
                  <p className="eyebrow">Paused metrics</p>
                  <span>{hiddenMetrics.length}</span>
                  <span className="focus-control-collapse-icon" aria-hidden="true">
                    +
                  </span>
                </summary>
                {hiddenMetrics.map((metric) => (
                  <FocusControlMetricEditor
                    adminSlug={adminSlug}
                    key={metric.id ?? metric.key}
                    metric={metric}
                    metricsCount={activeMetrics.length}
                    onDirtyChange={onDirtyChange}
                    task={task}
                  />
                ))}
              </details>
            ) : null}
          </div>
        </div>
      </details>
    </section>
  );
}

type FocusControlMetricEditorProps = {
  adminSlug: string;
  task: FocusBoardTask;
  metric: FocusBoardTask["metrics"][number];
  metricsCount: number;
  onDirtyChange: (key: string, dirty: boolean) => void;
};

function FocusControlMetricEditor({
  adminSlug,
  task,
  metric,
  metricsCount,
  onDirtyChange,
}: FocusControlMetricEditorProps) {
  const router = useRouter();
  const labelInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<MetricDraft>(() => metricToDraft(metric));
  const [baseline, setBaseline] = useState<MetricDraft>(() => metricToDraft(metric));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(metric.isActive !== false && metric.isVisible !== false);
  const [isPending, startTransition] = useTransition();

  const dirty = !draftsMatch(draft, baseline);
  const dirtyKey = `metric:${metric.id ?? metric.key}`;

  useEffect(() => {
    onDirtyChange(dirtyKey, dirty);
    return () => onDirtyChange(dirtyKey, false);
  }, [dirty, dirtyKey, onDirtyChange]);

  const saveMetric = () => {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("adminSlug", adminSlug);
        formData.set("metricId", metric.id ?? "");
        formData.set("taskId", task.id ?? "");
        formData.set("label", draft.label);
        formData.set("target", draft.target);
        formData.set("points", draft.points);
        formData.set("kind", draft.kind);
        formData.set("checkboxOptions", JSON.stringify(getPreparedCheckboxOptions(draft.checkboxOptions)));

        await updateFocusBoardMetricAction(formData);
        setBaseline(draft);
        setSaved(true);
        setError(null);
        router.refresh();
        window.setTimeout(() => setSaved(false), 1800);
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : "Could not save the metric.");
      }
    });
  };

  const toggleVisibility = () => {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("adminSlug", adminSlug);
        formData.set("metricId", metric.id ?? "");
        formData.set("nextVisible", isVisible ? "false" : "true");

        await toggleFocusBoardMetricVisibilityAction(formData);
        setIsVisible((current) => !current);
        setError(null);
        router.refresh();
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : "Could not change metric visibility.");
      }
    });
  };

  return (
    <div className={`focus-control-metric-card ${isVisible ? "" : "focus-control-metric-card-hidden"}`}>
      <div className="focus-control-metric-actions">
        <button
          aria-label={isVisible ? `Hide metric ${metric.label}` : `Show metric ${metric.label}`}
          className={`focus-visibility-icon ${isVisible ? "focus-visibility-icon-live" : "focus-visibility-icon-hidden"}`}
          disabled={isPending}
          onClick={toggleVisibility}
          title={isVisible ? "Hide metric from Liona" : "Show metric to Liona"}
          type="button"
        >
          {isVisible ? "◉" : "○"}
        </button>
        <FocusDeleteButton
          action={deleteFocusBoardMetricAction}
          confirmMessage={`Delete the "${metric.label}" metric from "${task.title}"? Existing historical points will be preserved.`}
          disabled={metricsCount <= 1}
          hiddenFields={{
            adminSlug,
            taskId: task.id,
            metricId: metric.id,
          }}
          label={metricsCount <= 1 ? "Delete whole challenge instead" : `Delete metric ${metric.label}`}
        />
      </div>

      <div className="focus-control-metric-card-head">
        <div>
          <p className="eyebrow">Metric</p>
          <h4
            onDoubleClick={() => {
              labelInputRef.current?.focus();
              labelInputRef.current?.select();
            }}
            title="Double-click to edit"
          >
            {draft.label || "Untitled metric"}
          </h4>
        </div>
        <div className="focus-control-metric-state">
          <span
            className={`focus-control-task-status ${
              isVisible ? "focus-control-task-status-live" : "focus-control-task-status-hidden"
            }`}
          >
            {isVisible ? "Visible" : "Hidden"}
          </span>
          {dirty ? <span className="focus-control-dirty-pill">Unsaved</span> : null}
        </div>
      </div>

      <div className="focus-control-metric-fields">
        <label className="field">
          <span>Metric label</span>
          <input
            onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))}
            ref={labelInputRef}
            value={draft.label}
          />
        </label>
        <label className="field">
          <span>Kind</span>
          <select
            className="select-field"
            onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value as FocusMetricKind }))}
            value={draft.kind}
          >
            <option value="count">Count</option>
            <option value="checkbox">Checkboxes</option>
          </select>
        </label>
        {draft.kind === "count" ? (
          <label className="field">
            <span>Target</span>
            <input onChange={(event) => setDraft((current) => ({ ...current, target: event.target.value }))} type="number" value={draft.target} />
          </label>
        ) : null}
        <label className="field">
          <span>{draft.kind === "checkbox" ? "Points per checkbox" : "Points"}</span>
          <input onChange={(event) => setDraft((current) => ({ ...current, points: event.target.value }))} type="number" value={draft.points} />
        </label>
      </div>
      {draft.kind === "checkbox" ? (
        <FocusCheckboxOptionsEditor
          onChange={(options) =>
            setDraft((current) => ({
              ...current,
              checkboxOptions: options,
              target: String(getPreparedCheckboxOptions(options).length),
            }))
          }
          options={draft.checkboxOptions}
        />
      ) : null}

      <div className="focus-control-task-action-row">
        <button
          className={`button ${dirty ? "button-primary focus-control-save-button-active" : "button-secondary"} button-small focus-control-save-button`}
          disabled={isPending}
          onClick={saveMetric}
          type="button"
        >
          {isPending ? "Saving metric..." : "Save metric"}
        </button>
        {saved ? <span className="focus-control-saved-tag">SAVED!</span> : null}
        {error ? <span className="focus-control-error-tag">{error}</span> : null}
      </div>
    </div>
  );
}
