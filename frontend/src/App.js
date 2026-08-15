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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { AdminDashboard } from "@/AdminDashboard";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Context
const AppContext = createContext(null);

const useApp = () => useContext(AppContext);

// Generate cart ID
const getCartId = () => {
  let cartId = localStorage.getItem("cartId");
  if (!cartId) {
    cartId = `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("cartId", cartId);
  }
  return cartId;
};

// App Provider
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
        const cartRes = await axios.get(`${API}/cart/${getCartId()}`);
        setCart(cartRes.data);
      } catch {
        // Cart will be created on first add
      }
      try {
        const catRes = await axios.get(`${API}/categories`);
        setCategories(catRes.data);
      } catch {
        // Use default categories
      }
    };
    initializeApp();
  }, []);

  const fetchUser = async (token) => {
    try {
      const res = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(res.data);
    } catch {
      localStorage.removeItem("token");
    }
  };

  const fetchCart = async () => {
    try {
      const res = await axios.get(`${API}/cart/${getCartId()}`);
      setCart(res.data);
    } catch {
      // Silent fail - cart created on first add
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await axios.get(`${API}/categories`);
      setCategories(res.data);
    } catch {
      // Use default categories
    }
  };

  const addToCart = async (productId, variantId = null, quantity = 1) => {
    try {
      const res = await axios.post(`${API}/cart/${getCartId()}/items`, {
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
      const res = await axios.put(`${API}/cart/${getCartId()}/items/${productId}?quantity=${quantity}`);
      setCart(res.data);
    } catch (e) {
      toast.error("Failed to update cart");
    }
  };

  const removeFromCart = async (productId) => {
    try {
      const res = await axios.delete(`${API}/cart/${getCartId()}/items/${productId}`);
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

// Header Component
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
      {/* Main Header - Dark purple-blue background */}
      <div className="py-4" style={{ backgroundColor: '#0A0A1F' }}>
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between gap-4">
          {/* Left: Logo */}
          <Link to="/" className="flex-shrink-0" data-testid="logo">
            <img 
              src="https://customer-assets.emergentagent.com/job_dfe494f7-bb89-4ed5-9943-bc15fa3ca74e/artifacts/g0y20dm6_image-1.jpg" 
              alt="NOVAXS" 
              className="h-12 md:h-14 object-contain"
              style={{ filter: 'drop-shadow(0 0 10px rgba(160, 32, 240, 0.5))' }}
            />
          </Link>

          {/* Center: Search Bar */}
          <form onSubmit={handleSearch} className="flex-1 max-w-xl hidden md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#A020F0' }} />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border-2 focus:outline-none transition-all"
                style={{ 
                  backgroundColor: '#1A1A2E', 
                  borderColor: '#A020F0',
                  color: '#E0E0FF'
                }}
                onFocus={(e) => e.target.style.boxShadow = '0 0 12px rgba(160, 32, 240, 0.5)'}
                onBlur={(e) => e.target.style.boxShadow = 'none'}
                data-testid="search-input"
              />
            </div>
          </form>

          {/* Right: Cart Icon with Drawer */}
          <Sheet>
            <SheetTrigger asChild>
              <button className="relative p-2" data-testid="cart-btn">
                <ShoppingCart 
                  className="w-7 h-7" 
                  style={{ color: '#A020F0', filter: 'drop-shadow(0 0 8px rgba(160, 32, 240, 0.6))' }} 
                />
                {cartItemsCount > 0 && (
                  <span 
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center text-white"
                    style={{ backgroundColor: '#A020F0' }}
                  >
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

        {/* Mobile Search */}
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
                style={{ 
                  backgroundColor: '#1A1A2E', 
                  borderColor: '#A020F0',
                  color: '#E0E0FF'
                }}
              />
            </div>
          </form>
        </div>
      </div>
    </header>
  );
};

// Auth Dialog
const AuthDialog = ({ onClose }) => {
  const { login, register } = useApp();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    let success;
    if (isLogin) {
      success = await login(formData.email, formData.password);
    } else {
      success = await register(formData.name, formData.email, formData.password);
    }
    setLoading(false);
    if (success && onClose) onClose();
  };

  return (
    <div className="p-4">
      <DialogHeader>
        <DialogTitle>{isLogin ? "Welcome Back" : "Create Account"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {!isLogin && (
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Your name"
              required
              data-testid="auth-name"
            />
          </div>
        )}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="your@email.com"
            required
            data-testid="auth-email"
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder="••••••••"
            required
            data-testid="auth-password"
          />
        </div>
        <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600" disabled={loading} data-testid="auth-submit">
          {loading ? "Please wait..." : (isLogin ? "Sign In" : "Create Account")}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        {isLogin ? "Don't have an account? " : "Already have an account? "}
        <button onClick={() => setIsLogin(!isLogin)} className="text-orange-500 font-medium" data-testid="auth-toggle">
          {isLogin ? "Sign Up" : "Sign In"}
        </button>
      </p>
    </div>
  );
};

// Cart Drawer
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
            <div key={item.product_id} className="flex gap-4 p-4 bg-slate-50 rounded-lg" data-testid={`cart-item-${item.product_id}`}>
              <img 
                src={item.product?.image || "https://via.placeholder.com/80"} 
                alt={item.product?.name}
                className="w-20 h-20 object-cover rounded-lg"
              />
              <div className="flex-1">
                <h4 className="font-medium text-sm line-clamp-2">{item.product?.name}</h4>
                <p className="text-orange-500 font-bold mt-1">${item.product?.price?.toFixed(2)}</p>
                <div className="flex items-center gap-2 mt-2">
                  <button 
                    onClick={() => updateCartItem(item.product_id, Math.max(0, item.quantity - 1))}
                    className="p-1 hover:bg-slate-200 rounded"
                    data-testid={`decrease-${item.product_id}`}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center">{item.quantity}</span>
                  <button 
                    onClick={() => updateCartItem(item.product_id, item.quantity + 1)}
                    className="p-1 hover:bg-slate-200 rounded"
                    data-testid={`increase-${item.product_id}`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => removeFromCart(item.product_id)}
                    className="ml-auto p-1 hover:bg-red-100 text-red-500 rounded"
                    data-testid={`remove-${item.product_id}`}
                  >
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
          data-testid="checkout-btn"
        >
          Checkout
        </Button>
      </div>
    </div>
  );
};

// Product Card
const ProductCard = ({ product }) => {
  const { addToCart } = useApp();
  
  const discount = product.compare_price 
    ? Math.round((1 - product.price / product.compare_price) * 100) 
    : 0;

  return (
    <div className="product-card group relative bg-white rounded-xl overflow-hidden border border-slate-100" data-testid={`product-card-${product.id}`}>
      <Link to={`/product/${product.id}`}>
        <div className="relative aspect-square overflow-hidden bg-slate-100">
          <img 
            src={product.image} 
            alt={product.name}
            className="product-image w-full h-full object-cover transition-transform duration-300"
            loading="lazy"
          />
          {discount > 0 && (
            <Badge className="absolute top-3 left-3 bg-orange-500">-{discount}%</Badge>
          )}
        </div>
      </Link>
      
      <div className="p-4">
        <Link to={`/product/${product.id}`}>
          <h3 className="font-semibold text-sm line-clamp-2 h-10 hover:text-orange-500 transition-colors">
            {product.name}
          </h3>
        </Link>
        
        <div className="flex items-center gap-1 mt-2">
          {[...Array(5)].map((_, i) => (
            <Star 
              key={i} 
              className={`w-3.5 h-3.5 ${i < Math.floor(product.rating) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
            />
          ))}
          <span className="text-xs text-slate-500 ml-1">({product.reviews_count})</span>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <span className="text-lg font-bold text-orange-500">${product.price?.toFixed(2)}</span>
          {product.compare_price && (
            <span className="text-sm text-slate-400 line-through">${product.compare_price?.toFixed(2)}</span>
          )}
        </div>

        <Button 
          className="w-full mt-3 bg-slate-900 hover:bg-orange-500 transition-colors"
          onClick={(e) => { e.preventDefault(); addToCart(product.id); }}
          data-testid={`add-to-cart-${product.id}`}
        >
          Add to Cart
        </Button>
      </div>
    </div>
  );
};

// Home Page
const HomePage = () => {
  const { categories } = useApp();
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const res = await axios.get(`${API}/products/featured?limit=8`);
        setFeaturedProducts(res.data);
      } catch {
        // Silent fail - featured products optional
      } finally {
        setLoading(false);
      }
    };
    fetchFeatured();
  }, []);

  const heroImages = {
    "womens-fashion": "https://images.unsplash.com/photo-1587987746776-302404b98970?w=800",
    "mens-fashion": "https://images.unsplash.com/photo-1658860547138-1e28dfb90867?w=600",
    "electronics": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600"
  };

  return (
    <div data-testid="home-page">
      {/* Hero Section - Bento Grid */}
      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Main Hero - NOVAXS Logo */}
          <div 
            className="md:col-span-8 overflow-hidden md:h-[500px] aspect-[4/3] md:aspect-auto"
            style={{ 
              background: 'linear-gradient(135deg, #0A0A1F 0%, #0D0D24 50%, #0A0A1F 100%)',
              borderRadius: '40px'
            }}
          >
            <img 
              src="https://customer-assets.emergentagent.com/job_dfe494f7-bb89-4ed5-9943-bc15fa3ca74e/artifacts/q3ekjzjv_1000005914.jpg"
              alt="NOVAXS - The future of e-commerce"
              className="w-full h-full object-contain"
            />
          </div>

          {/* Secondary Cards */}
          <div className="md:col-span-4 flex flex-col gap-4">
            <Link to="/products?category=mens-fashion" className="flex-1 relative rounded-2xl overflow-hidden group min-h-[240px]">
              <img 
                src={heroImages["mens-fashion"]}
                alt="Men's Fashion"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-4 left-4 text-white">
                <h3 className="text-xl font-bold">Men's Fashion</h3>
                <p className="text-white/80 text-sm">Explore →</p>
              </div>
            </Link>
            <Link to="/products?category=electronics" className="flex-1 relative rounded-2xl overflow-hidden group min-h-[240px]">
              <img 
                src={heroImages["electronics"]}
                alt="Electronics"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-4 left-4 text-white">
                <h3 className="text-xl font-bold">Electronics</h3>
                <p className="text-white/80 text-sm">Explore →</p>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="bg-slate-50 py-8 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Truck, title: "Free Shipping", desc: "Orders over $50" },
              { icon: Shield, title: "Secure Payment", desc: "Stripe Protected" },
              { icon: Package, title: "Fast Delivery", desc: "Worldwide Shipping" },
              { icon: CreditCard, title: "Easy Returns", desc: "30-day guarantee" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3" data-testid={`trust-badge-${i}`}>
                <div className="p-3 bg-orange-100 rounded-xl">
                  <item.icon className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">{item.title}</h4>
                  <p className="text-xs text-slate-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl md:text-3xl font-bold">Shop by Category</h2>
          <Link to="/products" className="text-orange-500 font-medium flex items-center gap-1" data-testid="view-all-cats">
            View All <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {categories.map((cat) => (
            <Link 
              key={cat.id} 
              to={`/products?category=${cat.slug}`}
              className="group"
              data-testid={`category-card-${cat.slug}`}
            >
              <div className="category-card">
                <img 
                  src={cat.image || "https://via.placeholder.com/200"}
                  alt={cat.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute bottom-4 left-4 right-4 z-10 text-white">
                  <h3 className="font-bold text-sm md:text-base">{cat.name}</h3>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Products */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl md:text-3xl font-bold">Featured Products</h2>
          <Link to="/products" className="text-orange-500 font-medium flex items-center gap-1" data-testid="view-all-products">
            View All <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="skeleton h-80 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 stagger-children">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* How It Works */}
      <section className="bg-slate-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">How Novaxs Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Shop & Checkout", desc: "Browse our curated collection and pay securely with Stripe." },
              { step: "02", title: "We Handle Everything", desc: "Your order is automatically processed and shipped from our global warehouses." },
              { step: "03", title: "Delivered to You", desc: "Sit back and relax while your order arrives at your doorstep." },
            ].map((item, i) => (
              <div key={i} className="text-center" data-testid={`how-it-works-${i}`}>
                <div className="inline-block text-6xl font-extrabold text-orange-500 mb-4">{item.step}</div>
                <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                <p className="text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

// Products Page
const ProductsPage = () => {
  const [searchParams] = useSearchParams();
  const { categories } = useApp();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("newest");

  const category = searchParams.get("category");
  const search = searchParams.get("search");

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page, limit: 20, sort });
        if (category) params.append("category", category);
        if (search) params.append("search", search);
        
        const res = await axios.get(`${API}/products?${params}`);
        setProducts(res.data.products);
        setTotal(res.data.total);
      } catch {
        // Products fetch failed
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [category, search, page, sort]);

  const currentCategory = categories.find(c => c.slug === category);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8" data-testid="products-page">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <Link to="/" className="hover:text-orange-500">Home</Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-slate-900">{currentCategory?.name || (search ? `Search: "${search}"` : "All Products")}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">
            {currentCategory?.name || (search ? `Results for "${search}"` : "All Products")}
          </h1>
          <p className="text-slate-500 mt-1">{total} products found</p>
        </div>
        
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-48" data-testid="sort-select">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="price_low">Price: Low to High</SelectItem>
            <SelectItem value="price_high">Price: High to Low</SelectItem>
            <SelectItem value="popular">Most Popular</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="skeleton h-80 rounded-xl" />
          ))}
        </div>
      ) : products.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-slate-500">No products found</p>
          <Link to="/products">
            <Button className="mt-4 bg-orange-500">View All Products</Button>
          </Link>
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-center gap-2 mt-12">
          <Button 
            variant="outline" 
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="flex items-center px-4 text-sm">
            Page {page} of {Math.ceil(total / 20)}
          </span>
          <Button 
            variant="outline"
            onClick={() => setPage(p => p + 1)}
            disabled={page >= Math.ceil(total / 20)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

// Product Detail Page
const ProductDetailPage = () => {
  const { id } = useParams();
  const { addToCart } = useApp();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await axios.get(`${API}/products/${id}`);
        setProduct(res.data);
      } catch {
        // Product fetch failed
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  const handleAddToCart = async () => {
    for (let i = 0; i < quantity; i++) {
      await addToCart(product.id);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-12">
          <div className="skeleton aspect-square rounded-2xl" />
          <div className="space-y-4">
            <div className="skeleton h-8 w-3/4 rounded" />
            <div className="skeleton h-6 w-1/4 rounded" />
            <div className="skeleton h-24 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4">Product not found</h2>
        <Link to="/products">
          <Button className="bg-orange-500">Browse Products</Button>
        </Link>
      </div>
    );
  }

  const discount = product.compare_price 
    ? Math.round((1 - product.price / product.compare_price) * 100) 
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8" data-testid="product-detail-page">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <Link to="/" className="hover:text-orange-500">Home</Link>
        <ChevronRight className="w-4 h-4" />
        <Link to={`/products?category=${product.category}`} className="hover:text-orange-500 capitalize">
          {product.category?.replace("-", " ")}
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-slate-900 line-clamp-1">{product.name}</span>
      </div>

      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-600 hover:text-orange-500 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="grid md:grid-cols-2 gap-12">
        {/* Image */}
        <div className="space-y-4">
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-slate-100">
            <img 
              src={product.image} 
              alt={product.name}
              className="w-full h-full object-cover"
            />
            {discount > 0 && (
              <Badge className="absolute top-4 left-4 bg-orange-500 text-lg px-3 py-1">-{discount}%</Badge>
            )}
          </div>
          {product.images?.length > 1 && (
            <div className="flex gap-2">
              {product.images.map((img, i) => (
                <div key={i} className="w-20 h-20 rounded-lg overflow-hidden border-2 border-slate-200">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-4" data-testid="product-name">{product.name}</h1>
          
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star 
                  key={i} 
                  className={`w-5 h-5 ${i < Math.floor(product.rating) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
                />
              ))}
            </div>
            <span className="text-slate-500">({product.reviews_count} reviews)</span>
          </div>

          <div className="flex items-baseline gap-3 mb-6">
            <span className="text-3xl font-bold text-orange-500" data-testid="product-price">${product.price?.toFixed(2)}</span>
            {product.compare_price && (
              <span className="text-xl text-slate-400 line-through">${product.compare_price?.toFixed(2)}</span>
            )}
          </div>

          <p className="text-slate-600 mb-6 leading-relaxed">{product.description}</p>

          <div className="flex items-center gap-4 mb-6">
            <Label>Quantity</Label>
            <div className="flex items-center border rounded-lg">
              <button 
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="p-3 hover:bg-slate-100"
                data-testid="decrease-qty"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-12 text-center font-medium">{quantity}</span>
              <button 
                onClick={() => setQuantity(q => q + 1)}
                className="p-3 hover:bg-slate-100"
                data-testid="increase-qty"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex gap-4">
            <Button 
              className="flex-1 h-14 bg-orange-500 hover:bg-orange-600 text-lg font-semibold"
              onClick={handleAddToCart}
              data-testid="add-to-cart-detail"
            >
              Add to Cart
            </Button>
            <Button variant="outline" size="icon" className="h-14 w-14">
              <Heart className="w-6 h-6" />
            </Button>
          </div>

          <div className="mt-8 space-y-3">
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <Truck className="w-5 h-5 text-green-500" />
              <span>Free shipping on orders over $50</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <Shield className="w-5 h-5 text-green-500" />
              <span>Secure Stripe checkout</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <Package className="w-5 h-5 text-green-500" />
              <span>Worldwide delivery</span>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <ProductReviews productId={product.id} />
    </div>
  );
};

// Product Reviews Component
const ProductReviews = ({ productId }) => {
  const { user } = useApp();
  const [reviews, setReviews] = useState([]);
  const [distribution, setDistribution] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, title: "", comment: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchReviews = useCallback(async () =\> {
  try {
    const res = await axios.get(`${API}/products/${productId}/reviews`);
    setReviews(res.data.reviews);
    setDistribution(res.data.distribution);
  } catch (error) {
    // Fetch failed
  } finally {
    setLoading(false);
  }
}, [productId]);

useEffect(() => {
  fetchReviews();
}, [fetchReviews]);

  useEffect(() => {
    fetchReviews();
  }, [productId]);

    try {
      const res = await axios.get(`${API}/products/${productId}/reviews`);
      setReviews(res.data.reviews);
      setDistribution(res.data.distribution);
    } catch (error) {
      // Reviews fetch failed
    } finally {
      setLoading(false);
    }
  };

  const submitReview = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/products/${productId}/reviews`, {
        product_id: productId,
        ...newReview
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      toast.success("Review submitted!");
      setShowForm(false);
      setNewReview({ rating: 5, title: "", comment: "" });
      fetchReviews();
    } catch (e) {
      toast.error("Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  const markHelpful = async (reviewId) => {
    try {
      await axios.post(`${API}/reviews/${reviewId}/helpful`);
      toast.success("Marked as helpful");
      fetchReviews();
    } catch {
      // Mark helpful failed
    }
  };

  const avgRating = reviews.length > 0 
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : 0;

  return (
    <div className="mt-16 border-t pt-12" data-testid="product-reviews">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold">Customer Reviews</h2>
        <Button onClick={() => setShowForm(!showForm)} className="bg-orange-500 hover:bg-orange-600">
          Write a Review
        </Button>
      </div>

      {/* Review Form */}
      {showForm && (
        <form onSubmit={submitReview} className="bg-slate-50 rounded-xl p-6 mb-8">
          <h3 className="font-semibold mb-4">Write Your Review</h3>
          <div className="mb-4">
            <Label>Rating</Label>
            <div className="flex gap-2 mt-2">
              {[1,2,3,4,5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setNewReview({ ...newReview, rating: star })}
                  className="focus:outline-none"
                >
                  <Star className={`w-8 h-8 ${star <= newReview.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                </button>
              ))}
            </div>
          </div>
          <div className="mb-4">
            <Label>Title</Label>
            <Input 
              value={newReview.title}
              onChange={(e) => setNewReview({ ...newReview, title: e.target.value })}
              placeholder="Summarize your review"
              required
            />
          </div>
          <div className="mb-4">
            <Label>Review</Label>
            <textarea
              value={newReview.comment}
              onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
              placeholder="Share your experience with this product"
              className="w-full h-32 p-3 border rounded-lg focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              required
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting} className="bg-orange-500 hover:bg-orange-600">
              {submitting ? "Submitting..." : "Submit Review"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {/* Reviews Summary */}
      <div className="grid md:grid-cols-3 gap-8 mb-8">
        <div className="text-center p-6 bg-slate-50 rounded-xl">
          <p className="text-5xl font-bold text-orange-500">{avgRating}</p>
          <div className="flex justify-center gap-1 my-2">
            {[1,2,3,4,5].map((star) => (
              <Star key={star} className={`w-5 h-5 ${star <= Math.round(avgRating) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
            ))}
          </div>
          <p className="text-slate-500">{reviews.length} reviews</p>
        </div>
        <div className="md:col-span-2 space-y-2">
          {[5,4,3,2,1].map((star) => (
            <div key={star} className="flex items-center gap-3">
              <span className="w-8 text-sm">{star} ★</span>
              <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-400 rounded-full"
                  style={{ width: `${reviews.length > 0 ? (distribution[star] || 0) / reviews.length * 100 : 0}%` }}
                />
              </div>
              <span className="w-8 text-sm text-slate-500">{distribution[star] || 0}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Reviews List */}
      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map((i) => <div key={i} className="h-32 skeleton rounded-xl" />)}
        </div>
      ) : reviews.length > 0 ? (
        <div className="space-y-6">
          {reviews.map((review) => (
            <div key={review.id} className="border-b pb-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[1,2,3,4,5].map((star) => (
                        <Star key={star} className={`w-4 h-4 ${star <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                      ))}
                    </div>
                    {review.verified_purchase && (
                      <Badge className="bg-green-100 text-green-700 text-xs">Verified Purchase</Badge>
                    )}
                  </div>
                  <h4 className="font-semibold mt-2">{review.title}</h4>
                </div>
                <span className="text-sm text-slate-500">{new Date(review.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-slate-600 mt-2">{review.comment}</p>
              <div className="flex items-center gap-4 mt-3">
                <span className="text-sm text-slate-500">By {review.user_name}</span>
                <button 
                  onClick={() => markHelpful(review.id)}
                  className="text-sm text-slate-500 hover:text-orange-500"
                >
                  Helpful ({review.helpful_count})
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-slate-500 py-8">No reviews yet. Be the first to review this product!</p>
      )}
    </div>
  );
};

// Contact Page
const ContactPage = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
    order_number: ""
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/contact`, formData);
      toast.success("Message sent! We'll get back to you soon.");
      setSubmitted(true);
    } catch (e) {
      toast.error("Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold mb-4">Message Sent!</h1>
        <p className="text-slate-600 mb-8">Thank you for contacting us. We'll respond within 24 hours.</p>
        <Link to="/">
          <Button className="bg-orange-500 hover:bg-orange-600">Continue Shopping</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12" data-testid="contact-page">
      <h1 className="text-3xl font-bold mb-2">Contact Us</h1>
      <p className="text-slate-600 mb-8">Have a question? We're here to help!</p>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Name</Label>
                <Input 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input 
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <Label>Order Number (optional)</Label>
              <Input 
                value={formData.order_number}
                onChange={(e) => setFormData({ ...formData, order_number: e.target.value })}
                placeholder="NVX..."
              />
            </div>
            <div>
              <Label>Subject</Label>
              <Select value={formData.subject} onValueChange={(v) => setFormData({ ...formData, subject: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a topic" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Order Status">Order Status</SelectItem>
                  <SelectItem value="Shipping & Delivery">Shipping & Delivery</SelectItem>
                  <SelectItem value="Returns & Refunds">Returns & Refunds</SelectItem>
                  <SelectItem value="Product Question">Product Question</SelectItem>
                  <SelectItem value="Technical Issue">Technical Issue</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Message</Label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full h-32 p-3 border rounded-lg focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                required
              />
            </div>
            <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600" disabled={loading}>
              {loading ? "Sending..." : "Send Message"}
            </Button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-50 rounded-xl p-6">
            <h3 className="font-semibold mb-3">Shipping & Product Issues</h3>
            <p className="text-sm text-slate-600">For shipping, returns, or product quality issues, our fulfillment partner handles these directly.</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-6">
            <h3 className="font-semibold mb-3">Response Time</h3>
            <p className="text-sm text-slate-600">We typically respond within 24 hours during business days.</p>
          </div>
          <div className="bg-orange-50 rounded-xl p-6">
            <h3 className="font-semibold mb-3 text-orange-700">Email Us Directly</h3>
            <p className="text-sm text-orange-600">novaxs6969@gmail.com</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Checkout Page
const CheckoutPage = () => {
  const { cart, user, fetchCart } = useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: "",
    address: "",
    address2: "",
    city: "",
    state: "",
    zip_code: "",
    country: "United States",
    country_code: "US"
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
      // Step 1: Create order
      const res = await axios.post(`${API}/orders`, {
        shipping_address: formData,
        cart_id: localStorage.getItem("cartId")
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      const { order } = res.data;
      
      // Step 2: Create Stripe checkout session
      const stripeRes = await axios.post(`${API}/checkout/stripe`, {
        order_id: order.id,
        origin_url: window.location.origin + "/"
      });
      
      // Step 3: Redirect to Stripe
      if (stripeRes.data.checkout_url) {
        window.location.href = stripeRes.data.checkout_url;
      } else {
        toast.error("Failed to create payment session");
        setLoading(false);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to place order");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50" data-testid="checkout-page">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-600 hover:text-orange-500 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to cart
        </button>

        <h1 className="text-2xl md:text-3xl font-bold mb-8">Checkout</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-bold mb-6">Shipping Information</h2>
              
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Full Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    data-testid="checkout-name"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    data-testid="checkout-email"
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                    data-testid="checkout-phone"
                  />
                </div>
                <div>
                  <Label>Country</Label>
                  <Select 
                    value={formData.country_code} 
                    onValueChange={(v) => setFormData({ ...formData, country_code: v, country: v === "US" ? "United States" : v })}
                  >
                    <SelectTrigger data-testid="checkout-country">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="US">United States</SelectItem>
                      <SelectItem value="CA">Canada</SelectItem>
                      <SelectItem value="GB">United Kingdom</SelectItem>
                      <SelectItem value="AU">Australia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label>Address</Label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    required
                    data-testid="checkout-address"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Apartment, suite, etc. (optional)</Label>
                  <Input
                    value={formData.address2}
                    onChange={(e) => setFormData({ ...formData, address2: e.target.value })}
                  />
                </div>
                <div>
                  <Label>City</Label>
                  <Input
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    required
                    data-testid="checkout-city"
                  />
                </div>
                <div>
                  <Label>State</Label>
                  <Input
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    required
                    data-testid="checkout-state"
                  />
                </div>
                <div>
                  <Label>ZIP Code</Label>
                  <Input
                    value={formData.zip_code}
                    onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                    required
                    data-testid="checkout-zip"
                  />
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

              <Button 
                type="submit" 
                className="w-full mt-8 h-14 bg-orange-500 hover:bg-orange-600 text-lg font-semibold"
                disabled={loading}
                data-testid="place-order-btn"
              >
                {loading ? "Processing..." : `Place Order • $${total.toFixed(2)}`}
              </Button>
            </form>
          </div>

          {/* Order Summary */}
          <div>
            <div className="bg-white rounded-2xl p-6 shadow-sm sticky top-24">
              <h2 className="text-xl font-bold mb-6">Order Summary</h2>
              
              <div className="space-y-4 mb-6">
                {cart?.items?.map((item) => (
                  <div key={item.product_id} className="flex gap-3">
                    <img 
                      src={item.product?.image} 
                      alt={item.product?.name}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium line-clamp-2">{item.product?.name}</p>
                      <p className="text-sm text-slate-500">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-medium">${(item.product?.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
              </div>

              <Separator className="my-4" />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Shipping</span>
                  <span>{shipping === 0 ? "FREE" : `$${shipping.toFixed(2)}`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Tax</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-orange-500" data-testid="checkout-total">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Order Confirmation Page
const OrderConfirmationPage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentChecking, setPaymentChecking] = useState(false);
  const { fetchCart } = useApp();

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    
    const fetchOrder = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${API}/orders/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        setOrder(res.data);
        
        // If we have a session_id, poll for payment status
        if (sessionId && res.data.payment_status !== "paid") {
          pollPaymentStatus(sessionId, res.data);
        }
      } catch {
        // Order fetch failed
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id, searchParams]);

  const pollPaymentStatus = async (sessionId, currentOrder, attempts = 0) => {
    if (attempts >= 5 || currentOrder.payment_status === "paid") {
      setPaymentChecking(false);
      fetchCart();
      return;
    }
    
    setPaymentChecking(true);
    try {
      const res = await axios.get(`${API}/checkout/status/${sessionId}?origin_url=${window.location.origin}/`);
      if (res.data.payment_status === "paid") {
        // Refetch order to get updated status
        const token = localStorage.getItem("token");
        const orderRes = await axios.get(`${API}/orders/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        setOrder(orderRes.data);
        setPaymentChecking(false);
        fetchCart();
        toast.success("Payment confirmed!");
      } else {
        setTimeout(() => pollPaymentStatus(sessionId, currentOrder, attempts + 1), 2000);
      }
    } catch {
      setTimeout(() => pollPaymentStatus(sessionId, currentOrder, attempts + 1), 2000);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="skeleton h-48 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center" data-testid="order-confirmation">
      <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
        <Check className="w-10 h-10 text-green-600" />
      </div>
      
      <h1 className="text-3xl font-bold mb-4">Order Confirmed!</h1>
      <p className="text-slate-600 mb-8">
        {paymentChecking ? "Confirming your payment..." : "Thank you for your purchase. Your order is being processed."}
      </p>

      <div className="bg-white rounded-2xl p-6 shadow-sm text-left mb-8">
        <div className="flex justify-between items-center mb-4">
          <span className="text-slate-600">Order Number</span>
          <span className="font-mono font-bold" data-testid="order-number">{order?.order_number}</span>
        </div>
        <div className="flex justify-between items-center mb-4">
          <span className="text-slate-600">Payment Status</span>
          <Badge className={order?.payment_status === "paid" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>
            {paymentChecking ? "Confirming..." : order?.payment_status}
          </Badge>
        </div>
        <div className="flex justify-between items-center mb-4">
          <span className="text-slate-600">Order Status</span>
          <Badge className="bg-blue-100 text-blue-700">{order?.status}</Badge>
        </div>
        <div className="flex justify-between items-center mb-4">
          <span className="text-slate-600">Total</span>
          <span className="font-bold text-orange-500">${order?.total?.toFixed(2)}</span>
        </div>
        {order?.tracking_number && (
          <div className="flex justify-between items-center">
            <span className="text-slate-600">Tracking</span>
            <span className="font-mono">{order?.tracking_number}</span>
          </div>
        )}
      </div>

      <div className="flex gap-4 justify-center">
        <Link to="/orders">
          <Button variant="outline">View Orders</Button>
        </Link>
        <Link to="/products">
          <Button className="bg-orange-500 hover:bg-orange-600">Continue Shopping</Button>
        </Link>
      </div>
    </div>
  );
};

// Orders Page
const OrdersPage = () => {
  const { user } = useApp();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }
    
    const fetchOrders = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${API}/orders`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setOrders(res.data.orders);
      } catch {
        // Orders fetch failed
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [user, navigate]);

  const getStatusColor = (status) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-700",
      processing: "bg-blue-100 text-blue-700",
      shipped: "bg-purple-100 text-purple-700",
      delivered: "bg-green-100 text-green-700",
      cancelled: "bg-red-100 text-red-700"
    };
    return colors[status] || "bg-slate-100 text-slate-700";
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8" data-testid="orders-page">
      <h1 className="text-2xl md:text-3xl font-bold mb-8">My Orders</h1>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-32 rounded-xl" />
          ))}
        </div>
      ) : orders.length > 0 ? (
        <div className="space-y-4">
          {orders.map((order) => (
            <Link 
              key={order.id} 
              to={`/order-confirmation/${order.id}`}
              className="block bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
              data-testid={`order-${order.id}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="font-mono font-bold">{order.order_number}</p>
                  <p className="text-sm text-slate-500 mt-1">
                    {new Date(order.created_at).toLocaleDateString()} • {order.items?.length} items
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                  <span className="font-bold text-orange-500">${order.total?.toFixed(2)}</span>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No orders yet</h3>
          <p className="text-slate-500 mb-6">Start shopping to see your orders here</p>
          <Link to="/products">
            <Button className="bg-orange-500">Start Shopping</Button>
          </Link>
        </div>
      )}
    </div>
  );
};

// Footer
const Footer = () => {
  return (
    <footer className="bg-slate-900 text-white mt-16" data-testid="footer">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-xl font-bold mb-4">
              <span className="text-orange-500">Nova</span>
              <span className="text-white">xs</span>
            </h3>
            <p className="text-slate-400 text-sm">
              Your one-stop shop for amazing deals. Quality products, fast delivery worldwide.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Shop</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><Link to="/products?category=womens-fashion" className="hover:text-orange-500">Women's Fashion</Link></li>
              <li><Link to="/products?category=mens-fashion" className="hover:text-orange-500">Men's Fashion</Link></li>
              <li><Link to="/products?category=electronics" className="hover:text-orange-500">Electronics</Link></li>
              <li><Link to="/products?category=pet-supplies" className="hover:text-orange-500">Pet Supplies</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Customer Service</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><Link to="/contact" className="hover:text-orange-500">Contact Us</Link></li>
              <li><Link to="/contact" className="hover:text-orange-500">Shipping Info</Link></li>
              <li><Link to="/contact" className="hover:text-orange-500">Returns</Link></li>
              <li><Link to="/contact" className="hover:text-orange-500">FAQ</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Connect</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><a href="#" className="hover:text-orange-500">About Us</a></li>
              <li><a href="#" className="hover:text-orange-500">Blog</a></li>
              <li><a href="#" className="hover:text-orange-500">Instagram</a></li>
              <li><a href="#" className="hover:text-orange-500">Twitter</a></li>
            </ul>
          </div>
        </div>
        <Separator className="my-8 bg-slate-700" />
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-slate-400">
          <p>© 2024 Novaxs. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-orange-500">Privacy Policy</a>
            <a href="#" className="hover:text-orange-500">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

// Main App
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
              <Route path="/order-confirmation/:id" element={<OrderConfirmationPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/admin" element={<AdminDashboard />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </AppProvider>
    </BrowserRouter>
  );
}

export default App;
