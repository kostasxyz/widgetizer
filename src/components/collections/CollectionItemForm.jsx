/* eslint-disable react-hooks/incompatible-library */
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { formatSlug } from "../../utils/slugUtils";
import useToastStore from "../../stores/toastStore";
import Button from "../ui/Button";
import SettingsRenderer from "../settings/SettingsRenderer";
import { API_URL } from "../../config";
import { previewCollectionItem } from "../../queries/collectionManager";

const HEADER_TYPE = "header";

/** A value counts as "missing" for a required field. Mirrors the backend rule. */
function isMissingValue(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") {
    // link/youtube objects: treat as empty when their href/url is blank
    if ("href" in value) return !value.href;
    if ("url" in value) return !value.url;
  }
  return false;
}

/**
 * Schema-driven create/edit form for a collection item. Mirrors PageForm's
 * contract (initialData / onSubmit / onDirtyChange / isDirty) so the page shells
 * (CollectionItemAdd / CollectionItemEdit) stay thin. Fields render through the
 * shared SettingsRenderer, so every supported setting type is available.
 *
 * @param {Object} props
 * @param {Object} props.schema - Normalized collection schema (with settings[]).
 * @param {Object} [props.initialData] - { slug, settings, validationErrors }.
 * @param {Function} props.onSubmit - async ({ slug, settings }) => boolean.
 */
export default function CollectionItemForm({
  schema,
  initialData = { slug: "", settings: {} },
  onSubmit,
  isSubmitting = false,
  submitLabel = "Save",
  onCancel,
  onDirtyChange,
  isDirty: isDirtyProp = false,
}) {
  const { t } = useTranslation();
  const showToast = useToastStore((state) => state.showToast);
  const isNew = !initialData.id && !initialData.slug;

  const allSettings = Array.isArray(schema?.settings) ? schema.settings : [];
  const fieldSettings = allSettings.filter((s) => s.type !== HEADER_TYPE);
  const titleSetting = fieldSettings.find((s) => s.usedAsTitle);

  const {
    register,
    handleSubmit: rhfHandleSubmit,
    formState: { errors, isDirty },
    reset,
    watch,
    setValue,
    getValues,
  } = useForm({
    defaultValues: {
      slug: initialData.slug || "",
      settings: initialData.settings || {},
    },
  });

  // Per-field validation errors keyed by setting id (required-empty fields).
  const [fieldErrors, setFieldErrors] = useState({});

  const settingsValues = watch("settings") || {};
  const titleValue = titleSetting ? settingsValues[titleSetting.id] : undefined;

  // Notify parent of dirty changes.
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Seed validation errors from a loaded invalid item so problems show on open.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    if (Array.isArray(initialData.validationErrors) && initialData.validationErrors.length > 0) {
      const seeded = {};
      for (const ve of initialData.validationErrors) {
        if (ve.fieldId && ve.fieldId !== "slug") seeded[ve.fieldId] = t("collectionsForm.fieldRequired");
      }
      setFieldErrors(seeded);
    }
  }, [initialData.validationErrors, t]);

  // Auto-generate slug from the title field for new items.
  useEffect(() => {
    if (isNew && typeof titleValue === "string" && titleValue) {
      setValue("slug", formatSlug(titleValue), { shouldDirty: true });
    }
  }, [titleValue, isNew, setValue]);

  // Reset the form when switching to a different item.
  const prevKeyRef = useRef(initialData.slug);
  useEffect(() => {
    if (prevKeyRef.current !== initialData.slug) {
      reset({ slug: initialData.slug || "", settings: initialData.settings || {} });
      prevKeyRef.current = initialData.slug;
    }
  });

  const effectiveValue = (setting) => {
    const v = settingsValues[setting.id];
    return v !== undefined ? v : setting.default;
  };

  const handleSettingChange = (id, value) => {
    setValue(`settings.${id}`, value, { shouldDirty: true });
    setFieldErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const validateRequired = () => {
    const nextErrors = {};
    for (const setting of fieldSettings) {
      if (setting.required && isMissingValue(effectiveValue(setting))) {
        nextErrors[setting.id] = t("collectionsForm.fieldRequired");
      }
    }
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const onSubmitHandler = async (data) => {
    if (!validateRequired()) return false;
    try {
      return await onSubmit({
        slug: formatSlug(data.slug),
        settings: data.settings || {},
      });
    } catch (err) {
      showToast(err.message || t("collectionsForm.toasts.updateError"), "error");
      return false;
    }
  };

  // Open a new-tab preview of the current (unsaved) draft rendered through the
  // collection's theme template. Only meaningful when the collection has item
  // pages (otherwise there is no template to render).
  const [isPreviewing, setIsPreviewing] = useState(false);
  const canPreview = !!schema?.hasItemPages;
  const handlePreview = async () => {
    // Open the tab synchronously (inside the click) to avoid popup blockers,
    // then point it at the rendered token once it's ready.
    const win = window.open("", "_blank");
    setIsPreviewing(true);
    try {
      const values = getValues();
      const { token } = await previewCollectionItem({
        collectionType: schema.type,
        slug: formatSlug(values.slug || "preview"),
        settings: values.settings || {},
      });
      if (win) win.location = API_URL(`/render/${token}`);
      else window.open(API_URL(`/render/${token}`), "_blank");
    } catch (err) {
      win?.close();
      showToast(err.message || t("collectionsForm.previewError", "Could not build preview"), "error");
    } finally {
      setIsPreviewing(false);
    }
  };

  const labelWithRequired = (setting) =>
    setting.required && setting.label ? `${setting.label} *` : setting.label;

  return (
    <form onSubmit={rhfHandleSubmit(onSubmitHandler)} className="form-container">
      <div className="form-section">
        {/* Slug */}
        <div className="form-field">
          <label htmlFor="slug" className="form-label">
            {t("collectionsForm.slugLabel")} <span className="text-pink-500">*</span>
          </label>
          <div className="flex items-center">
            <span className="text-slate-500 mr-1">/</span>
            <input
              type="text"
              id="slug"
              {...register("slug", {
                required: t("collectionsForm.slugRequired"),
                validate: (value) => value.trim() !== "" || t("collectionsForm.slugNotEmpty"),
              })}
              onBlur={(e) => e.target.value && setValue("slug", formatSlug(e.target.value))}
              className="form-input flex-1"
            />
          </div>
          {errors.slug && <p className="form-error">{errors.slug.message}</p>}
          <p className="form-description">{t("collectionsForm.slugHelp")}</p>
        </div>

        {/* Schema-driven fields */}
        {allSettings.map((setting) =>
          setting.type === HEADER_TYPE ? (
            <SettingsRenderer key={setting.id} setting={setting} value={undefined} onChange={() => {}} />
          ) : (
            <SettingsRenderer
              key={setting.id}
              setting={{ ...setting, label: labelWithRequired(setting) }}
              value={settingsValues[setting.id]}
              onChange={handleSettingChange}
              error={fieldErrors[setting.id]}
            />
          ),
        )}
      </div>

      <div className="form-actions-separated justify-end">
        {onCancel && (
          <Button type="button" onClick={onCancel} variant="secondary">
            {t("collections.deleteModal.cancel")}
          </Button>
        )}
        {canPreview && (
          <Button type="button" onClick={handlePreview} variant="secondary" disabled={isPreviewing}>
            {isPreviewing ? t("collectionsForm.previewLoading", "Opening…") : t("collectionsForm.preview", "Preview")}
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting || !isDirtyProp} variant={isDirtyProp ? "dark" : "primary"}>
          {isSubmitting ? t("collectionsForm.loading") : submitLabel}
          {isDirtyProp && <span className="w-2 h-2 bg-pink-500 rounded-full -mt-2" />}
        </Button>
      </div>
    </form>
  );
}
