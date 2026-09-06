import React, { createContext, useContext, useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import axios from "axios";
import { Toaster, toast } from "sonner";
import { 
  Search, ShoppingCart, Minus, Plus, Trash2, CreditCard, ArrowLeft, Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = BACKEND_URL + "/api";

const AppContext = createContext(null);
const useApp = () => useContext(AppContext);

const getCartId = () => {
  let cartId = localStorage.getItem("cartId");
  if (!cartId) {
    cartId = "cart_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    localStorage.setItem("cartId", cartId);
  }
  return cartId;
};

const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState({ items: [], subtotal: 0 });
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem("token");
      if (token) {
        try {
          const res = await axios.get(API + "/auth/me", {
            headers: { Authorization: "Bearer " + token }
          });
          setUser(res.data);
        } catch {
          localStorage.removeItem("token");
        }
      }
      try {
        const cartRes = await axios.get(API + "/cart/" + getCartId());
        setCart(cartRes.data);
      } catch {}
      try {
        const catRes = await axios.get(API + "/categories");
        setCategories(catRes.data);
      } catch {}
    };
    init();
  }, []);

  const addToCart = async (productId, variantId = null, quantity = 1) => {
    try {
      const res = await axios.post(API + "/cart/" + getCartId() + "/items", {
        product_id: productId,
        variant_id: variantId,
        quantity
      });
      setCart(res.data);
      toast.success("Added to cart!");
      return true;
    } catch (e) {
      toast.error("Failed to add to cart");
      return false;
    }
  };

  const updateCartItem = async (productId, quantity) => {
    try {
      const res = await axios.put(API + "/cart/" + getCartId() + "/items/" + productId + "?quantity=" + quantity);
      setCart(res.data);
    } catch (e) {
      toast.error("Failed to update cart");
    }
  };

  const removeFromCart = async (productId) => {
    try {
      const res = await axios.delete(API + "/cart/" + getCartId() + "/items/" + productId);
      setCart(res.data);
      toast.success("Removed from cart");
    } catch (e) {
      toast.error("Failed to remove item");
    }
  };

  return (
    <AppContext.Provider value={{ user, cart, categories, addToCart, updateCartItem, removeFromCart }}>
      {children}
    </AppContext.Provider>
  );
};

const Header = () => {
  const { cart } = useApp();
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const cartItemsCount = cart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate("/products?search=" + encodeURIComponent(searchQuery));
    }
  };

  return (
    <header className="sticky top-0 z-50">
      <div className="py-4" style={{ backgroundColor: "#0A0A1F" }}>
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between gap-4">
          <Link to="/" className="flex-shrink-0">
            <img 
              src="https://customer-assets.emergentagent.com/job_dfe494f7-bb89-4ed5-9943-bc15fa3ca74e/artifacts/g0y20dm6_image-1.jpg" 
              alt="NOVAXS" 
              className="h-12 md:h-14 object-contain"
            />
          </Link>

          <form onSubmit={handleSearch} className="flex-1 max-w-xl hidden md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: "#A020F0" }} />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border-2 focus:outline-none"
                style={{ backgroundColor: "#1A1A2E", borderColor: "#A020F0", color: "#E0E0FF" }}
              />
            </div>
          </form>

          <Sheet>
            <SheetTrigger asChild>
              <button className="relative p-2">
                <ShoppingCart className="w-7 h-7" style={{ color: "#A020F0" }} />
                {cartItemsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center text-white" style={{ backgroundColor: "#A020F0" }}>
                    {cartItemsCount}
                  </span>
                )}
              </button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-lg">
              <CartDrawer />
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

const CartDrawer = () => {
  const { cart, updateCartItem, removeFromCart } = useApp();
  const navigate = useNavigate();

  if (!cart?.items?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <ShoppingCart className="w-16 h-16 text-slate-300 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Your cart is empty</h3>
        <p className="text-slate-500 mb-4">Add some products to get started</p>
        <Link to="/products">
          <Button className="bg-orange-500 hover:bg-orange-600">Start Shopping</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <SheetHeader>
        <SheetTitle>Shopping Cart ({cart.items.length})</SheetTitle>
      </SheetHeader>
      
      <ScrollArea className="flex-1 mt-4 -mx-6 px-6">
        <div className="space-y-4">
          {cart.items.map((item) => (
            <div key={item.product_id} className="flex gap-4 p-4 bg-slate-50 rounded-lg">
              <img 
                src={item.product?.image || "https://via.placeholder.com/80"} 
                alt={item.product?.name}
                className="w-20 h-20 object-cover rounded-lg"
              />
              <div className="flex-1">
                <h4 className="font-medium text-sm line-clamp-2">{item.product?.name}</h4>
                <p className="text-orange-500 font-bold mt-1">${item.product?.price?.toFixed(2)}</p>
                <div className="flex items-center gap-2 mt-2">
                  <button onClick={() => updateCartItem(item.product_id, Math.max(1, item.quantity - 1))} className="p-1 hover:bg-slate-200 rounded">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center">{item.quantity}</span>
                  <button onClick={() => updateCartItem(item.product_id, item.quantity + 1)} className="p-1 hover:bg-slate-200 rounded">
                    <Plus className="w-4 h-4" />
                  </button>
                  <button onClick={() => removeFromCart(item.product_id)} className="ml-auto p-1 hover:bg-red-100 text-red-500 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="pt-4 mt-4 border-t">
        <div className="flex justify-between mb-2">
          <span className="text-slate-600">Subtotal</span>
          <span className="font-bold">${cart.subtotal?.toFixed(2)}</span>
        </div>
        <p className="text-xs text-slate-500 mb-4">Shipping & taxes calculated at checkout</p>
        <Button 
          className="w-full bg-orange-500 hover:bg-orange-600 h-12 text-base font-semibold"
          onClick={() => navigate("/checkout")}
        >
          Checkout
        </Button>
      </div>
    </div>
  );
};

const ProductCard = ({ product }) => {
  const { addToCart } = useApp();
  const discount = product.compare_price 
    ? Math.round((1 - product.price / product.compare_price) * 100) 
    : 0;

  return (
    <div className="bg-white rounded-xl overflow-hidden border border-slate-100">
      <Link to={"/product/" + product.id}>
        <div className="relative aspect-square overflow-hidden bg-slate-100">
          <img src={product.image} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
          {discount > 0 && <Badge className="absolute top-3 left-3 bg-orange-500">-{discount}%</Badge>}
        </div>
      </Link>
      <div className="p-4">
        <Link to={"/product/" + product.id}>
          <h3 className="font-semibold text-sm line-clamp-2 h-10 hover:text-orange-500">{product.name}</h3>
        </Link>
        <div className="flex items-center gap-1 mt-2">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className={"w-3.5 h-3.5 " + (i < Math.floor(product.rating || 0) ? "fill-amber-400 text-amber-400" : "text-slate-200")} />
          ))}
          <span className="text-xs text-slate-500 ml-1">({product.reviews_count || 0})</span>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-lg font-bold text-orange-500">${product.price?.toFixed(2)}</span>
          {product.compare_price && (
            <span className="text-sm text-slate-400 line-through">${product.compare_price?.toFixed(2)}</span>
          )}
        </div>
        <Button 
          className="w-full mt-3 bg-slate-900 hover:bg-orange-500"
          onClick={(e) => { e.preventDefault(); addToCart(product.id); }}
        >
          Add to Cart
        </Button>
      </div>
    </div>
  );
};

const HomePage = () => {
  const { categories } = useApp();
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const res = await axios.get(API + "/products/featured?limit=8");
        setFeaturedProducts(res.data);
      } catch {}
      finally { setLoading(false); }
    };
    fetchFeatured();
  }, []);

  return (
    <div className="bg-[#0a0618] text-white min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a0b3a] via-[#0d0620] to-[#0a0618]" />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 50% 30%, rgba(168,85,247,0.35), transparent 55%)"
          }}
        />

        <div className="relative max-w-7xl mx-auto px-4 pt-10 pb-14 text-center">
          <div className="flex flex-col items-center mb-8">
           <img
              src="/grok_image_1788659689834.jpg"
              alt="NOVAXS - Elevate Your Lifestyle"
              className="w-64 md:w-80 max-w-full object-contain mb-2 drop-shadow-[0_0_40px_rgba(168,85,247,0.6)]"
            />
            <Link
              to="/products"
              className="mt-6 inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-fuchsia-500 hover:from-orange-400 hover:to-fuchsia-400 text-white font-semibold px-8 py-3 rounded-full shadow-lg shadow-purple-900/40 transition"
            >
              Shop Now
            </Link>
          </div>

          {/* All 6 categories */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-5 max-w-4xl mx-auto">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={"/products?category=" + cat.slug}
                className="group relative rounded-2xl overflow-hidden border border-purple-500/30 bg-[#120a28] hover:border-purple-400/60 transition min-h-[140px] md:min-h-[170px]"
              >
                <img
                  src={cat.image || "https://via.placeholder.com/400"}
                  alt={cat.name}
                  className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3 text-left">
                  <h3 className="text-sm md:text-base font-bold text-white leading-tight">
                    {cat.name}
                  </h3>
                  <p className="text-purple-200/80 text-xs mt-0.5">Explore →</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="max-w-7xl mx-auto px-4 py-12 pb-16">
        <div className="flex items-center justify-between mb-7">
          <h2 className="text-2xl md:text-3xl font-bold text-white">Featured Products</h2>
          <Link to="/products" className="text-orange-400 font-medium text-sm hover:underline">
            View All →
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-80 bg-purple-950/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {featuredProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const ProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const category = searchParams.get("category");
  const search = searchParams.get("search");

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        let url = API + "/products?";
        if (category) url += "category=" + category + "&";
        if (search) url += "search=" + encodeURIComponent(search);
        const res = await axios.get(url);
        setProducts(res.data.products || res.data || []);
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [category, search]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">
        {category ? category.replace(/-/g, " ") : search ? "Search: " + search : "All Products"}
      </h1>
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <div key={i} className="h-80 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : products.length === 0 ? (
        <p className="text-center text-slate-500 py-16">No products found</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {products.map(p => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
};

const ProductDetailPage = () => {
  const { id } = useParams();
  const { addToCart } = useApp();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await axios.get(API + "/products/" + id);
        setProduct(res.data);
      } catch {}
      finally { setLoading(false); }
    };
    fetchProduct();
  }, [id]);

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-16"><div className="h-96 bg-slate-100 rounded-2xl animate-pulse" /></div>;
  if (!product) return <div className="text-center py-16">Product not found</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid md:grid-cols-2 gap-8">
        <div className="aspect-square bg-slate-100 rounded-2xl overflow-hidden">
          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
        </div>
        <div>
          <h1 className="text-3xl font-bold mb-4">{product.name}</h1>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-3xl font-bold text-orange-500">${product.price?.toFixed(2)}</span>
            {product.compare_price && <span className="text-lg text-slate-400 line-through">${product.compare_price?.toFixed(2)}</span>}
          </div>
          <p className="text-slate-600 mb-6">{product.description}</p>
          <Button className="w-full h-14 bg-orange-500 hover:bg-orange-600 text-lg" onClick={() => addToCart(product.id)}>
            Add to Cart
          </Button>
        </div>
      </div>
    </div>
  );
};

const CheckoutPage = () => {
  const { cart } = useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "", email: "", phone: "", address: "", address2: "",
    city: "", state: "", zip_code: "", country: "United States", country_code: "US"
  });

  useEffect(() => {
    if (!cart?.items?.length) {
      navigate("/");
    }
  }, [cart, navigate]);

  const subtotal = cart?.subtotal || 0;
  const shipping = subtotal >= 50 ? 0 : 5.99;
  const tax = subtotal * 0.08;
  const total = subtotal + shipping + tax;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(API + "/orders", {
        shipping_address: formData,
        cart_id: localStorage.getItem("cartId")
      }, {
        headers: token ? { Authorization: "Bearer " + token } : {}
      });

      const order = res.data.order;
      
      const stripeRes = await axios.post(API + "/checkout/stripe", {
        order_id: order.id,
        origin_url: window.location.origin + "/"
      });
      
      if (stripeRes.data.checkout_url) {
        window.location.href = stripeRes.data.checkout_url;
      } else {
        toast.error("Failed to create payment session");
        setLoading(false);
      }
    } catch (e) {
      const msg = e.response?.data?.detail || "Failed to place order";
      toast.error(typeof msg === "string" ? msg : JSON.stringify(msg));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-600 hover:text-orange-500 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to cart
        </button>
        <h1 className="text-2xl md:text-3xl font-bold mb-8">Checkout</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-bold mb-6">Shipping Information</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Full Name</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} required />
                </div>
                <div>
                  <Label>Country</Label>
                  <Select value={formData.country_code} onValueChange={(v) => setFormData({...formData, country_code: v, country: v === "US" ? "United States" : v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="US">United States</SelectItem>
                      <SelectItem value="CA">Canada</SelectItem>
                      <SelectItem value="GB">United Kingdom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label>Address</Label>
                  <Input value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} required />
                </div>
                <div>
                  <Label>City</Label>
                  <Input value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})} required />
                </div>
                <div>
                  <Label>State</Label>
                  <Input value={formData.state} onChange={(e) => setFormData({...formData, state: e.target.value})} required />
                </div>
                <div>
                  <Label>ZIP Code</Label>
                  <Input value={formData.zip_code} onChange={(e) => setFormData({...formData, zip_code: e.target.value})} required />
                </div>
              </div>

              <Separator className="my-8" />
              <h2 className="text-xl font-bold mb-6">Payment</h2>
              <div className="bg-slate-50 rounded-xl p-6 flex items-center gap-4">
                <CreditCard className="w-12 h-12 text-slate-600" />
                <div>
                  <p className="font-medium">Pay with Stripe</p>
                  <p className="text-sm text-slate-500">Secure card payment</p>
                </div>
              </div>

              <Button type="submit" className="w-full mt-8 h-14 bg-orange-500 hover:bg-orange-600 text-lg font-semibold" disabled={loading}>
                {loading ? "Processing..." : "Place Order • $" + total.toFixed(2)}
              </Button>
            </form>
          </div>

          <div>
            <div className="bg-white rounded-2xl p-6 shadow-sm sticky top-24">
              <h2 className="text-xl font-bold mb-6">Order Summary</h2>
              <div className="space-y-4 mb-6">
                {cart?.items?.map((item) => (
                  <div key={item.product_id} className="flex gap-3">
                    <img src={item.product?.image} alt={item.product?.name} className="w-16 h-16 rounded-lg object-cover" />
                    <div className="flex-1">
                      <p className="text-sm font-medium line-clamp-2">{item.product?.name}</p>
                      <p className="text-sm text-slate-500">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-medium">${((item.product?.price || 0) * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
              </div>
              <Separator className="my-4" />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-600">Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Shipping</span><span>{shipping === 0 ? "FREE" : "$" + shipping.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Tax</span><span>${tax.toFixed(2)}</span></div>
              </div>
              <Separator className="my-4" />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-orange-500">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Footer = () => (
  <footer className="bg-slate-900 text-white mt-16">
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
        <div>
          <h3 className="text-xl font-bold mb-4"><span className="text-orange-500">Nova</span>xs</h3>
          <p className="text-slate-400 text-sm">Your one-stop shop for amazing deals.</p>
        </div>
        <div>
          <h4 className="font-semibold mb-4">Shop</h4>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><Link to="/products?category=womens-fashion" className="hover:text-orange-500">Women's Fashion</Link></li>
            <li><Link to="/products?category=mens-fashion" className="hover:text-orange-500">Men's Fashion</Link></li>
            <li><Link to="/products?category=electronics" className="hover:text-orange-500">Electronics</Link></li>
          </ul>
        </div>
      </div>
      <Separator className="my-8 bg-slate-700" />
      <p className="text-sm text-slate-400 text-center">© 2026 Novaxs. All rights reserved.</p>
    </div>
  </footer>
);

function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <div className="min-h-screen flex flex-col">
          <Toaster position="top-center" richColors />
          <Header />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/product/:id" element={<ProductDetailPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </AppProvider>
    </BrowserRouter>
  );
}

export default App;
