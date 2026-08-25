import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  Truck,
  Shield,
  Package,
  CreditCard,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/AppContext";
import ProductCard from "@/components/ProductCard";

const HomePage = () => {
  const { categories, API } = useApp();
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const res = await axios.get(`${API}/products/featured?limit=8`);
        setFeaturedProducts(res.data);
      } catch (error) {
        console.error("Failed to fetch featured products:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchFeatured();
  }, [API]);

  const heroImages = {
    "womens-fashion":
      "https://images.unsplash.com/photo-1587987746776-302404b98970?w=800",
    "mens-fashion":
      "https://images.unsplash.com/photo-1658860547138-1e28dfb90867?w=600",
    electronics:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600"
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
        background:
          "linear-gradient(135deg, #0A0A1F 0%, #0D0D24 50%, #0A0A1F 100%)",
        borderRadius: "40px"
      }}
    >
      <img
        src="https://customer-assets.emergentagent.com/job_dfe494f7-bb89-4ed5-9943-bc15fa3ca74e/artifacts/q3ekjzjv_1000005914.jpg"
        alt="NOVAXS - The future of e-commerce"
        className="w-full h-full object-contain"
      />
    </div>

    {/* Secondary Cards - Show top categories */}
    <div className="md:col-span-4 grid grid-cols-2 gap-4">
      {categories.slice(0, 4).map((cat) => (
        <Link
          key={cat.id}
          to={`/products?category=${cat.slug}`}
          className="relative rounded-2xl overflow-hidden group min-h-[180px] md:min-h-[240px]"
        >
          <img
            src={cat.image || "https://via.placeholder.com/400"}
            alt={cat.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-3 left-3 text-white">
            <h3 className="text-sm md:text-base font-bold leading-tight">
              {cat.name}
            </h3>
            <p className="text-white/80 text-xs">Explore →</p>
          </div>
        </Link>
      ))}
    </div>
  </div>
</section> 
      {/* Trust Badges */}
      <section className="bg-slate-50 py-8 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Truck, title: "Free Shipping", desc: "Orders over $50" },
              {
                icon: Shield,
                title: "Secure Payment",
                desc: "Stripe Protected"
              },
              {
                icon: Package,
                title: "Fast Delivery",
                desc: "Worldwide Shipping"
              },
              {
                icon: CreditCard,
                title: "Easy Returns",
                desc: "30-day guarantee"
              }
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
          <Link
            to="/products"
            className="text-orange-500 font-medium flex items-center gap-1"
            data-testid="view-all-cats"
          >
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
          <Link
            to="/products"
            className="text-orange-500 font-medium flex items-center gap-1"
            data-testid="view-all-products"
          >
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
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
            How Novaxs Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Shop & Checkout",
                desc: "Browse our curated collection and pay securely with Stripe."
              },
              {
                step: "02",
                title: "We Handle Everything",
                desc: "Your order is automatically processed and shipped from our global warehouses."
              },
              {
                step: "03",
                title: "Delivered to You",
                desc: "Sit back and relax while your order arrives at your doorstep."
              }
            ].map((item, i) => (
              <div key={i} className="text-center" data-testid={`how-it-works-${i}`}>
                <div className="inline-block text-6xl font-extrabold text-orange-500 mb-4">
                  {item.step}
                </div>
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

export default HomePage;
