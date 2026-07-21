import { useState, useEffect } from "react";
import { ButtonGroup, Button, Form, Modal } from "react-bootstrap";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../api";
import { parseBackendDate } from "../utils/dates";

function formatItemLine(i) {
  const parts = [`${i.quantity}x ${i.service_name || i.product_name || "item"}`];
  if (i.service_name && i.product_name) parts.push(i.product_name);
  if (i.racket_model) parts.push(i.racket_model);
  if (i.string_tension) parts.push(i.string_tension);
  return parts.join(" · ");
}

export default function History({ onToast }) {
  const [orders, setOrders] = useState(null);
  const [filter, setFilter] = useState("all"); // "all" | "picked_up" | "cancelled"
  const [search, setSearch] = useState("");
  const [restoreOrderId, setRestoreOrderId] = useState(null);

  useEffect(() => {
    loadOrders();
  }, []);

  function loadOrders() {
    Promise.all([api.listOrders("picked_up"), api.listOrders("cancelled")]).then(([picked, cancelled]) => {
      const combined = [...picked, ...cancelled].sort((a, b) => parseBackendDate(b.created_at) - parseBackendDate(a.created_at));
      setOrders(combined);
    });
  }

  async function confirmRestore() {
    const id = restoreOrderId;
    setRestoreOrderId(null);
    try {
      await api.uncancelOrder(id);
      onToast?.("Order restored to Active (Dropped off)");
      // Remove it from this list immediately -- it's no longer picked_up/cancelled
      setOrders((prev) => prev.filter((o) => o.id !== id));
    } catch (e) {
      onToast?.(e.message);
    }
  }

  if (!orders) return <div className="text-muted text-center py-4">Loading...</div>;

  const statusFiltered = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? statusFiltered.filter((o) => {
        const name = (o.customer?.name || "").toLowerCase();
        const phone = (o.customer?.phone || "").toLowerCase();
        return name.includes(q) || phone.includes(q);
      })
    : statusFiltered;

  const pickedCount = orders.filter((o) => o.status === "picked_up").length;
  const cancelledCount = orders.filter((o) => o.status === "cancelled").length;

  return (
    <div>
      <Form.Control
        className="mb-2"
        placeholder="Search by customer name or phone..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <ButtonGroup size="sm" className="mb-3 tab-fused">
        <Button variant={filter === "all" ? "primary" : "outline-primary"} onClick={() => setFilter("all")}>
          All ({orders.length})
        </Button>
        <Button variant={filter === "picked_up" ? "primary" : "outline-primary"} onClick={() => setFilter("picked_up")}>
          Fulfilled ({pickedCount})
        </Button>
        <Button variant={filter === "cancelled" ? "primary" : "outline-primary"} onClick={() => setFilter("cancelled")}>
          Cancelled ({cancelledCount})
        </Button>
      </ButtonGroup>

      {filtered.length === 0 ? (
        <div className="text-muted text-center py-4">
          {q
            ? `No matching orders for "${search}"`
            : filter === "all" ? "No completed or cancelled orders yet" : `No ${filter === "picked_up" ? "fulfilled" : "cancelled"} orders yet`}
        </div>
      ) : (
        <AnimatePresence initial={false}>
          {filtered.map((o) => (
            <motion.div
              key={o.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <div className="card p-3 mb-3" style={{ opacity: 0.75 }}>
                <div className="d-flex justify-content-between align-items-baseline">
                  <div>
                    <div className="fw-semibold">{o.customer?.name || `Customer #${o.customer_id}`}</div>
                    <div className="text-muted small">
                      Order #{o.id} · ${o.total_price.toFixed(2)} · {
                        o.status === "cancelled"
                          ? `cancelled on ${parseBackendDate(o.cancelled_at).toLocaleDateString()}`
                          : `picked up on ${parseBackendDate(o.picked_up_at).toLocaleDateString()}`
                      }
                    </div>
                  </div>
                  <span className={`badge badge-${o.status}`}>{o.status === "cancelled" ? "Cancelled" : "Picked up"}</span>
                </div>
                <div className="text-muted small mt-1">
                  {o.items.map((i, idx) => <div key={idx}>{formatItemLine(i)}</div>)}
                </div>
                {o.status === "cancelled" && (
                  <div className="mt-2">
                    <Button size="sm" variant="outline-primary" onClick={() => setRestoreOrderId(o.id)}>
                      Restore to Active
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      )}

      <Modal show={restoreOrderId !== null} onHide={() => setRestoreOrderId(null)} centered size="sm">
        <Modal.Body>
          <p className="mb-3">
            Restore this order to <strong>Active</strong>? It'll go back to "Dropped off" status
            (since we don't track exactly which stage it was at before cancelling).
          </p>
          <div className="d-flex gap-2 justify-content-end">
            <Button size="sm" variant="secondary" onClick={() => setRestoreOrderId(null)}>Keep cancelled</Button>
            <Button size="sm" onClick={confirmRestore}>Restore</Button>
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
}