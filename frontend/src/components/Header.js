import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, ShoppingCart } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useApp } from "@/context/AppContext";
import CartDrawer from "./CartDrawer";

const Header = () => {
  const { cart } = useApp();
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const cartItemsCount = cart?.items?.reduce(
    (sum, item) => sum + item.quantity,
    0
  ) || 0;

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery)}`);
      setSearchQuery("");
    }
  };

  return (
    <header className="sticky top-0 z-50" data-testid="header">
      {/* Main Header - Dark purple-blue background */}
      <div className="py-4" style={{ backgroundColor: "#0A0A1F" }}>
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between gap-4">
          {/* Left: Logo */}
          <Link to="/" className="flex-shrink-0" data-testid="logo">
            <img
              src="https://customer-assets.emergentagent.com/job_dfe494f7-bb89-4ed5-9943-bc15fa3ca74e/artifacts/g0y20dm6_image-1.jpg"
              alt="NOVAXS"
              className="h-12 md:h-14 object-contain"
              style={{ filter: "drop-shadow(0 0 10px rgba(160, 32, 240, 0.5))" }}
            />
          </Link>

          {/* Center: Search Bar */}
          <form onSubmit={handleSearch} className="flex-1 max-w-xl hidden md:block">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
                style={{ color: "#A020F0" }}
              />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border-2 focus:outline-none transition-all"
                style={{
                  backgroundColor: "#1A1A2E",
                  borderColor: "#A020F0",
                  color: "#E0E0FF"
                }}
                onFocus={(e) =>
                  (e.target.style.boxShadow =
                    "0 0 12px rgba(160, 32, 240, 0.5)")
                }
                onBlur={(e) => (e.target.style.boxShadow = "none")}
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
                  style={{
                    color: "#A020F0",
                    filter: "drop-shadow(0 0 8px rgba(160, 32, 240, 0.6))"
                  }}
                />
                {cartItemsCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center text-white"
                    style={{ backgroundColor: "#A020F0" }}
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
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
                style={{ color: "#A020F0" }}
              />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border-2 focus:outline-none"
                style={{
                  backgroundColor: "#1A1A2E",
                  borderColor: "#A020F0",
                  color: "#E0E0FF"
                }}
              />
            </div>
          </form>
        </div>
      </div>
    </header>
  );
};

export default Header;
