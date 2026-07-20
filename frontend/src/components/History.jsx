import { useState, useEffect } from "react";
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

  useEffect(() => {
    Promise.all([api.listOrders("picked_up"), api.listOrders("cancelled")]).then(([picked, cancelled]) => {
      const combined = [...picked, ...cancelled].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setOrders(combined);
    });
  }, []);

  if (!orders) return <div className="text-muted text-center py-4">Loading...</div>;
  if (orders.length === 0) return <div className="text-muted text-center py-4">No completed or cancelled orders yet</div>;

  return (
    <div>
      {orders.map((o) => (
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
              <div className="text-muted small mt-1">
                {o.items.map((i, idx) => <div key={idx}>{formatItemLine(i)}</div>)}
              </div>
            </div>
            <span className={`badge badge-${o.status}`}>{o.status === "cancelled" ? "Cancelled" : "Picked up"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
