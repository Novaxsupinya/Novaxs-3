import React from "react";
import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/context/AppContext";

const ProductCard = ({ product }) => {
  const { addToCart } = useApp();

  const discount = product.compare_price
    ? Math.round((1 - product.price / product.compare_price) * 100)
    : 0;

  return (
    <div
      className="product-card group relative bg-white rounded-xl overflow-hidden border border-slate-100"
      data-testid={`product-card-${product.id}`}
    >
      <Link to={`/product/${product.id}`}>
        <div className="relative aspect-square overflow-hidden bg-slate-100">
          <img
            src={product.image}
            alt={product.name}
            className="product-image w-full h-full object-cover transition-transform duration-300"
            loading="lazy"
          />
          {discount > 0 && (
            <Badge className="absolute top-3 left-3 bg-orange-500">
              -{discount}%
            </Badge>
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
              className={`w-3.5 h-3.5 ${
                i < Math.floor(product.rating)
                  ? "fill-amber-400 text-amber-400"
                  : "text-slate-200"
              }`}
            />
          ))}
          <span className="text-xs text-slate-500 ml-1">
            ({product.reviews_count})
          </span>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <span className="text-lg font-bold text-orange-500">
            ${product.price?.toFixed(2)}
          </span>
          {product.compare_price && (
            <span className="text-sm text-slate-400 line-through">
              ${product.compare_price?.toFixed(2)}
            </span>
          )}
        </div>

        <Button
          className="w-full mt-3 bg-slate-900 hover:bg-orange-500 transition-colors"
          onClick={(e) => {
            e.preventDefault();
            addToCart(product.id);
          }}
          data-testid={`add-to-cart-${product.id}`}
        >
          Add to Cart
        </Button>
      </div>
    </div>
  );
};

export default ProductCard;
