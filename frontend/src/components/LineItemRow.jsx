import { useState, useEffect } from "react";
import { Form, Row, Col, Button, InputGroup } from "react-bootstrap";

// A single line item: service + quantity + price, and (for Stringing/Grip
// Replacement) racket model + string/grip type + tension sub-fields.
export default function LineItemRow({
  services,
  products,
  racketModels,
  initial,
  onChange,
  onRemove,
  onNewRacketModel,   // called when a brand-new racket model gets typed
  showErrors = false, // true after a submit attempt with missing required fields
}) {
  const [serviceId, setServiceId] = useState(initial?.service_id ?? "");
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);
  const [price, setPrice] = useState(initial?.price_charged ?? "");
  const [racketModel, setRacketModel] = useState(initial?.racket_model ?? "");
  const [racketModelOther, setRacketModelOther] = useState("");
  const [productSel, setProductSel] = useState(initial?.product_id ? String(initial.product_id) : "");
  const [productOther, setProductOther] = useState("");
  const [tension, setTension] = useState(initial?.string_tension ?? "");

  const service = services.find((s) => s.id === Number(serviceId));
  const mode = service?.name === "Stringing" ? "string" : service?.name === "Grip Replacement" ? "grip" : null;

  // Auto-fill price when the service changes
  useEffect(() => {
    if (service) setPrice(String(service.price));
  }, [serviceId]); // eslint-disable-line react-hooks/exhaustive-deps

  // If editing an existing item whose product isn't in the current catalog
  // (shouldn't normally happen, but just in case), fall back to "Other".
  useEffect(() => {
    if (initial?.product_id && mode) {
      const exists = products.some((p) => p.category === mode && p.id === initial.product_id);
      if (!exists && initial.product_name) {
        setProductSel("__other__");
        setProductOther(initial.product_name);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const racketModelValue = racketModel === "__other__" ? racketModelOther : racketModel;

  // Report the current state up to the parent any time something changes.
  useEffect(() => {
    onChange({
      serviceId: serviceId ? Number(serviceId) : null,
      quantity: Number(quantity) || 1,
      quantityRaw: quantity,
      price: Number(price) || 0,
      priceRaw: price,
      racketModel: mode ? racketModelValue : "",
      productSel: mode ? productSel : "",
      productOther: mode ? productOther : "",
      tension: mode === "string" ? tension : "",
      mode,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, quantity, price, racketModel, racketModelOther, productSel, productOther, tension]);

  const catalog = products
    .filter((p) => p.category === mode)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  const sortedRacketModels = racketModels.slice().sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="border rounded p-2 mb-2 bg-white">
      <div className="d-flex gap-2 align-items-center">
        <div className="flex-grow-1">
          <Form.Select
            size="sm"
            className={serviceId === "" ? "text-muted" : ""}
            value={serviceId}
            isInvalid={showErrors && serviceId === ""}
            onChange={(e) => setServiceId(e.target.value)}
          >
            <option value="">Select service</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Form.Select>
        </div>
        <Button type="button" size="sm" variant="danger" onClick={onRemove}>✕</Button>
      </div>
      <Row className="g-2 align-items-center mt-1">
        <Col xs={6}>
          <InputGroup size="sm" hasValidation>
            <InputGroup.Text>Qty</InputGroup.Text>
            <Form.Control
              type="number"
              min="1"
              value={quantity}
              isInvalid={showErrors && quantity === ""}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </InputGroup>
        </Col>
        <Col xs={6}>
          <InputGroup size="sm" hasValidation>
            <InputGroup.Text>$</InputGroup.Text>
            <Form.Control
              type="number"
              step="0.01"
              min="0"
              value={price}
              isInvalid={showErrors && price === ""}
              onChange={(e) => setPrice(e.target.value)}
            />
          </InputGroup>
        </Col>
      </Row>

      {mode && (
        <>
          <Row className="g-2 mt-1">
            <Col xs={12} md={racketModel === "__other__" ? 6 : 12}>
              <Form.Select
                size="sm"
                className={racketModel === "" ? "text-muted" : ""}
                value={racketModel}
                isInvalid={showErrors && !racketModelValue}
                onChange={async (e) => {
                  const val = e.target.value;
                  setRacketModel(val);
                  if (val && val !== "__other__" && onNewRacketModel) await onNewRacketModel(val);
                }}
              >
                <option value="">Select racket model</option>
                {sortedRacketModels.map((r) => (
                  <option key={r.id} value={r.name}>{r.name}</option>
                ))}
                <option value="__other__">Other (type manually)</option>
              </Form.Select>
              <Form.Control.Feedback type="invalid">Required</Form.Control.Feedback>
            </Col>
            {racketModel === "__other__" && (
              <Col xs={12} md={6}>
                <Form.Control
                  size="sm"
                  placeholder="Type new racket model"
                  value={racketModelOther}
                  isInvalid={showErrors && !racketModelOther.trim()}
                  onBlur={async () => { if (racketModelOther && onNewRacketModel) await onNewRacketModel(racketModelOther); }}
                  onChange={(e) => setRacketModelOther(e.target.value)}
                />
                <Form.Control.Feedback type="invalid">Required</Form.Control.Feedback>
              </Col>
            )}
          </Row>

          <Row className="g-2 mt-1">
            <Col xs={12} md={productSel === "__other__" ? 6 : mode === "string" ? 8 : 12}>
              <Form.Select
                size="sm"
                className={productSel === "" ? "text-muted" : ""}
                value={productSel}
                isInvalid={showErrors && !productSel}
                onChange={(e) => setProductSel(e.target.value)}
              >
                <option value="">Select {mode === "string" ? "string type" : "grip type"}</option>
                {catalog.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
                <option value="__other__">Other (type manually)</option>
              </Form.Select>
              <Form.Control.Feedback type="invalid">Required</Form.Control.Feedback>
            </Col>
            {productSel === "__other__" && (
              <Col xs={12} md={6}>
                <Form.Control
                  size="sm"
                  placeholder="Type new"
                  value={productOther}
                  isInvalid={showErrors && !productOther.trim()}
                  onChange={(e) => setProductOther(e.target.value)}
                />
                <Form.Control.Feedback type="invalid">Required</Form.Control.Feedback>
              </Col>
            )}
            {mode === "string" && (
              <Col xs={12} md={4}>
                <Form.Control
                  size="sm"
                  placeholder="Tension"
                  value={tension}
                  onChange={(e) => setTension(e.target.value)}
                  isInvalid={showErrors && tension.trim() === ""}
                />
                <Form.Control.Feedback type="invalid">Required for stringing</Form.Control.Feedback>
              </Col>
            )}
          </Row>
        </>
      )}
    </div>
  );
}