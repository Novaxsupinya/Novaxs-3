import React from "react";
import { Link } from "react-router-dom";
import { Separator } from "@/components/ui/separator";

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
              Your one-stop shop for amazing deals. Quality products, fast
              delivery worldwide.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Shop</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <Link
                  to="/products?category=womens-fashion"
                  className="hover:text-orange-500"
                >
                  Women's Fashion
                </Link>
              </li>
              <li>
                <Link
                  to="/products?category=mens-fashion"
                  className="hover:text-orange-500"
                >
                  Men's Fashion
                </Link>
              </li>
              <li>
                <Link
                  to="/products?category=electronics"
                  className="hover:text-orange-500"
                >
                  Electronics
                </Link>
              </li>
              <li>
                <Link
                  to="/products?category=pet-supplies"
                  className="hover:text-orange-500"
                >
                  Pet Supplies
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Customer Service</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <Link to="/contact" className="hover:text-orange-500">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-orange-500">
                  Shipping Info
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-orange-500">
                  Returns
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-orange-500">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Connect</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <a href="#" className="hover:text-orange-500">
                  About Us
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-orange-500">
                  Blog
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-orange-500">
                  Instagram
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-orange-500">
                  Twitter
                </a>
              </li>
            </ul>
          </div>
        </div>
        <Separator className="my-8 bg-slate-700" />
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-slate-400">
          <p>© 2024 Novaxs. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-orange-500">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-orange-500">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
