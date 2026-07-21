import { useState, useRef } from "react";
import { Button, Card, Form, Modal } from "react-bootstrap";
import { AnimatePresence, motion } from "framer-motion";
import LineItemRow from "./LineItemRow";
import CustomerSearch from "./CustomerSearch";
import { api } from "../api";
import { timeAgo } from "../utils/dates";

export default function NewOrderForm({ services, products, racketModels, onNewRacketModel, onOrderCreated, onToast }) {
  const [tab, setTab] = useState("search"); // "search" | "new" -- lifted here so Line items can hide during "new"
  const [customer, setCustomer] = useState(null);
  const [lines, setLines] = useState([]);
  const [lineData, setLineData] = useState({});
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [duplicateOrder, setDuplicateOrder] = useState(null);
  const nextLineId = useRef(0);

  function selectCustomer(c) {
    setCustomer(c);
    if (lines.length === 0) addLine();
  }

  function clearSelection() {
    setCustomer(null);
    setLines([]);
    setLineData({});
    setReviewing(false);
  }

  function addLine() {
    const id = nextLineId.current++;
    setLines((l) => [...l, id]);
  }

  function removeLine(id) {
    setLines((l) => l.filter((x) => x !== id));
    setLineData((d) => { const copy = { ...d }; delete copy[id]; return copy; });
  }

  function updateLine(id, data) {
    setLineData((d) => ({ ...d, [id]: data }));
  }

  const total = lines.reduce((sum, id) => {
    const d = lineData[id];
    return sum + (d ? d.quantity * d.price : 0);
  }, 0);

  const hasValidLine = lines.some((id) => lineData[id]?.serviceId);

  async function resolveItemsForSubmit() {
    const items = [];
    for (const id of lines) {
      const d = lineData[id];
      if (!d || !d.serviceId) continue;
      const item = { service_id: d.serviceId, quantity: d.quantity, price_charged: d.price };
      if (d.mode) {
        if (d.racketModel) item.racket_model = d.racketModel;
        if (d.tension) item.string_tension = d.tension;
        if (d.productSel === "__other__" && d.productOther) {
          const created = await api.createProduct({ name: d.productOther, category: d.mode, cost_to_shop: 0, price_to_customer: 0 });
          item.product_id = created.id;
        } else if (d.productSel) {
          item.product_id = Number(d.productSel);
        }
      }
      items.push(item);
    }
    return items;
  }

  async function checkAndSubmit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const existingOrders = await api.listOrders();
      const dup = existingOrders.find(
        (o) => o.customer_id === customer.id &&
          ["dropped_off", "in_progress"].includes(o.status)
      );
      if (dup) {
        setSubmitting(false);
        setDuplicateOrder(dup); // opens the confirm modal below; doCreateOrder runs if they proceed
        return;
      }
      await doCreateOrder();
    } catch (e) {
      onToast(e.message);
      setSubmitting(false);
    }
  }

  async function doCreateOrder() {
    setSubmitting(true);
    try {
      const items = await resolveItemsForSubmit();
      if (items.length === 0) { onToast("Add at least one line item"); return; }

      await api.createOrder({ customer_id: customer.id, items });
      onToast("Order created");
      setCustomer(null);
      setLines([]);
      setLineData({});
      setReviewing(false);
      setDuplicateOrder(null);
      onOrderCreated();
    } catch (e) {
      onToast(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <CustomerSearch tab={tab} setTab={setTab} selectedCustomer={customer} onSelect={selectCustomer} onClearSelection={clearSelection} onToast={onToast} />

      {customer && tab === "search" && (
        <div className="mt-3">
          <Form.Label>Line items</Form.Label>

          {lines.length === 0 ? (
            // The bug this replaces: previously, deleting the only line
            // item hid this whole section entirely (including the "+ Add
            // line" button), leaving no way to add another. Now this
            // empty state always offers a clear way back in.
            <Button variant="outline-primary" className="w-100 py-3" onClick={addLine}>
              + Add Line Item
            </Button>
          ) : (
            <>
              <AnimatePresence initial={false}>
                {lines.map((id) => (
                  <motion.div
                    key={id}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <LineItemRow
                      services={services}
                      products={products}
                      racketModels={racketModels}
                      onChange={(d) => updateLine(id, d)}
                      onRemove={() => removeLine(id)}
                      onNewRacketModel={onNewRacketModel}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
              <Button size="sm" variant="secondary" onClick={addLine}>+ Add line</Button>

              <hr />
              <div className="d-flex justify-content-between align-items-center">
                <strong>Total: ${total.toFixed(2)}</strong>
                <Button disabled={!hasValidLine} onClick={() => setReviewing(true)}>Create Order</Button>
              </div>
              {!hasValidLine && (
                <div className="text-muted small mt-1">Select a service on at least one line to continue.</div>
              )}

              {reviewing && (
                <Card className="mt-3 p-2 bg-mint border-dashed">
                  <strong>Confirm this order:</strong>
                  <div>{customer.name}</div>
                  <div>Total: ${total.toFixed(2)}</div>
                  <div className="mt-2 d-flex gap-2">
                    <Button size="sm" disabled={submitting} onClick={checkAndSubmit}>Confirm & Create</Button>
                    <Button size="sm" variant="secondary" onClick={() => setReviewing(false)}>Back, keep editing</Button>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      <Modal show={!!duplicateOrder} onHide={() => setDuplicateOrder(null)} centered size="sm">
        <Modal.Header closeButton className="modal-header-brand">
          <Modal.Title className="h6 mb-0">Uh oh! Same person?</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {duplicateOrder && (
            <p className="mb-3">
              <strong>{customer?.name}</strong> already has an open order (#{duplicateOrder.id}, ${duplicateOrder.total_price.toFixed(2)})
              from <strong>{timeAgo(duplicateOrder.created_at)}</strong>. Want to create a new one anyway, or was this a mistake?
            </p>
          )}
          <div className="d-flex gap-2 justify-content-end">
            <Button size="sm" variant="secondary" onClick={() => setDuplicateOrder(null)}>Never mind</Button>
            <Button size="sm" onClick={doCreateOrder}>Create anyway</Button>
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
}