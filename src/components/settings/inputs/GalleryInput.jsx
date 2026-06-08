import { useState, useRef, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import Button, { IconButton } from "../../ui/Button";
import ImageInput from "./ImageInput";
import TextInput from "./TextInput";

/**
 * GalleryInput — the `gallery` setting type: an ordered, repeatable list of
 * { src, caption } entries. Composes the existing ImageInput per row (so the
 * media-selector / upload / metadata flow behaves identically to a single
 * `image`) plus a per-entry caption, with drag-to-reorder via @dnd-kit.
 *
 * Each row carries a stable client-side `uid`. It keys the dnd-kit sortable, the
 * React list, AND the row's hidden file-input id (`${id}-${uid}`): ImageInput
 * binds `id` to a hidden <input type="file">, so N rows must not share one id.
 * `src` can't be the key (blank/duplicated) and the array index can't (changes
 * on reorder), hence the uid.
 *
 * Blank-`src` rows are kept editor-local (so a freshly-added row persists while
 * the user picks an image) but are NEVER committed: `onChange` only ever emits
 * entries that have a real src. That keeps the stored array free of empty rows
 * and aligned with the backend's src-aware required-field validation.
 */

let uidCounter = 0;
const nextUid = () => `gallery-row-${(uidCounter += 1)}`;

/** Incoming value (array of {src, caption}) → editable rows with stable uids. */
function toRows(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      uid: nextUid(),
      src: typeof entry.src === "string" ? entry.src : "",
      caption: typeof entry.caption === "string" ? entry.caption : "",
    }));
}

/** Editable rows → committed value (drops blank-src rows, keeps order). */
function toValue(rows) {
  return rows.filter((r) => r.src).map((r) => ({ src: r.src, caption: r.caption }));
}

/** Collision-free signature of a committed value — JSON-encoded [src, caption]
 *  pairs (no ambiguous separators, no control characters). Used only to tell
 *  whether a committed value actually changed. */
function signature(entries) {
  return JSON.stringify((Array.isArray(entries) ? entries : []).map((e) => [e?.src ?? "", e?.caption ?? ""]));
}

function GalleryRow({ row, inputId, onSrcChange, onCaptionChange, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.uid,
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: "relative",
    zIndex: isDragging ? 50 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-md"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab p-1 mt-1 shrink-0 text-slate-400 hover:text-slate-600"
        aria-label="Reorder image"
      >
        <GripVertical size={18} />
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <ImageInput id={inputId} value={row.src} onChange={onSrcChange} />
        <TextInput value={row.caption} onChange={onCaptionChange} placeholder="Caption (optional)" />
      </div>

      <IconButton type="button" variant="danger" size="sm" onClick={onRemove} title="Remove image">
        <Trash2 size={18} />
      </IconButton>
    </div>
  );
}

export default function GalleryInput({ id, value, onChange }) {
  const [rows, setRows] = useState(() => toRows(value));
  const mounted = useRef(false);
  // Set true right before we call onChange, so the resulting value echo is
  // recognised as ours and does NOT rebuild local rows (which would drop an
  // in-progress blank row and regenerate uids mid-edit). Any value change we did
  // not cause — undo/redo, form reset, switching items — is treated as external
  // and rebuilds rows, discarding local-only blank rows. This is reference- and
  // clone-agnostic (react-hook-form's watch may clone), unlike a content
  // signature, which can't tell our echo from a reset to identical content.
  const echoExpected = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true; // initial rows already derived from value
      return;
    }
    if (echoExpected.current) {
      echoExpected.current = false; // our own emission echoing back — keep local rows
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(toRows(value)); // external change — rebuild, dropping local-only blank rows
  }, [value]);

  // Update local rows; emit only when the committed (blank-src-filtered) value
  // actually changes, so adding or captioning a still-srcless row never marks dirty.
  const apply = (nextRows) => {
    const changed = signature(toValue(nextRows)) !== signature(toValue(rows));
    setRows(nextRows);
    if (!changed) return;
    echoExpected.current = true;
    onChange(toValue(nextRows));
  };

  // A freshly-added row is local-only until it gets a src (no commit yet).
  const handleAdd = () => setRows((prev) => [...prev, { uid: nextUid(), src: "", caption: "" }]);
  const setSrc = (uid, src) => apply(rows.map((r) => (r.uid === uid ? { ...r, src } : r)));
  const setCaption = (uid, caption) => apply(rows.map((r) => (r.uid === uid ? { ...r, caption } : r)));
  const removeRow = (uid) => apply(rows.filter((r) => r.uid !== uid));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = rows.findIndex((r) => r.uid === active.id);
    const newIndex = rows.findIndex((r) => r.uid === over.id);
    if (oldIndex !== -1 && newIndex !== -1) apply(arrayMove(rows, oldIndex, newIndex));
  };

  return (
    <div className="flex flex-col gap-3">
      {rows.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={rows.map((r) => r.uid)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3">
              {rows.map((row) => (
                <GalleryRow
                  key={row.uid}
                  row={row}
                  inputId={`${id}-${row.uid}`}
                  onSrcChange={(src) => setSrc(row.uid, src)}
                  onCaptionChange={(caption) => setCaption(row.uid, caption)}
                  onRemove={() => removeRow(row.uid)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Button type="button" variant="secondary" size="sm" onClick={handleAdd} className="self-start">
        <Plus size={16} className="mr-1" />
        Add image
      </Button>
    </div>
  );
}
