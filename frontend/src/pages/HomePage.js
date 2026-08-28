import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  Truck,
  Shield,
  Package,
  CreditCard,
  ChevronRight,
  Star
} from "lucide-react";
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

  return (
    <div data-testid="home-page" className="bg-white">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 pt-6 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Main Banner */}
          <div className="lg:col-span-8 relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0A0A1F] via-[#0D0D2B] to-[#0A0A1F] min-h-[340px] md:min-h-[420px] flex items-center justify-center">
            <img
              src="https://customer-assets.emergentagent.com/job_dfe494f7-bb89-4ed5-9943-bc15fa3ca74e/artifacts/q3ekjzjv_1000005914.jpg"
              alt="NOVAXS"
              className="absolute inset-0 w-full h-full object-contain opacity-90"
            />
            <div className="relative z-10 text-center px-6">
              <h1 className="text-3xl md:text-5xl font-bold text-white mb-3 tracking-tight">
                NOVAXS
              </h1>
              <p className="text-white/70 text-sm md:text-base mb-6">
                The future of e-commerce
              </p>
              <Link
                to="/products"
                className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-3 rounded-full transition"
              >
                Shop Now <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Category Cards */}
          <div className="lg:col-span-4 grid grid-cols-2 gap-4">
            {categories.slice(0, 4).map((cat) => (
              <Link
                key={cat.id}
                to={`/products?category=${cat.slug}`}
                className="relative rounded-2xl overflow-hidden group min-h-[160px] md:min-h-[200px] bg-slate-100"
              >
                <img
                  src={cat.image || "https://via.placeholder.com/400"}
                  alt={cat.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <h3 className="text-sm font-bold leading-tight">{cat.name}</h3>
                  <p className="text-white/80 text-xs mt-0.5">Explore →</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="border-y border-slate-100 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Truck, title: "Free Shipping", desc: "Orders over $50" },
              { icon: Shield, title: "Secure Payment", desc: "Stripe Protected" },
              { icon: Package, title: "Fast Delivery", desc: "Worldwide Shipping" },
              { icon: CreditCard, title: "Easy Returns", desc: "30-day guarantee" }
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="p-2.5 bg-orange-100 rounded-xl shrink-0">
                  <item.icon className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-900">{item.title}</h4>
                  <p className="text-xs text-slate-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Shop by Category */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-7">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900">Shop by Category</h2>
          <Link
            to="/products"
            className="text-orange-500 font-medium flex items-center gap-1 text-sm hover:underline"
          >
            View All <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/products?category=${cat.slug}`}
              className="group"
            >
              <div className="relative aspect-square rounded-2xl overflow-hidden bg-slate-100 mb-3">
                <img
                  src={cat.image || "https://via.placeholder.com/300"}
                  alt={cat.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 text-center group-hover:text-orange-500 transition">
                {cat.name}
              </h3>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Products */}
      <section className="max-w-7xl mx-auto px-4 py-4 pb-14">
        <div className="flex items-center justify-between mb-7">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900">Featured Products</h2>
          <Link
            to="/products"
            className="text-orange-500 font-medium flex items-center gap-1 text-sm hover:underline"
          >
            View All <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-slate-100 rounded-2xl h-80 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
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
          <div className="grid md:grid-cols-3 gap-10">
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
              <div key={i} className="text-center">
                <div className="text-5xl font-extrabold text-orange-500 mb-4">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;

