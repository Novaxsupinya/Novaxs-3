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
    <div data-testid="home-page" className="bg-[#0a0618] text-white min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a0b3a] via-[#0d0620] to-[#0a0618]" />
        <div className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 50% 30%, rgba(168,85,247,0.35), transparent 55%)"
          }}
        />

        <div className="relative max-w-7xl mx-auto px-4 pt-10 pb-14 text-center">
          {/* Logo / Brand */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-36 h-36 md:w-44 md:h-44 rounded-full bg-gradient-to-br from-purple-500 via-fuchsia-500 to-orange-400 p-[3px] shadow-[0_0_60px_rgba(168,85,247,0.55)] mb-5">
              <div className="w-full h-full rounded-full bg-[#0a0618] flex items-center justify-center">
                <span className="text-5xl md:text-6xl">🛒</span>
              </div>
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-white via-purple-200 to-orange-200 bg-clip-text text-transparent">
              NOVAXS
            </h1>
            <p className="mt-2 text-purple-200/90 text-base md:text-lg tracking-wide">
              Elevate Your Lifestyle
            </p>
            <Link
              to="/products"
              className="mt-6 inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-fuchsia-500 hover:from-orange-400 hover:to-fuchsia-400 text-white font-semibold px-8 py-3 rounded-full shadow-lg shadow-purple-900/40 transition"
            >
              Shop Now <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Category Grid - all 6 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-5 max-w-4xl mx-auto">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/products?category=${cat.slug}`}
                className="group relative rounded-2xl overflow-hidden border border-purple-500/30 bg-[#120a28] hover:border-purple-400/60 transition min-h-[140px] md:min-h-[170px]"
              >
                <img
                  src={cat.image || "https://via.placeholder.com/400"}
                  alt={cat.name}
                  className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3 text-left">
                  <h3 className="text-sm md:text-base font-bold text-white leading-tight drop-shadow">
                    {cat.name}
                  </h3>
                  <p className="text-purple-200/80 text-xs mt-0.5">Explore →</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="border-y border-purple-900/40 bg-[#0d0820]">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Truck, title: "Free Shipping", desc: "Orders over $50" },
              { icon: Shield, title: "Secure Payment", desc: "Stripe Protected" },
              { icon: Package, title: "Fast Delivery", desc: "Worldwide Shipping" },
              { icon: CreditCard, title: "Easy Returns", desc: "30-day guarantee" }
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-500/20 rounded-xl shrink-0">
                  <item.icon className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-white">{item.title}</h4>
                  <p className="text-xs text-purple-200/70">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="max-w-7xl mx-auto px-4 py-12 pb-16">
        <div className="flex items-center justify-between mb-7">
          <h2 className="text-2xl md:text-3xl font-bold text-white">Featured Products</h2>
          <Link
            to="/products"
            className="text-orange-400 font-medium flex items-center gap-1 text-sm hover:underline"
          >
            View All <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-purple-950/50 rounded-2xl h-80 animate-pulse" />
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
      <section className="bg-[#120a28] border-t border-purple-900/40 py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12 text-white">
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
                <div className="text-5xl font-extrabold text-orange-400 mb-4">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold mb-2 text-white">{item.title}</h3>
                <p className="text-purple-200/70 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
