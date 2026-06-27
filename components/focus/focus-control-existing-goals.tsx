"use client";

import { useEffect, useMemo, useState, useTransition, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  addFocusBoardMetricAction,
  deleteFocusBoardMetricAction,
  deleteFocusBoardTaskAction,
  reorderFocusBoardTasksAction,
  toggleFocusBoardMetricVisibilityAction,
  toggleFocusBoardTaskVisibilityAction,
  updateFocusBoardMetricAction,
  updateFocusBoardTaskAction,
} from "@/app/focus-control/actions";
import { FocusDeleteButton } from "@/components/focus/focus-delete-button";
import { FocusImageSelect } from "@/components/focus/focus-image-select";
import type { FocusAssetOption } from "@/lib/focus-board/assets";
import {
  DEFAULT_FOCUS_CHECKBOX_OPTIONS,
  normaliseFocusCheckboxOptions,
  type FocusBoardTask,
  type FocusCheckboxOption,
  type FocusMetricKind,
} from "@/lib/focus-board/config";

type FocusControlExistingGoalsProps = {
  adminSlug: string;
  assets: FocusAssetOption[];
  tasks: FocusBoardTask[];
};

type TaskDraft = {
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
    title: task.title,
    icon: task.icon,
    description: task.description,
    stickerSrc: task.stickerSrc,
    stickerAlt: task.stickerAlt,
    isBoosted: task.isBoosted ? "true" : "false",
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

export function FocusControlExistingGoals({ adminSlug, assets, tasks }: FocusControlExistingGoalsProps) {
  const [dirtyKeys, setDirtyKeys] = useState<Record<string, boolean>>({});
  const [orderedTasks, setOrderedTasks] = useState(tasks);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [isReordering, startReorderTransition] = useTransition();

  const hasUnsavedChanges = useMemo(
    () => Object.values(dirtyKeys).some(Boolean),
    [dirtyKeys],
  );

  useUnsavedChangesWarning(hasUnsavedChanges);

  useEffect(() => {
    setOrderedTasks(tasks);
  }, [tasks]);

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

  const persistOrder = (nextTasks: FocusBoardTask[]) => {
    setOrderedTasks(nextTasks);
    setOrderError(null);
    startReorderTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("adminSlug", adminSlug);
        nextTasks.forEach((task) => {
          if (task.id) {
            formData.append("taskIds", task.id);
          }
        });

        await reorderFocusBoardTasksAction(formData);
      } catch (error) {
        setOrderError(error instanceof Error ? error.message : "Could not save the challenge order.");
        setOrderedTasks(tasks);
      }
    });
  };

  const moveTask = (taskId: string | undefined, direction: -1 | 1) => {
    if (!taskId || isReordering || hasUnsavedChanges) {
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
    persistOrder(nextTasks);
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
    persistOrder(nextTasks);
  };

  return (
    <div className="focus-control-stack">
      {orderError ? <p className="focus-control-error-tag">{orderError}</p> : null}
      {hasUnsavedChanges ? (
        <p className="focus-control-order-note">Save open challenge edits before changing the order.</p>
      ) : null}
      {orderedTasks.map((task, index) => (
        <FocusControlTaskEditor
          adminSlug={adminSlug}
          assets={assets}
          canReorder={!hasUnsavedChanges && !isReordering}
          isDragging={draggedTaskId === task.id}
          key={task.id ?? task.key}
          onDragEnd={() => setDraggedTaskId(null)}
          onDragOver={(event) => event.preventDefault()}
          onDragStart={() => setDraggedTaskId(task.id ?? null)}
          onDrop={() => dropTask(task.id)}
          onDirtyChange={setDirtyState}
          onMoveDown={() => moveTask(task.id, 1)}
          onMoveUp={() => moveTask(task.id, -1)}
          task={task}
          taskIndex={index}
          taskTotal={orderedTasks.length}
        />
      ))}
    </div>
  );
}

type FocusControlTaskEditorProps = {
  adminSlug: string;
  assets: FocusAssetOption[];
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
              ::
            </span>
            <div className="focus-control-order-buttons">
              <button
                aria-label={`Move ${task.title} up`}
                disabled={!canReorder || taskIndex === 0}
                onClick={onMoveUp}
                type="button"
              >
                ^
              </button>
              <button
                aria-label={`Move ${task.title} down`}
                disabled={!canReorder || taskIndex === taskTotal - 1}
                onClick={onMoveDown}
                type="button"
              >
                v
              </button>
            </div>
          </div>
          <div className="focus-control-task-summary-copy">
            <p className="eyebrow">Challenge</p>
            <h3>{taskDraft.title || "Untitled goal"}</h3>
            <p>
              {task.metrics.length} metric{task.metrics.length === 1 ? "" : "s"}
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
              {isOpen ? "−" : "+"}
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
                <span>Task title</span>
                <input
                  onChange={(event) => setTaskDraft((current) => ({ ...current, title: event.target.value }))}
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
            {task.metrics.map((metric) => (
              <FocusControlMetricEditor
                adminSlug={adminSlug}
                key={metric.id ?? metric.key}
                metric={metric}
                metricsCount={task.metrics.length}
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
          <h4>{draft.label || "Untitled metric"}</h4>
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
          <input onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))} value={draft.label} />
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
