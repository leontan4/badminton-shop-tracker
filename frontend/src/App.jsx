import { useState, useEffect, useCallback, useRef } from "react";
import { Container, Row, Col, Card, Button, Toast, ToastContainer } from "react-bootstrap";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "./api";
import NewOrderForm from "./components/NewOrderForm";
import OrderCard from "./components/OrderCard";
import Summary from "./components/Summary";
import History from "./components/History";

export default function App() {
  const [services, setServices] = useState([]);
  const [products, setProducts] = useState([]);
  const [racketModels, setRacketModels] = useState([]);
  const [orders, setOrders] = useState([]);
  const [view, setView] = useState("active");
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const editingOrderIdRef = useRef(null);
  editingOrderIdRef.current = editingOrderId;

  const showToast = useCallback((msg) => setToastMsg(msg), []);

  // Note: this always actually refreshes when called. The "don't disturb
  // an open edit panel" guard lives at the automatic-polling call site
  // below, NOT here -- otherwise an explicit refresh triggered right after
  // an action (e.g. clicking "Mark ready") would get silently skipped too.
  const refreshOrders = useCallback(async () => {
    const data = await api.listOrders();
    setOrders(data);
  }, []);

  const handleNewRacketModel = useCallback(async (name) => {
    if (racketModels.some((r) => r.name === name)) return;
    const created = await api.createProduct({ name, category: "racket_model", cost_to_shop: 0, price_to_customer: 0 });
    setRacketModels((r) => [...r, created]);
  }, [racketModels]);

  useEffect(() => {
    (async () => {
      const allProducts = await api.listProducts();
      setProducts(allProducts.filter((p) => p.category !== "racket_model"));
      setRacketModels(allProducts.filter((p) => p.category === "racket_model"));
      setServices(await api.listServices());
      await refreshOrders();
    })();
    const interval = setInterval(() => {
      if (view === "active" && editingOrderIdRef.current === null) refreshOrders();
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const activeOrders = orders.filter((o) => o.status !== "picked_up" && o.status !== "cancelled");

  const VIEW_TITLES = { active: "Active Orders", summary: "Summary", history: "History" };

  return (
    <>
      <div className="text-white py-3 px-4 d-flex justify-content-between align-items-center" style={{ background: "var(--bs-primary)" }}>
        <h1 className="h5 mb-0">🏸 Badminton Gallery Service Stop</h1>
        <span className="small opacity-75">stringing &amp; service orders</span>
      </div>

      <Container className="py-4" style={{ maxWidth: 1100 }}>
        <Row className="g-4">
          <Col md={5}>
            <Card className="p-3">
              <h2 className="h6 text-muted text-uppercase mb-3">New Order</h2>
              <NewOrderForm
                services={services}
                products={products}
                racketModels={racketModels}
                onNewRacketModel={handleNewRacketModel}
                onOrderCreated={refreshOrders}
                onToast={showToast}
              />
            </Card>
          </Col>

          <Col md={7}>
            <Card className="p-3">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h2 className="h6 text-muted text-uppercase mb-0">{VIEW_TITLES[view]}</h2>
                <div className="d-flex gap-2">
                  <Button size="sm" variant="outline-primary" onClick={() => setView("active")}>Active</Button>
                  <Button size="sm" variant="outline-primary" onClick={() => setView("summary")}>Summary</Button>
                  <Button size="sm" variant="outline-primary" onClick={() => setView("history")}>History</Button>
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={view}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {view === "active" && (
                    activeOrders.length === 0
                      ? <div className="text-muted text-center py-4">No active orders</div>
                      : (
                        <AnimatePresence initial={false}>
                          {activeOrders.map((o) => (
                            <motion.div
                              key={o.id}
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.96 }}
                              transition={{ duration: 0.25, ease: "easeOut" }}
                            >
                              <OrderCard
                                order={o}
                                services={services}
                                products={products}
                                racketModels={racketModels}
                                onNewRacketModel={handleNewRacketModel}
                                onRefresh={refreshOrders}
                                onToast={showToast}
                                editing={setEditingOrderId}
                                isEditing={editingOrderId === o.id}
                              />
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      )
                  )}

                  {view === "summary" && <Summary />}
                  {view === "history" && <History onToast={showToast} services={services} products={products} racketModels={racketModels} />}
                </motion.div>
              </AnimatePresence>
            </Card>
          </Col>
        </Row>
      </Container>

      <ToastContainer position="bottom-end" className="p-3">
        <Toast show={!!toastMsg} onClose={() => setToastMsg(null)} delay={2500} autohide bg="dark">
          <Toast.Body className="text-white">{toastMsg}</Toast.Body>
        </Toast>
      </ToastContainer>
    </>
  );
}