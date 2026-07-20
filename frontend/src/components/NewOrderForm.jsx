import { useState, useRef } from "react";
import { Button, Card, Form } from "react-bootstrap";
import { AnimatePresence, motion } from "framer-motion";
import LineItemRow from "./LineItemRow";
import CustomerSearch from "./CustomerSearch";
import { api } from "../api";

export default function NewOrderForm({ services, products, racketModels, onNewRacketModel, onOrderCreated, onToast }) {
  const [customer, setCustomer] = useState(null);
  const [lines, setLines] = useState([]);
  const [lineData, setLineData] = useState({});
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const nextLineId = useRef(0);

  function selectCustomer(c) {
    setCustomer(c);
    if (lines.length === 0) addLine();
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

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const existingOrders = await api.listOrders();
      const recentCutoff = Date.now() - 10 * 60 * 1000;
      const dup = existingOrders.find(
        (o) => o.customer_id === customer.id &&
          ["dropped_off", "in_progress"].includes(o.status) &&
          new Date(o.created_at).getTime() > recentCutoff
      );
      if (dup) {
        const minutesAgo = Math.round((Date.now() - new Date(dup.created_at).getTime()) / 60000);
        const proceed = window.confirm(
          `This customer already has an active order (#${dup.id}, $${dup.total_price.toFixed(2)}) created ${minutesAgo} minute(s) ago. Create another order anyway?`
        );
        if (!proceed) return;
      }

      const items = await resolveItemsForSubmit();
      if (items.length === 0) { onToast("Add at least one line item"); return; }

      await api.createOrder({ customer_id: customer.id, items });
      onToast("Order created");
      setCustomer(null);
      setLines([]);
      setLineData({});
      setReviewing(false);
      onOrderCreated();
    } catch (e) {
      onToast(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <CustomerSearch selectedCustomer={customer} onSelect={selectCustomer} onToast={onToast} />

      {customer && lines.length > 0 && (
        <div className="mt-3">
          <Form.Label>Line items</Form.Label>
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
            <Button onClick={() => setReviewing(true)}>Create Order</Button>
          </div>

          {reviewing && (
            <Card className="mt-3 p-2 bg-mint border-dashed">
              <strong>Confirm this order:</strong>
              <div>{customer.name}</div>
              <div>Total: ${total.toFixed(2)}</div>
              <div className="mt-2 d-flex gap-2">
                <Button size="sm" disabled={submitting} onClick={submit}>Confirm & Create</Button>
                <Button size="sm" variant="secondary" onClick={() => setReviewing(false)}>Back, keep editing</Button>
              </div>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
