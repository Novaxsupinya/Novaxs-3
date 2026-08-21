import React from "react";
import { Link } from "react-router-dom";
import { ShoppingCart, Minus, Plus, Trash2 } from "lucide-react";
import {
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/AppContext";

const CartDrawer = () => {
  const { cart, updateCartItem, removeFromCart } = useApp();

  if (!cart?.items?.length) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full text-center"
        data-testid="empty-cart"
      >
        <ShoppingCart className="w-16 h-16 text-slate-300 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Your cart is empty</h3>
        <p className="text-slate-500 mb-4">Add some products to get started</p>
        <Link to="/products">
          <Button className="bg-orange-500 hover:bg-orange-600">
            Start Shopping
          </Button>
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
            <div
              key={item.product_id}
              className="flex gap-4 p-4 bg-slate-50 rounded-lg"
              data-testid={`cart-item-${item.product_id}`}
            >
              <img
                src={item.product?.image || "https://via.placeholder.com/80"}
                alt={item.product?.name}
                className="w-20 h-20 object-cover rounded-lg"
              />
              <div className="flex-1">
                <h4 className="font-medium text-sm line-clamp-2">
                  {item.product?.name}
                </h4>
                <p className="text-orange-500 font-bold mt-1">
                  ${item.product?.price?.toFixed(2)}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() =>
                      updateCartItem(
                        item.product_id,
                        Math.max(0, item.quantity - 1)
                      )
                    }
                    className="p-1 hover:bg-slate-200 rounded"
                    data-testid={`decrease-${item.product_id}`}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center">{item.quantity}</span>
                  <button
                    onClick={() =>
                      updateCartItem(item.product_id, item.quantity + 1)
                    }
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
        <p className="text-xs text-slate-500 mb-4">
          Shipping & taxes calculated at checkout
        </p>
        <Link to="/checkout">
          <Button
            className="w-full bg-orange-500 hover:bg-orange-600 h-12 text-base font-semibold"
            data-testid="checkout-btn"
          >
            Checkout
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default CartDrawer;
