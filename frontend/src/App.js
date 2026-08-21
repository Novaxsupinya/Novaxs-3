import React, { createContext, useContext, useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import axios from "axios";
import { Toaster, toast } from "sonner";
import { 
  Search, ShoppingCart, User, Menu, X, Heart, Package, LogOut, 
  ChevronRight, Star, Minus, Plus, Trash2, CreditCard, Truck, 
  Shield, ArrowLeft, Filter, ChevronDown, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AppContext = createContext(null);
const useApp = () => useContext(AppContext);

const getCartId = () => {
  let cartId = localStorage.getItem("cartId");
  if (!cartId) {
    cartId = `cart_\( {Date.now()}_ \){Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("cartId", cartId);
  }
  return cartId;
};

const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState({ items: [], subtotal: 0 });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      const token = localStorage.getItem("token");
      if (token) {
        try {
          const res = await axios.get(`${API}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setUser(res.data);
        } catch {
          localStorage.removeItem("token");
        }
      }
      try {
        const cartRes = await axios.get(`\( {API}/cart/ \){getCartId()}`);
        setCart(cartRes.data);
      } catch {}
      try {
        const catRes = await axios.get(`${API}/categories`);
        setCategories(catRes.data);
      } catch {}
    };
    initializeApp();
  }, []);

  const fetchCart = async () => {
    try {
      const res = await axios.get(`\( {API}/cart/ \){getCartId()}`);
      setCart(res.data);
    } catch {}
  };

  const addToCart = async (productId, variantId = null, quantity = 1) => {
    try {
      const res = await axios.post(`\( {API}/cart/ \){getCartId()}/items`, {
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
      const res = await axios.put(`\( {API}/cart/ \){getCartId()}/items/\( {productId}?quantity= \){quantity}`);
      setCart(res.data);
    } catch (e) {
      toast.error("Failed to update cart");
    }
  };

  const removeFromCart = async (productId) => {
    try {
      const res = await axios.delete(`\( {API}/cart/ \){getCartId()}/items/${productId}`);
      setCart(res.data);
      toast.success("Removed from cart");
    } catch (e) {
      toast.error("Failed to remove item");
    }
  };

  const login = async (email, password) => {
    try {
      const res = await axios.post(`${API}/auth/login`, { email, password });
      localStorage.setItem("token", res.data.access_token);
      setUser(res.data.user);
      toast.success("Welcome back!");
      return true;
    } catch (e) {
      toast.error(e.response?.data?.detail || "Login failed");
      return false;
    }
  };

  const register = async (name, email, password) => {
    try {
      const res = await axios.post(`${API}/auth/register`, { name, email, password });
      localStorage.setItem("token", res.data.access_token);
      setUser(res.data.user);
      toast.success("Account created!");
      return true;
    } catch (e) {
      toast.error(e.response?.data?.detail || "Registration failed");
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
    toast.success("Logged out");
  };

  return (
    <AppContext.Provider value={{
      user, setUser, cart, setCart, categories, loading, setLoading,
      addToCart, updateCartItem, removeFromCart, fetchCart,
      login, register, logout
    }}>
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
      navigate(`/products?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <header className="sticky top-0 z-50" data-testid="header">
      <div className="py-4" style={{ backgroundColor: '#0A0A1F' }}>
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between gap-4">
          <Link to="/" className="flex-shrink-0" data-testid="logo">
            <img 
              src="https://customer-assets.emergentagent.com/job_dfe494f7-bb89-4ed5-9943-bc15fa3ca74e/artifacts/g0y20dm6_image-1.jpg" 
              alt="NOVAXS" 
              className="h-12 md:h-14 object-contain"
              style={{ filter: 'drop-shadow(0 0 10px rgba(160, 32, 240, 0.5))' }}
            />
          </Link>

          <form onSubmit={handleSearch} className="flex-1 max-w-xl hidden md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#A020F0' }} />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border-2 focus:outline-none"
                style={{ backgroundColor: '#1A1A2E', borderColor: '#A020F0', color: '#E0E0FF' }}
                data-testid="search-input"
              />
            </div>
          </form>

          <Sheet>
            <SheetTrigger asChild>
              <button className="relative p-2" data-testid="cart-btn">
                <ShoppingCart className="w-7 h-7" style={{ color: '#A020F0' }} />
                {cartItemsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center text-white" style={{ backgroundColor: '#A020F0' }}>
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

        <div className="md:hidden px-4 mt-3">
          <form onSubmit={handleSearch}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#A020F0' }} />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border-2 focus:outline-none"
                style={{ backgroundColor: '#1A1A2E', borderColor: '#A020F0', color: '#E0E0FF' }}
              />
            </div>
          </form>
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
      <div className="flex flex-col items-center justify-center h-full text-center" data-testid="empty-cart">
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
    <div className="flex flex-col h-full" data-testid="cart-drawer">
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
    <div className="product-card group relative bg-white rounded-xl overflow-hidden border border-slate-100">
      <Link to={`/product/${product.id}`}>
        <div className="relative aspect-square overflow-hidden bg-slate-100">
          <img src={product.image} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
          {discount > 0 && <Badge className="absolute top-3 left-3 bg-orange-500">-{discount}%</Badge>}
        </div>
      </Link>
      <div className="p-4">
        <Link to={`/product/${product.id}`}>
          <h3 className="font-semibold text-sm line-clamp-2 h-10 hover:text-orange-500">{product.name}</h3>
        </Link>
        <div className="flex items-center gap-1 mt-2">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className={`w-3.5 h-3.5 ${i < Math.floor(product.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
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
        const res = await axios.get(`${API}/products/featured?limit=8`);
        setFeaturedProducts(res.data);
      } catch {}
      finally { setLoading(false); }
    };
    fetchFeatured();
  }, []);

  return (
    <div>
      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-8 overflow-hidden md:h-[500px] aspect-[4/3] md:aspect-auto rounded-[40px]" style={{ background: 'linear-gradient(135deg, #0A0A1F 0%, #0D0D24 50%, #0A0A1F 100%)' }}>
            <img 
              src="https://customer-assets.emergentagent.com/job_dfe494f7-bb89-4ed5-9943-bc15fa3ca74e/artifacts/q3ekjzjv_1000005914.jpg"
              alt="NOVAXS"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="md:col-span-4 flex flex-col gap-4">
            <Link to="/products?category=mens-fashion" className="flex-1 relative rounded-2xl overflow-hidden group min-h-[240px]">
              <img src="https://images.unsplash.com/photo-1658860547138-1e28dfb90867?w=600" alt="Men's Fashion" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-4 left-4 text-white">
                <h3 className="text-xl font-bold">Men's Fashion</h3>
                <p className="text-white/80 text-sm">Explore →</p>
              </div>
            </Link>
            <Link to="/products?category=electronics" className="flex-1 relative rounded-2xl overflow-hidden group min-h-[240px]">
              <img src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600" alt="Electronics" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-4 left-4 text-white">
                <h3 className="text-xl font-bold">Electronics</h3>
                <p className="text-white/80 text-sm">Explore →</p>
              </div>
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Featured Products</h2>
          <Link to="/products" className="text-orange-500 text-sm font-medium">View All →</Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-80 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {featuredProducts.map(p => <ProductCard key={p.id} product={p} />)}
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
        const params = new URLSearchParams();
        if (category) params.append("category", category);
        if (search) params.append("search", search);
        const res = await axios.get(`\( {API}/products? \){params}`);
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
        {category ? category.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()) : search ? `Search: ${search}` : "All Products"}
      </h1>
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <div key={i} className="skeleton h-80 rounded-xl" />)}
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
        const res = await axios.get(`\( {API}/products/ \){id}`);
        setProduct(res.data);
      } catch {}
      finally { setLoading(false); }
    };
    fetchProduct();
  }, [id]);

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-16"><div className="skeleton h-96 rounded-2xl" /></div>;
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
      const res = await axios.post(`${API}/orders`, {
        shipping_address: formData,
        cart_id: localStorage.getItem("cartId")
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      const { order } = res.data;
      
      const stripeRes = await axios.post(`${API}/checkout/stripe`, {
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
