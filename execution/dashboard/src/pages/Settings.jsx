import { useState, useEffect, useCallback } from "react";
import { apiFetch, apiPost, apiPut, apiDelete } from "../api";
import { useInterval } from "../hooks/useInterval";
import { SkeletonCard, SkeletonTable } from "../components/LoadingSkeleton";
import EmptyState from "../components/EmptyState";
import { Plus, Pencil, Trash2, Save, X } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { key: "general", label: "General" },
  { key: "schedules", label: "Schedules" },
  { key: "templates", label: "Templates" },
  { key: "prompt", label: "John's Prompt" },
  { key: "costs", label: "Cost Tracker" },
];

const TIMEZONES = [
  "Europe/London", "Europe/Paris", "Europe/Berlin",
  "America/New_York", "America/Chicago", "America/Los_Angeles",
  "Africa/Lagos", "Africa/Nairobi", "Asia/Dubai",
  "Asia/Kolkata", "Asia/Singapore", "Australia/Sydney",
];

const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
];

const SAMPLE_DATA = {
  first_name: "John Doe",
  booking_link: "https://cal.example.com",
};

const INPUT_CLS =
  "bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 w-full";
const LABEL_CLS = "label-mono block mb-2 text-zinc-500 text-xs";
const TEXTAREA_CLS =
  "bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 w-full min-h-[120px] resize-y";

// ─── Shared helpers ───────────────────────────────────────────────────────────

function TabButton({ tab, active, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(tab.key)}
      className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 focus:outline-none ${
        active
          ? "border-orange-500 text-orange-400"
          : "border-transparent text-zinc-500 hover:text-zinc-300"
      }`}
    >
      {tab.label}
    </button>
  );
}

function SaveButton({ loading, label = "Save", onClick }) {
  return (
    <button
      type="button"
      disabled={loading}
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 text-sm font-medium hover:bg-orange-500/25 transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Save className="w-4 h-4" />
      {loading ? "Saving…" : label}
    </button>
  );
}

function SuccessBanner({ message }) {
  if (!message) return null;
  return (
    <div className="px-4 py-2.5 rounded-lg bg-green-500/10 border border-green-500/25 text-green-400 text-xs font-mono">
      {message}
    </div>
  );
}

function ErrorBanner({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-mono flex items-center justify-between">
      <span>{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="ml-4 underline hover:no-underline"
        >
          Retry
        </button>
      )}
    </div>
  );
}

// ─── Tab 1: General ───────────────────────────────────────────────────────────

function GeneralTab() {
  const [form, setForm] = useState({
    daily_call_cap: "",
    dialer_rate_limit: "",
    cal_booking_link: "",
    warm_transfer_number: "",
    timeout_hours: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  const fetchSettings = useCallback(() => {
    setLoading(true);
    apiFetch("/settings")
      .then((data) => {
        setForm({
          daily_call_cap: data.daily_call_cap ?? "",
          dialer_rate_limit: data.dialer_rate_limit ?? "",
          cal_booking_link: data.cal_booking_link ?? "",
          warm_transfer_number: data.warm_transfer_number ?? "",
          timeout_hours: data.timeout_hours ?? "",
        });
        setError(null);
      })
      .catch((err) => setError(err.message || "Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSuccess(null);
  }

  async function handleSave() {
    setSaving(true);
    setSuccess(null);
    setError(null);
    try {
      await apiPut("/settings", form);
      setSuccess("Settings saved. Some changes require a server restart to take effect.");
    } catch (err) {
      setError(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((n) => (
          <SkeletonCard key={n} className="h-16" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl">
      <ErrorBanner message={error} onRetry={fetchSettings} />
      <SuccessBanner message={success} />

      {/* Daily call cap */}
      <div>
        <label className={LABEL_CLS}>Daily Call Cap</label>
        <input
          type="number"
          min="1"
          className={INPUT_CLS}
          value={form.daily_call_cap}
          onChange={(e) => handleChange("daily_call_cap", e.target.value)}
          placeholder="e.g. 100"
        />
        <p className="mt-1 text-xs text-zinc-600 font-mono">
          Maximum number of outbound calls per day.
        </p>
      </div>

      {/* Dialer rate limit */}
      <div>
        <label className={LABEL_CLS}>Dialer Rate Limit (calls/hour)</label>
        <input
          type="number"
          min="1"
          className={INPUT_CLS}
          value={form.dialer_rate_limit}
          onChange={(e) => handleChange("dialer_rate_limit", e.target.value)}
          placeholder="e.g. 30"
        />
        <p className="mt-1 text-xs text-zinc-600 font-mono">
          Maximum calls initiated per hour by the auto-dialer.
        </p>
      </div>

      {/* Cal.com booking link */}
      <div>
        <label className={LABEL_CLS}>Cal.com Booking Link</label>
        <input
          type="text"
          className={INPUT_CLS}
          value={form.cal_booking_link}
          onChange={(e) => handleChange("cal_booking_link", e.target.value)}
          placeholder="https://cal.example.com/john"
        />
        <p className="mt-1 text-xs text-zinc-600 font-mono">
          Shared in outreach emails and WhatsApp messages.
        </p>
      </div>

      {/* Warm transfer number */}
      <div>
        <label className={LABEL_CLS}>Warm Transfer Number</label>
        <input
          type="tel"
          className={INPUT_CLS}
          value={form.warm_transfer_number}
          onChange={(e) => handleChange("warm_transfer_number", e.target.value)}
          placeholder="+44 7700 900000"
        />
        <p className="mt-1 text-xs text-zinc-600 font-mono">
          Number John dials when escalating a call to a human.
        </p>
      </div>

      {/* 48h timeout threshold */}
      <div>
        <label className={LABEL_CLS}>Outreach Timeout Threshold (hours)</label>
        <input
          type="number"
          min="1"
          className={INPUT_CLS}
          value={form.timeout_hours}
          onChange={(e) => handleChange("timeout_hours", e.target.value)}
          placeholder="48"
        />
        <p className="mt-1 text-xs text-zinc-600 font-mono">
          Leads with no reply after this window are escalated to a cold call.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 pt-2">
        <SaveButton loading={saving} onClick={handleSave} />
        <p className="text-xs text-zinc-600 font-mono italic">
          Some settings require a server restart to take effect.
        </p>
      </div>
    </div>
  );
}

// ─── Tab 2: Dial Schedules ────────────────────────────────────────────────────

const BLANK_SCHEDULE = {
  name: "",
  start_time: "09:00",
  end_time: "17:00",
  timezone: "Europe/London",
  days_of_week: [1, 2, 3, 4, 5],
  is_active: true,
};

function ScheduleForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial ?? BLANK_SCHEDULE);

  function toggleDay(val) {
    setForm((prev) => {
      const days = prev.days_of_week.includes(val)
        ? prev.days_of_week.filter((d) => d !== val)
        : [...prev.days_of_week, val].sort((a, b) => a - b);
      return { ...prev, days_of_week: days };
    });
  }

  return (
    <div className="rounded-lg border border-zinc-700/60 bg-zinc-900/60 p-5 space-y-4">
      {/* Name */}
      <div>
        <label className={LABEL_CLS}>Schedule Name</label>
        <input
          type="text"
          className={INPUT_CLS}
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          placeholder="e.g. UK Business Hours"
        />
      </div>

      {/* Time window */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL_CLS}>Start Time</label>
          <input
            type="time"
            className={INPUT_CLS}
            value={form.start_time}
            onChange={(e) => setForm((p) => ({ ...p, start_time: e.target.value }))}
          />
        </div>
        <div>
          <label className={LABEL_CLS}>End Time</label>
          <input
            type="time"
            className={INPUT_CLS}
            value={form.end_time}
            onChange={(e) => setForm((p) => ({ ...p, end_time: e.target.value }))}
          />
        </div>
      </div>

      {/* Timezone */}
      <div>
        <label className={LABEL_CLS}>Timezone</label>
        <select
          className={INPUT_CLS}
          value={form.timezone}
          onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))}
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </div>

      {/* Days of week */}
      <div>
        <label className={LABEL_CLS}>Days of Week</label>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((day) => {
            const active = form.days_of_week.includes(day.value);
            return (
              <button
                key={day.value}
                type="button"
                onClick={() => toggleDay(day.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors focus:outline-none ${
                  active
                    ? "bg-orange-500/20 border-orange-500/40 text-orange-400"
                    : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600"
                }`}
              >
                {day.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active toggle */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={form.is_active}
          onClick={() => setForm((p) => ({ ...p, is_active: !p.is_active }))}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
            form.is_active ? "bg-orange-500/70" : "bg-zinc-700"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              form.is_active ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
        <span className="text-xs text-zinc-400 font-mono">
          {form.is_active ? "Active" : "Inactive"}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave(form)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 text-sm font-medium hover:bg-orange-500/25 transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving…" : "Save Schedule"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm font-medium hover:text-zinc-200 hover:border-zinc-600 transition-colors focus:outline-none"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
      </div>
    </div>
  );
}

function ScheduleRow({ schedule, onEdit, onDelete }) {
  const daysLabel =
    schedule.days_of_week && schedule.days_of_week.length > 0
      ? schedule.days_of_week
          .map((v) => DAYS.find((d) => d.value === v)?.label ?? v)
          .join(", ")
      : "—";

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3.5 rounded-lg border border-zinc-800 bg-white/[0.02] hover:bg-white/[0.03] transition-colors">
      {/* Name + active badge */}
      <div className="flex items-center gap-2 min-w-[160px]">
        <span className="text-zinc-200 font-medium text-sm">{schedule.name || "Unnamed"}</span>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded-full border font-mono ${
            schedule.is_active
              ? "bg-green-500/10 border-green-500/25 text-green-400"
              : "bg-zinc-700/40 border-zinc-600/30 text-zinc-500"
          }`}
        >
          {schedule.is_active ? "Active" : "Paused"}
        </span>
      </div>

      {/* Time window */}
      <span className="text-zinc-400 text-xs font-mono">
        {schedule.start_time ?? "—"} – {schedule.end_time ?? "—"}
      </span>

      {/* Timezone */}
      <span className="text-zinc-500 text-xs font-mono">{schedule.timezone ?? "—"}</span>

      {/* Days */}
      <span className="text-zinc-500 text-xs font-mono flex-1">{daysLabel}</span>

      {/* Actions */}
      <div className="flex items-center gap-2 ml-auto">
        <button
          type="button"
          onClick={() => onEdit(schedule)}
          className="p-1.5 rounded-lg border border-zinc-700/50 text-zinc-500 hover:text-zinc-200 hover:border-zinc-600 transition-colors focus:outline-none"
          title="Edit schedule"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(schedule.id)}
          className="p-1.5 rounded-lg border border-zinc-700/50 text-zinc-500 hover:text-red-400 hover:border-red-500/40 transition-colors focus:outline-none"
          title="Delete schedule"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function SchedulesTab() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // editing: null | "new" | schedule object (for edit)
  const [editing, setEditing] = useState(null);

  const fetchSchedules = useCallback(() => {
    setLoading(true);
    apiFetch("/schedules")
      .then((data) => {
        setSchedules(data.schedules ?? []);
        setError(null);
      })
      .catch((err) => setError(err.message || "Failed to load schedules"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  async function handleSave(form) {
    setSaving(true);
    try {
      if (editing === "new") {
        await apiPost("/schedules", form);
      } else {
        await apiPut(`/schedules/${editing.id}`, form);
      }
      setEditing(null);
      fetchSchedules();
    } catch (err) {
      setError(err.message || "Failed to save schedule");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this schedule?")) return;
    try {
      await apiDelete(`/schedules/${id}`);
      fetchSchedules();
    } catch (err) {
      setError(err.message || "Failed to delete schedule");
    }
  }

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} onRetry={fetchSchedules} />

      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500 font-mono">
          {schedules.length} schedule{schedules.length !== 1 ? "s" : ""} configured
        </p>
        {editing === null && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 text-sm font-medium hover:bg-orange-500/25 transition-colors focus:outline-none"
          >
            <Plus className="w-4 h-4" />
            Add Schedule
          </button>
        )}
      </div>

      {/* New schedule form */}
      {editing === "new" && (
        <ScheduleForm
          initial={BLANK_SCHEDULE}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
          saving={saving}
        />
      )}

      {/* Schedule list */}
      {loading ? (
        <SkeletonTable rows={3} />
      ) : schedules.length === 0 && editing !== "new" ? (
        <EmptyState
          title="No schedules yet"
          message="Add a schedule to control when John makes outbound calls."
        />
      ) : (
        <div className="space-y-2">
          {schedules.map((s) =>
            editing && editing !== "new" && editing.id === s.id ? (
              <ScheduleForm
                key={s.id}
                initial={editing}
                onSave={handleSave}
                onCancel={() => setEditing(null)}
                saving={saving}
              />
            ) : (
              <ScheduleRow
                key={s.id}
                schedule={s}
                onEdit={(sched) => setEditing(sched)}
                onDelete={handleDelete}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab 3: Message Templates ─────────────────────────────────────────────────

function renderTemplate(text, data) {
  if (!text) return "";
  return text
    .replace(/\{first_name\}/g, data.first_name)
    .replace(/\{booking_link\}/g, data.booking_link);
}

function TemplatesTab() {
  const [form, setForm] = useState({
    whatsapp_template: "",
    email_subject: "",
    email_body: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  const fetchTemplates = useCallback(() => {
    setLoading(true);
    apiFetch("/templates")
      .then((data) => {
        setForm({
          whatsapp_template: data.whatsapp_template ?? "",
          email_subject: data.email_subject ?? "",
          email_body: data.email_body ?? "",
        });
        setError(null);
      })
      .catch((err) => setError(err.message || "Failed to load templates"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSuccess(null);
  }

  async function handleSave() {
    setSaving(true);
    setSuccess(null);
    setError(null);
    try {
      await apiPut("/templates", form);
      setSuccess("Templates saved successfully.");
    } catch (err) {
      setError(err.message || "Failed to save templates");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((n) => (
          <SkeletonCard key={n} className="h-28" />
        ))}
      </div>
    );
  }

  const mergeHint = (
    <span className="text-zinc-600 font-mono text-xs">
      Available merge tags:{" "}
      <code className="text-zinc-500">{"{first_name}"}</code>{" "}
      <code className="text-zinc-500">{"{booking_link}"}</code>
    </span>
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
      {/* Editor column */}
      <div className="space-y-6">
        <ErrorBanner message={error} onRetry={fetchTemplates} />
        <SuccessBanner message={success} />

        {/* WhatsApp template */}
        <div>
          <label className={LABEL_CLS}>WhatsApp Template</label>
          <textarea
            className={TEXTAREA_CLS}
            value={form.whatsapp_template}
            onChange={(e) => handleChange("whatsapp_template", e.target.value)}
            placeholder={`Hi {first_name}, I wanted to share our cloud training programme with you.\n\nBook a call here: {booking_link}`}
          />
          <div className="mt-1">{mergeHint}</div>
        </div>

        {/* Email subject */}
        <div>
          <label className={LABEL_CLS}>Email Subject</label>
          <input
            type="text"
            className={INPUT_CLS}
            value={form.email_subject}
            onChange={(e) => handleChange("email_subject", e.target.value)}
            placeholder="Quick question about your cloud career, {first_name}"
          />
        </div>

        {/* Email body */}
        <div>
          <label className={LABEL_CLS}>Email Body</label>
          <textarea
            className={TEXTAREA_CLS}
            style={{ minHeight: "180px" }}
            value={form.email_body}
            onChange={(e) => handleChange("email_body", e.target.value)}
            placeholder={`Hi {first_name},\n\nI'm reaching out about Cloudboosta's cloud & DevOps training programme...\n\nBook a free call: {booking_link}`}
          />
          <div className="mt-1">{mergeHint}</div>
        </div>

        <SaveButton loading={saving} onClick={handleSave} label="Save Templates" />
      </div>

      {/* Preview column */}
      <div className="space-y-5">
        <h3 className="label-mono text-zinc-500 text-xs uppercase tracking-widest">
          Preview — sample data
        </h3>

        {/* WhatsApp preview */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-2">
          <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
            WhatsApp
          </p>
          <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
            {renderTemplate(form.whatsapp_template, SAMPLE_DATA) || (
              <span className="italic text-zinc-600">No template</span>
            )}
          </p>
        </div>

        {/* Email preview */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
          <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
            Email
          </p>
          <div className="border-b border-zinc-800 pb-2">
            <span className="text-[10px] text-zinc-600 font-mono mr-2">Subject:</span>
            <span className="text-sm text-zinc-300">
              {renderTemplate(form.email_subject, SAMPLE_DATA) || (
                <span className="italic text-zinc-600">No subject</span>
              )}
            </span>
          </div>
          <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
            {renderTemplate(form.email_body, SAMPLE_DATA) || (
              <span className="italic text-zinc-600">No body</span>
            )}
          </p>
        </div>

        <p className="text-[11px] text-zinc-700 font-mono italic">
          Preview uses first_name=&quot;{SAMPLE_DATA.first_name}&quot; and a sample booking link.
        </p>
      </div>
    </div>
  );
}

// ─── Tab 4: John's Prompt ─────────────────────────────────────────────────────

const PLACEHOLDER_PROMPT = `You are John, an AI sales agent for Cloudboosta. Your job is to call leads, qualify them, and close them into the right cloud/DevOps training programme.

Tone: professional, warm, direct. Never pushy. Listen more than you talk.

When a lead answers:
1. Introduce yourself: "Hi, is this [name]? Great — I'm John calling from Cloudboosta..."
2. Qualify: ask about their current role, cloud experience, goals.
3. Recommend the right programme based on their answers.
4. Handle objections using the closing strategies.
5. Close: confirm commitment and next steps.

Always check call history before speaking. Never treat a returning lead as a first-time contact.`;

function PromptTab() {
  return (
    <div className="space-y-5 max-w-2xl">
      <div className="px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-mono">
        This feature will connect to the Retell API in a future update. The prompt below is read-only.
      </div>

      <div>
        <label className={LABEL_CLS}>John's System Prompt</label>
        <textarea
          className={`${TEXTAREA_CLS} opacity-70 cursor-not-allowed`}
          style={{ minHeight: "320px" }}
          value={PLACEHOLDER_PROMPT}
          readOnly
        />
      </div>

      <p className="text-xs text-zinc-600 font-mono">
        Full prompt editing via Retell API is planned for a future release.
        Changes to the prompt will require a Retell agent update.
      </p>
    </div>
  );
}

// ─── Tab 5: Cost Tracker ──────────────────────────────────────────────────────

function CostTrackerTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchCosts = useCallback(() => {
    apiFetch("/analytics/costs")
      .then((res) => {
        setData(res);
        setError(null);
        setLastRefresh(new Date());
      })
      .catch((err) => setError(err.message || "Failed to load cost data"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchCosts();
  }, [fetchCosts]);

  // Auto-refresh every 60 seconds
  useInterval(fetchCosts, 60_000);

  const components = data?.components ?? [];
  const total = data?.total_estimated ?? null;

  function formatCost(n) {
    if (n == null) return "—";
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(n);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-medium text-zinc-300">Cost Breakdown — This Month</h3>
          {lastRefresh && (
            <p className="text-xs text-zinc-600 font-mono mt-0.5">
              Last refreshed {lastRefresh.toLocaleTimeString()} · auto-refreshes every 60s
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={fetchCosts}
          className="px-3 py-1.5 rounded-lg border border-zinc-700/50 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors focus:outline-none font-mono"
        >
          Refresh
        </button>
      </div>

      <ErrorBanner message={error} onRetry={fetchCosts} />

      {loading ? (
        <SkeletonTable rows={6} />
      ) : components.length === 0 ? (
        <EmptyState
          title="No cost data"
          message="Cost tracking data appears once the agent has made calls or sent outreach."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 font-mono">
                  Component
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 font-mono">
                  Unit
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 font-mono">
                  Unit Cost
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 font-mono">
                  Usage (This Month)
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 font-mono">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {components.map((row, i) => (
                <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-zinc-200">
                    <span className="font-medium">{row.name}</span>
                    {row.note && (
                      <p className="text-[11px] text-zinc-600 font-mono mt-0.5">{row.note}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs font-mono">{row.unit ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-zinc-400 font-mono text-xs tabular-nums">
                    {formatCost(row.unit_cost)}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-400 font-mono text-xs tabular-nums">
                    {row.usage != null ? row.usage.toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs tabular-nums font-semibold text-zinc-200">
                    {formatCost(row.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            {total != null && (
              <tfoot>
                <tr className="border-t border-zinc-700/60 bg-zinc-900/40">
                  <td colSpan={4} className="px-4 py-3 text-sm font-medium text-zinc-300">
                    Total Estimated
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm tabular-nums font-bold text-orange-400">
                    {formatCost(total)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────

export default function Settings() {
  const [activeTab, setActiveTab] = useState("general");

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-50">Settings</h1>
        <p className="text-xs text-zinc-600 mt-0.5">
          Configure John's calling behaviour, schedules, templates, and more.
        </p>
      </div>

      {/* Tab panel */}
      <div className="glass-card overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-glass-border px-2 overflow-x-auto">
          {TABS.map((tab) => (
            <TabButton
              key={tab.key}
              tab={tab}
              active={activeTab === tab.key}
              onClick={setActiveTab}
            />
          ))}
        </div>

        {/* Tab content */}
        <div className="p-6">
          {activeTab === "general" && <GeneralTab />}
          {activeTab === "schedules" && <SchedulesTab />}
          {activeTab === "templates" && <TemplatesTab />}
          {activeTab === "prompt" && <PromptTab />}
          {activeTab === "costs" && <CostTrackerTab />}
        </div>
      </div>
    </div>
  );
}
