import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { 
  LayoutDashboard, Package, ShoppingCart, Users, DollarSign, 
  TrendingUp, LogOut, RefreshCw, Mail, Search, Filter,
  ChevronRight, Eye, Truck, Check, X, Plus, Edit, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Admin Login Component
export const AdminLogin = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API}/admin/login`, { email, password });
      localStorage.setItem("adminToken", res.data.access_token);
      onLogin(res.data.access_token);
      toast.success("Welcome to Novaxs Admin!");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="text-2xl font-bold mb-2">
            <span className="text-orange-500">Nova</span>
            <span className="text-slate-900">xs</span>
          </div>
          <CardTitle>Admin Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@novaxs.com"
                required
                data-testid="admin-email"
              />
            </div>
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                data-testid="admin-password"
              />
            </div>
            <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600" disabled={loading} data-testid="admin-login-btn">
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

// Admin Dashboard Component
export const AdminDashboard = () => {
  const navigate = useNavigate();
  const [token, setToken] = useState(localStorage.getItem("adminToken"));
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [orderFilter, setOrderFilter] = useState("all");
  const [syncingProducts, setSyncingProducts] = useState(false);

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    if (token) {
      fetchDashboard();
    }
  }, [token]);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const [dashRes, ordersRes, productsRes] = await Promise.all([
        axios.get(`${API}/admin/dashboard`, authHeaders),
        axios.get(`${API}/admin/orders?limit=50`, authHeaders),
        axios.get(`${API}/admin/products?limit=100`, authHeaders)
      ]);
      setStats(dashRes.data);
      setOrders(ordersRes.data.orders);
      setProducts(productsRes.data.products);
    } catch (e) {
      if (e.response?.status === 401) {
        localStorage.removeItem("adminToken");
        setToken(null);
      }
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    setToken(null);
  };

  const updateOrderStatus = async (orderId, status, trackingNumber = null) => {
    try {
      let url = `${API}/admin/orders/${orderId}/status?status=${status}`;
      if (trackingNumber) url += `&tracking_number=${trackingNumber}`;
      await axios.put(url, {}, authHeaders);
      toast.success("Order updated");
      fetchDashboard();
    } catch (e) {
      toast.error("Failed to update order");
    }
  };

  const syncCJProducts = async () => {
    setSyncingProducts(true);
    try {
      await axios.post(`${API}/admin/sync-cj-products?limit=100`, {}, authHeaders);
      toast.success("Product sync started! Refresh in a few seconds.");
      setTimeout(fetchDashboard, 5000);
    } catch (e) {
      toast.error("Sync failed");
    } finally {
      setSyncingProducts(false);
    }
  };

  const sendTestEmail = async () => {
    try {
      const res = await axios.post(`${API}/admin/send-test-email`, {}, authHeaders);
      toast.success(res.data.message);
    } catch (e) {
      toast.error("Failed to send test email");
    }
  };

  const deleteProduct = async (productId) => {
    if (!window.confirm("Delete this product?")) return;
    try {
      await axios.delete(`${API}/admin/products/${productId}`, authHeaders);
      toast.success("Product deleted");
      fetchDashboard();
    } catch (e) {
      toast.error("Failed to delete product");
    }
  };

  if (!token) {
    return <AdminLogin onLogin={setToken} />;
  }

  const getStatusColor = (status) => ({
    pending: "bg-yellow-100 text-yellow-700",
    processing: "bg-blue-100 text-blue-700",
    shipped: "bg-purple-100 text-purple-700",
    delivered: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700"
  }[status] || "bg-slate-100 text-slate-700");

  const filteredOrders = orderFilter === "all" ? orders : orders.filter(o => o.status === orderFilter);

  return (
    <div className="min-h-screen bg-slate-50" data-testid="admin-dashboard">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">
              <span className="text-orange-500">Nova</span>
              <span className="text-slate-900">xs</span>
              <span className="text-slate-400 font-normal ml-2">Admin</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchDashboard}>
              <RefreshCw className="w-4 h-4 mr-1" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/")}>
              View Store
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="grid grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-slate-200 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Total Revenue</p>
                      <p className="text-2xl font-bold text-green-600">${stats?.stats?.total_revenue?.toLocaleString()}</p>
                    </div>
                    <DollarSign className="w-10 h-10 text-green-100 bg-green-500 rounded-full p-2" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Orders</p>
                      <p className="text-2xl font-bold">{stats?.stats?.total_orders}</p>
                    </div>
                    <ShoppingCart className="w-10 h-10 text-blue-100 bg-blue-500 rounded-full p-2" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Products</p>
                      <p className="text-2xl font-bold">{stats?.stats?.total_products}</p>
                    </div>
                    <Package className="w-10 h-10 text-purple-100 bg-purple-500 rounded-full p-2" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Customers</p>
                      <p className="text-2xl font-bold">{stats?.stats?.total_users}</p>
                    </div>
                    <Users className="w-10 h-10 text-orange-100 bg-orange-500 rounded-full p-2" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-6">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
                <TabsTrigger value="products">Products ({products.length})</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview">
                <div className="grid md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Order Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Object.entries(stats?.orders_by_status || {}).map(([status, count]) => (
                          <div key={status} className="flex items-center justify-between">
                            <Badge className={getStatusColor(status)}>{status}</Badge>
                            <span className="font-bold">{count}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Recent Orders</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-64">
                        <div className="space-y-3">
                          {stats?.recent_orders?.slice(0, 5).map((order) => (
                            <div key={order.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                              <div>
                                <p className="font-mono text-sm font-bold">{order.order_number}</p>
                                <p className="text-xs text-slate-500">{new Date(order.created_at).toLocaleDateString()}</p>
                              </div>
                              <div className="text-right">
                                <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                                <p className="text-sm font-bold text-orange-500 mt-1">${order.total?.toFixed(2)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Orders Tab */}
              <TabsContent value="orders">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>All Orders</CardTitle>
                      <Select value={orderFilter} onValueChange={setOrderFilter}>
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Filter" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Orders</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="processing">Processing</SelectItem>
                          <SelectItem value="shipped">Shipped</SelectItem>
                          <SelectItem value="delivered">Delivered</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px]">
                      <div className="space-y-3">
                        {filteredOrders.map((order) => (
                          <div key={order.id} className="p-4 border rounded-lg hover:bg-slate-50">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-mono font-bold">{order.order_number}</p>
                                <p className="text-sm text-slate-500">{order.shipping_address?.name} • {order.shipping_address?.email}</p>
                                <p className="text-xs text-slate-400 mt-1">
                                  {new Date(order.created_at).toLocaleString()} • {order.items?.length} items
                                </p>
                              </div>
                              <div className="text-right">
                                <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                                <p className="text-lg font-bold text-orange-500 mt-1">${order.total?.toFixed(2)}</p>
                              </div>
                            </div>
                            <div className="flex gap-2 mt-3">
                              {order.status === "pending" && (
                                <Button size="sm" onClick={() => updateOrderStatus(order.id, "processing")}>
                                  Process Order
                                </Button>
                              )}
                              {order.status === "processing" && (
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button size="sm"><Truck className="w-4 h-4 mr-1" /> Mark Shipped</Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader><DialogTitle>Add Tracking Number</DialogTitle></DialogHeader>
                                    <form onSubmit={(e) => {
                                      e.preventDefault();
                                      const tracking = e.target.tracking.value;
                                      updateOrderStatus(order.id, "shipped", tracking);
                                    }}>
                                      <Input name="tracking" placeholder="Tracking number" className="mb-4" />
                                      <Button type="submit" className="w-full">Mark as Shipped</Button>
                                    </form>
                                  </DialogContent>
                                </Dialog>
                              )}
                              {order.status === "shipped" && (
                                <Button size="sm" variant="outline" onClick={() => updateOrderStatus(order.id, "delivered")}>
                                  <Check className="w-4 h-4 mr-1" /> Mark Delivered
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Products Tab */}
              <TabsContent value="products">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Products</CardTitle>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={syncCJProducts} disabled={syncingProducts}>
                          <RefreshCw className={`w-4 h-4 mr-1 ${syncingProducts ? 'animate-spin' : ''}`} />
                          Sync from CJ
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px]">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {products.map((product) => (
                          <div key={product.id} className="border rounded-lg overflow-hidden">
                            <img src={product.image} alt={product.name} className="w-full h-32 object-cover" />
                            <div className="p-3">
                              <p className="text-sm font-medium line-clamp-2">{product.name}</p>
                              <p className="text-orange-500 font-bold">${product.price?.toFixed(2)}</p>
                              <p className="text-xs text-slate-500">{product.category}</p>
                              <Button size="sm" variant="ghost" className="mt-2 text-red-500 w-full" onClick={() => deleteProduct(product.id)}>
                                <Trash2 className="w-3 h-3 mr-1" /> Delete
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings">
                <div className="grid md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Email Notifications</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-slate-600">
                        Admin notifications are sent to: <strong>novaxs6969@gmail.com</strong>
                      </p>
                      <Button onClick={sendTestEmail}>
                        <Mail className="w-4 h-4 mr-2" /> Send Test Email
                      </Button>
                      <p className="text-xs text-slate-500">
                        Note: Add RESEND_API_KEY to enable email notifications
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">CJ Dropshipping</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-slate-600">
                        Sync products directly from CJ Dropshipping catalog.
                      </p>
                      <Button onClick={syncCJProducts} disabled={syncingProducts}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${syncingProducts ? 'animate-spin' : ''}`} />
                        Sync Products Now
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
