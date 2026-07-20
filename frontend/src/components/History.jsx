import { useState, useEffect } from "react";
import { ButtonGroup, Button, Form } from "react-bootstrap";
import { api } from "../api";

function formatItemLine(i) {
  const parts = [`${i.quantity}x ${i.service_name || i.product_name || "item"}`];
  if (i.service_name && i.product_name) parts.push(i.product_name);
  if (i.racket_model) parts.push(i.racket_model);
  if (i.string_tension) parts.push(i.string_tension);
  return parts.join(" · ");
}

export default function History() {
  const [orders, setOrders] = useState(null);
  const [filter, setFilter] = useState("all"); // "all" | "picked_up" | "cancelled"
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([api.listOrders("picked_up"), api.listOrders("cancelled")]).then(([picked, cancelled]) => {
      const combined = [...picked, ...cancelled].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setOrders(combined);
    });
  }, []);

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

      <ButtonGroup size="sm" className="mb-3">
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
        filtered.map((o) => (
          <div key={o.id} className="card p-3 mb-3" style={{ opacity: 0.75 }}>
            <div className="d-flex justify-content-between align-items-baseline">
              <div>
                <div className="fw-semibold">{o.customer?.name || `Customer #${o.customer_id}`}</div>
                <div className="text-muted small">
                  Order #{o.id} · ${o.total_price.toFixed(2)} · {
                    o.status === "cancelled"
                      ? `cancelled ${new Date(o.cancelled_at).toLocaleDateString()}`
                      : `picked up ${new Date(o.picked_up_at).toLocaleDateString()}`
                  }
                </div>
              </div>
              <span className={`badge badge-${o.status}`}>{o.status === "cancelled" ? "Cancelled" : "Picked up"}</span>
            </div>
            <div className="text-muted small mt-1">
              {o.items.map((i, idx) => <div key={idx}>{formatItemLine(i)}</div>)}
            </div>
          </div>
        ))
      )}
    </div>
  );
}