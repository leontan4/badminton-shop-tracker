import { useState, useRef, useEffect } from "react";
import { Collapse, Button, Card } from "react-bootstrap";
import LineItemRow from "./LineItemRow";
import { api } from "../api";

// Uses react-bootstrap's Collapse -- this is exactly the smooth
// expand/collapse behavior we previously hand-rolled with a CSS
// grid-template-rows trick. Here it's a tested, built-in component.
export default function EditItemsPanel({ order, open, services, products, racketModels, onNewRacketModel, onClose, onSaved, onToast }) {
  const [lines, setLines] = useState([]);
  const [lineData, setLineData] = useState({});
  const nextLineId = useRef(0);

  useEffect(() => {
    if (open && order) {
      const ids = order.items.map(() => nextLineId.current++);
      setLines(ids);
      const data = {};
      order.items.forEach((item, i) => {
        data[ids[i]] = {
          serviceId: item.service_id,
          quantity: item.quantity,
          price: item.price_charged,
          racketModel: item.racket_model || "",
          productSel: item.product_id ? String(item.product_id) : "",
          productOther: "",
          tension: item.string_tension || "",
          mode: null,
        };
      });
      setLineData(data);
    }
  }, [open, order]);

  function addLine() {
    setLines((l) => [...l, nextLineId.current++]);
  }
  function removeLine(id) {
    setLines((l) => l.filter((x) => x !== id));
  }
  function updateLine(id, data) {
    setLineData((d) => ({ ...d, [id]: data }));
  }

  async function save() {
    try {
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
      if (items.length === 0) { onToast("Order must have at least one line item"); return; }
      await api.updateOrderItems(order.id, items);
      onToast("Order updated");
      onSaved();
    } catch (e) {
      onToast(e.message || "Could not update -- order may already be marked ready");
    }
  }

  return (
    <Collapse in={open}>
      <div>
        <Card className="mt-2 p-2 bg-mint border-dashed">
          {lines.map((id) => (
            <LineItemRow
              key={id}
              services={services}
              products={products}
              racketModels={racketModels}
              initial={lineData[id]?.serviceId ? {
                service_id: lineData[id].serviceId,
                quantity: lineData[id].quantity,
                price_charged: lineData[id].price,
                racket_model: lineData[id].racketModel,
                product_id: lineData[id].productSel ? Number(lineData[id].productSel) : null,
                string_tension: lineData[id].tension,
              } : undefined}
              onChange={(d) => updateLine(id, d)}
              onRemove={() => removeLine(id)}
              onNewRacketModel={onNewRacketModel}
            />
          ))}
          <Button size="sm" variant="secondary" onClick={addLine}>+ Add line</Button>
          <div className="mt-2 d-flex gap-2">
            <Button size="sm" onClick={save}>Save</Button>
            <Button size="sm" variant="secondary" onClick={onClose}>Cancel</Button>
          </div>
        </Card>
      </div>
    </Collapse>
  );
}
