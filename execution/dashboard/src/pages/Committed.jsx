import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { apiFetch, apiPut } from "../api";
import DataTable from "../components/DataTable";
import StatusBadge from "../components/StatusBadge";
import { SkeletonTable } from "../components/LoadingSkeleton";
import EmptyState from "../components/EmptyState";
import { CreditCard, ExternalLink, X } from "lucide-react";
import { formatDateTime } from "../constants";

// ─── Email status badge ───────────────────────────────────────────────────────

function EmailStatusBadge({ leadId, emails }) {
  const record = emails.find((e) => e.lead_id === leadId);

  if (!record) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border bg-zinc-500/10 border-zinc-500/20 text-zinc-500">
        Not sent
      </span>
    );
  }

  if (record.delivery_status === "delivered") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border bg-green-500/15 border-green-500/30 text-green-400">
        Sent
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border bg-red-500/15 border-red-500/30 text-red-400">
      Failed
    </span>
  );
}

// ─── Payment modal ─────────────────────────────────────────────────────────────

function PaymentModal({ lead, onClose, onSuccess }) {
  const today = new Date().toISOString().slice(0, 10);

  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("GBP");
  const [paymentDate, setPaymentDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const inputCls =
    "w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/60 placeholder-zinc-600";

  async function handleSubmit(e) {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError("Please enter a valid amount.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiPut(`/leads/${lead.id}/payment`, {
        amount: Number(amount),
        currency,
        payment_date: paymentDate,
        notes,
      });
      onSuccess();
    } catch (err) {
      setError(err.message || "Failed to record payment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="glass-card p-6 w-full max-w-md z-50">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-orange-400" />
            <h2 id="modal-title" className="text-sm font-semibold text-zinc-100">
              Mark Payment
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Lead name — read only */}
          <div>
            <label className="block text-xs label-mono text-zinc-500 mb-1">Lead</label>
            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-400 select-none">
              {lead.name || "—"}
            </div>
          </div>

          {/* Programme — read only */}
          <div>
            <label className="block text-xs label-mono text-zinc-500 mb-1">Programme</label>
            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-400 select-none">
              {lead.programme_recommended || "—"}
            </div>
          </div>

          {/* Amount + currency — side by side */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label htmlFor="payment-amount" className="block text-xs label-mono text-zinc-500 mb-1">
                Amount
              </label>
              <input
                id="payment-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={inputCls}
                required
              />
            </div>
            <div className="w-28">
              <label htmlFor="payment-currency" className="block text-xs label-mono text-zinc-500 mb-1">
                Currency
              </label>
              <select
                id="payment-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={inputCls}
              >
                <option value="GBP">GBP</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="NGN">NGN</option>
              </select>
            </div>
          </div>

          {/* Payment date */}
          <div>
            <label htmlFor="payment-date" className="block text-xs label-mono text-zinc-500 mb-1">
              Payment Date
            </label>
            <input
              id="payment-date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className={inputCls}
              required
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="payment-notes" className="block text-xs label-mono text-zinc-500 mb-1">
              Notes
              <span className="ml-1 text-zinc-600">(optional)</span>
            </label>
            <textarea
              id="payment-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. bank transfer, reference #..."
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400 font-mono bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
            >
              <CreditCard className="w-3.5 h-3.5" />
              {submitting ? "Saving…" : "Confirm Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function Committed() {
  const [leads, setLeads] = useState([]);
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);

  // Sorting
  const [sortBy, setSortBy] = useState("updated_at");
  const [sortOrder, setSortOrder] = useState("desc");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [committedRes, pendingRes, emailsRes] = await Promise.all([
        apiFetch("/leads?status=committed&per_page=100"),
        apiFetch("/leads?status=payment_pending&per_page=100"),
        apiFetch("/post-call/emails"),
      ]);

      const combined = [
        ...(committedRes.leads ?? committedRes.data ?? []),
        ...(pendingRes.leads ?? pendingRes.data ?? []),
      ];
      setLeads(combined);
      setEmails(emailsRes.emails ?? []);
    } catch (err) {
      setError(err.message || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Dismiss success banner after 4 s
  useEffect(() => {
    if (!successBanner) return;
    const timer = setTimeout(() => setSuccessBanner(null), 4000);
    return () => clearTimeout(timer);
  }, [successBanner]);

  function handleSort(key) {
    if (sortBy === key) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortOrder("desc");
    }
  }

  // Client-side sort
  const sorted = [...leads].sort((a, b) => {
    const av = a[sortBy] ?? "";
    const bv = b[sortBy] ?? "";
    const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
    return sortOrder === "asc" ? cmp : -cmp;
  });

  const columns = [
    {
      key: "name",
      label: "Name",
      sortable: true,
      render: (v, row) => (
        <span className="font-medium text-zinc-200">{v || "—"}</span>
      ),
    },
    {
      key: "programme_recommended",
      label: "Programme",
      sortable: false,
      render: (v) => v || "—",
    },
    {
      key: "updated_at",
      label: "Date Committed",
      sortable: true,
      render: (v) => (
        <span className="tabular-nums text-zinc-400">{formatDateTime(v)}</span>
      ),
    },
    {
      key: "email_status",
      label: "Payment Email",
      sortable: false,
      render: (_v, row) => <EmailStatusBadge leadId={row.id} emails={emails} />,
    },
    {
      key: "status",
      label: "Status",
      sortable: false,
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: "actions",
      label: "",
      sortable: false,
      render: (_v, row) => (
        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={() => setSelectedLead(row)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-orange-500/15 border border-orange-500/25 text-orange-400 hover:bg-orange-500/25 transition-colors whitespace-nowrap"
          >
            <CreditCard className="w-3 h-3" />
            Mark Paid
          </button>
          <Link
            to={`/leads/${row.id}`}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/40 transition-colors whitespace-nowrap"
          >
            <ExternalLink className="w-3 h-3" />
            View Lead
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-50">Committed Leads</h1>
          <p className="text-xs text-zinc-600 mt-0.5">
            {loading
              ? "Loading…"
              : `${leads.length} lead${leads.length !== 1 ? "s" : ""} committed or pending payment`}
          </p>
        </div>

        {error && (
          <span className="text-xs text-red-400 font-mono bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg">
            {error}
          </span>
        )}
      </div>

      {/* Success banner */}
      {successBanner && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/25 text-green-400 text-sm">
          <CreditCard className="w-4 h-4 flex-shrink-0" />
          <span>{successBanner}</span>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="ml-auto text-green-600 hover:text-green-400 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="glass-card px-4 py-3">
          <SkeletonTable rows={8} />
        </div>
      ) : leads.length === 0 ? (
        <div className="glass-card">
          <EmptyState
            title="No committed leads yet"
            message="Leads who commit on a call will appear here, ready for payment tracking."
          />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={sorted}
          total={sorted.length}
          page={1}
          perPage={sorted.length}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          loading={false}
          emptyMessage="No committed leads"
        />
      )}

      {/* Payment modal */}
      {selectedLead && (
        <PaymentModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onSuccess={() => {
            setSelectedLead(null);
            setSuccessBanner(`Payment recorded for ${selectedLead.name || "lead"}.`);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
