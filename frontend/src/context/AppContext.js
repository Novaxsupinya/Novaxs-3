import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";

const AppContext = createContext(null);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
};

// Generate cart ID
const getCartId = () => {
  let cartId = localStorage.getItem("cartId");
  if (!cartId) {
    cartId = `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("cartId", cartId);
  }
  return cartId;
};

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const AppProvider = ({ children }) => {
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
        } catch (error) {
          console.error("Failed to fetch user:", error);
          localStorage.removeItem("token");
        }
      }
      try {
        const cartRes = await axios.get(`${API}/cart/${getCartId()}`);
        setCart(cartRes.data);
      } catch (error) {
        console.error("Failed to fetch cart:", error);
      }
      try {
        const catRes = await axios.get(`${API}/categories`);
        setCategories(catRes.data);
      } catch (error) {
        console.error("Failed to fetch categories:", error);
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
    } catch (error) {
      console.error("Failed to fetch user:", error);
      localStorage.removeItem("token");
    }
  };

  const fetchCart = async () => {
    try {
      const res = await axios.get(`${API}/cart/${getCartId()}`);
      setCart(res.data);
    } catch (error) {
      console.error("Failed to fetch cart:", error);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await axios.get(`${API}/categories`);
      setCategories(res.data);
    } catch (error) {
      console.error("Failed to fetch categories:", error);
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
    } catch (error) {
      console.error("Failed to add to cart:", error);
      toast.error(error.response?.data?.detail || "Failed to add to cart");
      return false;
    }
  };

  const updateCartItem = async (productId, quantity) => {
    try {
      const res = await axios.put(
        `${API}/cart/${getCartId()}/items/${productId}?quantity=${quantity}`
      );
      setCart(res.data);
    } catch (error) {
      console.error("Failed to update cart item:", error);
      toast.error("Failed to update cart");
    }
  };

  const removeFromCart = async (productId) => {
    try {
      const res = await axios.delete(
        `${API}/cart/${getCartId()}/items/${productId}`
      );
      setCart(res.data);
      toast.success("Removed from cart");
    } catch (error) {
      console.error("Failed to remove from cart:", error);
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
    } catch (error) {
      console.error("Login failed:", error);
      toast.error(error.response?.data?.detail || "Login failed");
      return false;
    }
  };

  const register = async (name, email, password) => {
    try {
      const res = await axios.post(`${API}/auth/register`, {
        name,
        email,
        password
      });
      localStorage.setItem("token", res.data.access_token);
      setUser(res.data.user);
      toast.success("Account created!");
      return true;
    } catch (error) {
      console.error("Registration failed:", error);
      toast.error(error.response?.data?.detail || "Registration failed");
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
    toast.success("Logged out");
  };

  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        cart,
        setCart,
        categories,
        loading,
        setLoading,
        addToCart,
        updateCartItem,
        removeFromCart,
        fetchCart,
        login,
        register,
        logout,
        API
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
