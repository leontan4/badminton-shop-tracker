import { useState } from "react";
import { Button, Dropdown, Modal, Collapse } from "react-bootstrap";
import EditItemsPanel from "./EditItemsPanel";
import { api } from "../api";
import { timeAgo } from "../utils/dates";

const STATUS_LABEL = {
  dropped_off: "Dropped off",
  in_progress: "In progress",
  ready_pending_confirm: "Confirm & send?",
  ready: "Ready — notified",
  picked_up: "Picked up",
  cancelled: "Cancelled",
};

function formatItemLine(i) {
  const parts = [`${i.quantity}x ${i.service_name || i.product_name || "item"}`];
  if (i.service_name && i.product_name) parts.push(i.product_name);
  if (i.racket_model) parts.push(i.racket_model);
  if (i.string_tension) parts.push(i.string_tension);
  return parts.join(" · ");
}

// Primary status-progression action stays inline on the card (used
// constantly). Rarer actions (Edit items, Cancel order) live behind a
// small "⋮" menu instead of always being visible.
export default function OrderCard({ order, services, products, racketModels, onNewRacketModel, onRefresh, onToast, editing, isEditing, faded }) {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);

  async function doAction(action, method = "PATCH") {
    try {
      await action();
      onRefresh();
    } catch (e) {
      onToast(e.message);
    }
  }

  async function confirmCancelOrder() {
    setShowCancelConfirm(false);
    setTimeout(() => doAction(() => api.cancelOrder(order.id)), 200);
  }

  async function confirmRevertReady() {
    setShowRevertConfirm(false);
    setTimeout(() => doAction(() => api.revertReady(order.id)), 200);
  }

  const canEditOrCancel = order.status === "dropped_off" || order.status === "in_progress";

  return (
    <div className="card p-3 mb-3" style={{ opacity: faded ? 0.75 : 1 }}>
      <div className="d-flex justify-content-between align-items-baseline">
        <div className="flex-grow-1" style={{ minWidth: 0 }}>
          <div className="fw-semibold">{order.customer?.name || `Customer #${order.customer_id}`}</div>
          <div className="text-muted small">Order #{order.id} · ${order.total_price.toFixed(2)} · {order.customer?.phone}</div>
        </div>
        <div className="d-flex align-items-center gap-2 flex-shrink-0 ms-2">
          <span className={`badge badge-${order.status}`}>{STATUS_LABEL[order.status]}</span>
          {!faded && canEditOrCancel && (
            <Dropdown align="end">
              <Dropdown.Toggle as="span" bsPrefix="menu-dots" className="menu-dots-toggle">⋮</Dropdown.Toggle>
              <Dropdown.Menu>
                <Dropdown.Item onClick={() => editing(isEditing ? null : order.id)}>Edit items</Dropdown.Item>
                <Dropdown.Item className="text-danger" onClick={() => setShowCancelConfirm(true)}>Cancel order</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          )}
        </div>
      </div>

      {/* Full card width now, not squeezed by the badge/menu column above */}
      <div className="text-muted small mt-1">
        {order.status === "ready" || order.status === "ready_pending_confirm"
          ? `Ready ${timeAgo(order.ready_at || order.created_at)}`
          : `Dropped off ${timeAgo(order.created_at)}`}
      </div>
      <div className="text-muted small">
        {order.items.map((i, idx) => <div key={idx}>{formatItemLine(i)}</div>)}
      </div>

      <Collapse in={order.status === "ready_pending_confirm"}>
        <div>
          <div className="mt-2 p-2 bg-mint border-dashed rounded small">
            Will text <strong>{order.customer?.phone}</strong>:<br />
            <em>"Hi {order.customer?.name}, your racket (order #{order.id}) is ready for pickup! See you soon."</em>
          </div>
        </div>
      </Collapse>

      {!faded && (
        <div className="mt-2 d-flex gap-2 flex-wrap">
          {order.status === "dropped_off" && <Button size="sm" onClick={() => doAction(() => api.startOrder(order.id))}>Start job</Button>}
          {order.status === "in_progress" && <Button size="sm" onClick={() => doAction(() => api.markReady(order.id))}>Mark ready</Button>}
          {order.status === "ready_pending_confirm" && <>
            <Button size="sm" onClick={() => doAction(() => api.sendNotification(order.id), "POST")}>Confirm & Send SMS</Button>
            <Button size="sm" variant="secondary" onClick={() => doAction(() => api.cancelReady(order.id))}>Cancel, keep working</Button>
          </>}
          {order.status === "ready" && <>
            <Button size="sm" onClick={() => doAction(() => api.pickupOrder(order.id))}>Mark picked up</Button>
            <Button size="sm" variant="outline-primary" onClick={() => doAction(() => api.sendNotification(order.id), "POST")}>Resend text</Button>
            <Button size="sm" variant="secondary" onClick={() => setShowRevertConfirm(true)}>Revert (marked ready by mistake)</Button>
          </>}
        </div>
      )}

      {canEditOrCancel && (
        <EditItemsPanel
          order={order}
          open={!!isEditing}
          services={services}
          products={products}
          racketModels={racketModels}
          onNewRacketModel={onNewRacketModel}
          onClose={() => editing(null)}
          onSaved={() => { editing(null); onRefresh(); }}
          onToast={onToast}
        />
      )}

      <Modal show={showCancelConfirm} onHide={() => setShowCancelConfirm(false)} centered size="sm">
        <Modal.Body>
          <p className="mb-3">Cancel this order? This can't be undone.</p>
          <div className="d-flex gap-2 justify-content-end">
            <Button size="sm" variant="secondary" onClick={() => setShowCancelConfirm(false)}>Keep order</Button>
            <Button size="sm" variant="danger" onClick={confirmCancelOrder}>Cancel order</Button>
          </div>
        </Modal.Body>
      </Modal>

      <Modal show={showRevertConfirm} onHide={() => setShowRevertConfirm(false)} centered>
        <Modal.Body>
          <p className="mb-3">
            This moves the order back to <strong>In progress</strong> — but it can <strong>NOT</strong> un-send
            a text message that already reached the customer's phone. Only use this if you clicked
            "Confirm & Send" by mistake and know the customer hasn't been notified, or you're okay
            following up with them directly.
          </p>
          <div className="d-flex gap-2 justify-content-end">
            <Button size="sm" variant="secondary" onClick={() => setShowRevertConfirm(false)}>Keep as ready</Button>
            <Button size="sm" variant="danger" onClick={confirmRevertReady}>Revert anyway</Button>
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
}