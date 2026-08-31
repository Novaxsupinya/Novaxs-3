from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import jwt
import bcrypt
import json
import asyncio
import resend

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(title="NOVAXS E-commerce API")
@app.get("/")
async def root():
    return {"message": "NOVAXS E-commerce API", "status": "running"}

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer(auto_error=False)
JWT_SECRET = os.environ.get('JWT_SECRET', 'handsfree-ecommerce-secret-key-2024')
JWT_ALGORITHM = "HS256"
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'novaxs6969@gmail.com')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'NovaxsAdmin2024!')

# EPROLO Configuration
EPROLO_API_BASE = "https://openapi.eprolo.com"
EPROLO_API_KEY = os.environ.get('EPROLO_API_KEY', '')
EPROLO_API_SECRET = os.environ.get('EPROLO_API_SECRET', '')

# Stripe Configuration
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', '')

# Resend Email Configuration
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Rate limiting storage (simple in-memory)
rate_limit_store = {}

# ============ Pydantic Models ============

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class ProductVariant(BaseModel):
    vid: str
    sku: str
    name: str
    price: float
    image: Optional[str] = None
    inventory: int = 0
    attributes: Dict[str, str] = {}

class Product(BaseModel):
    id: str
    eprolo_pid: Optional[str] = None
    name: str
    description: str
    category: str
    subcategory: Optional[str] = None
    image: str
    images: List[str] = []
    price: float
    compare_price: Optional[float] = None
    variants: List[ProductVariant] = []
    inventory: int = 0
    rating: float = 4.5
    reviews_count: int = 0
    is_active: bool = True
    tags: List[str] = []
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ReviewCreate(BaseModel):
    product_id: str
    rating: int = Field(ge=1, le=5)
    title: str
    comment: str

class Review(BaseModel):
    id: str
    product_id: str
    user_id: Optional[str] = None
    user_name: str
    rating: int
    title: str
    comment: str
    verified_purchase: bool = False
    helpful_count: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ContactRequest(BaseModel):
    name: str
    email: EmailStr
    subject: str
    message: str
    order_number: Optional[str] = None

class CartItem(BaseModel):
    product_id: str
    variant_id: Optional[str] = None
    quantity: int = 1

class CartItemResponse(BaseModel):
    product_id: str
    variant_id: Optional[str] = None
    quantity: int
    product: Optional[Dict[str, Any]] = None

class Cart(BaseModel):
    id: str
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    items: List[CartItemResponse] = []
    subtotal: float = 0.0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ShippingAddress(BaseModel):
    name: str
    email: EmailStr
    phone: str
    address: str
    address2: Optional[str] = None
    city: str
    state: str
    zip_code: str
    country: str = "US"
    country_code: str = "US"

class OrderCreate(BaseModel):
    shipping_address: ShippingAddress
    cart_id: str

class OrderItem(BaseModel):
    product_id: str
    variant_id: Optional[str] = None
    quantity: int
    price: float
    name: str
    image: Optional[str] = None

class Order(BaseModel):
    id: str
    user_id: Optional[str] = None
    order_number: str
    items: List[OrderItem] = []
    subtotal: float
    shipping_cost: float = 0.0
    tax: float = 0.0
    total: float
    status: str = "pending"
    payment_status: str = "pending"
    stripe_session_id: Optional[str] = None
    eprolo_order_id: Optional[str] = None
    tracking_number: Optional[str] = None
    shipping_address: Dict[str, Any] = {}
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class Category(BaseModel):
    id: str
    name: str
    slug: str
    description: str = ""
    image: str = ""
    parent_id: Optional[str] = None
    is_active: bool = True
    order: int = 0

# ============ Helper Functions ============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        return user
    except jwt.PyJWTError:
        return None

def generate_order_number():
    return f"NVX{datetime.now().strftime('%Y%m%d')}{str(uuid.uuid4())[:8].upper()}"

# ============ EPROLO Dropshipping Service ============

import hashlib
import time

class EproloService:
    def __init__(self):
        self.base_url = "https://openapi.eprolo.com"
        self.api_key = EPROLO_API_KEY
        self.api_secret = EPROLO_API_SECRET
    
    def _generate_signature(self, timestamp: str) -> str:
        """Generate MD5 signature: MD5(apiKey + timestamp + apiSecret)"""
        sign_str = f"{self.api_key}{timestamp}{self.api_secret}"
        return hashlib.md5(sign_str.encode()).hexdigest()
    
    def _get_auth_params(self) -> Dict[str, str]:
        """Get timestamp and sign for authentication"""
        timestamp = str(int(time.time()))
        sign = self._generate_signature(timestamp)
        return {"timestamp": timestamp, "sign": sign}
    
    def _get_headers(self) -> Dict[str, str]:
        """Get headers with apiKey"""
        return {
            "apiKey": self.api_key,
            "Content-Type": "application/json"
        }
    
    async def get_products(self, keyword: str = "", page: int = 1, size: int = 20):
        """Get products from EPROLO - uses correct My Products endpoint"""
        if not self.api_key or not self.api_secret:
            logger.warning("EPROLO API credentials not configured")
            return {"products": [], "total": 0}
        
        try:
            auth = self._get_auth_params()
            
            # Correct parameters for My Products (status=1 = imported)
            params = (
                f"timestamp={auth['timestamp']}"
                f"&sign={auth['sign']}"
                f"&page_index={page - 1}"
                f"&page_size={size}"
                f"&status=1"
            )
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.base_url}/eprolo_product_list.html?{params}",
                    headers=self._get_headers()
                )
                data = response.json()
                logger.info(f"EPROLO products response: {data.get('code')} - {data.get('msg')}")
                
                if data.get("code") == "0" or data.get("code") == 0:
                    products = data.get("data", []) or []
                    return {"products": products, "total": len(products)}
                else:
                    logger.warning(f"EPROLO returned: {data}")
                    
        except Exception as e:
            logger.error(f"Error getting EPROLO products: {e}")
        
        return {"products": [], "total": 0}
        
 
    
    async def create_order(self, order_data: Dict[str, Any]):
        """Create order in EPROLO - POST /add_order.html"""
        if not self.api_key or not self.api_secret:
            logger.warning("EPROLO API credentials not configured")
            return None
        
        try:
            auth = self._get_auth_params()
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/add_order.html?timestamp={auth['timestamp']}&sign={auth['sign']}",
                    json=order_data,
                    headers=self._get_headers()
                )
                data = response.json()
                logger.info(f"EPROLO order create response: {data}")
                if data.get("code") == "0" or data.get("code") == 0:
                    return data.get("data")
                else:
                    logger.error(f"EPROLO order error: {data.get('msg')}")
        except Exception as e:
            logger.error(f"Error creating EPROLO order: {e}")
        return None
    
    async def get_orders(self, page: int = 1, size: int = 20):
        """Get orders from EPROLO - GET /order_list.html"""
        if not self.api_key or not self.api_secret:
            return {"orders": [], "total": 0}
        
        try:
            auth = self._get_auth_params()
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/order_list.html?timestamp={auth['timestamp']}&sign={auth['sign']}&pageNo={page}&pageSize={size}",
                    headers=self._get_headers()
                )
                data = response.json()
                if data.get("code") == "0" or data.get("code") == 0:
                    orders = data.get("data", {}).get("list", []) or []
                    total = data.get("data", {}).get("total", len(orders))
                    return {"orders": orders, "total": total}
        except Exception as e:
            logger.error(f"Error getting EPROLO orders: {e}")
        return {"orders": [], "total": 0}
    
    async def get_order_status(self, order_id: str):
        """Get order status from EPROLO orders list"""
        try:
            result = await self.get_orders(1, 100)
            for order in result.get("orders", []):
                if str(order.get("order_id")) == str(order_id) or str(order.get("id")) == str(order_id):
                    return order
        except Exception as e:
            logger.error(f"Error getting EPROLO order status: {e}")
        return None

eprolo_service = EproloService()
# ============ Stripe Service ============
import stripe

stripe.api_key = STRIPE_API_KEY

def get_stripe_checkout(host_url: str = ""):
    if not STRIPE_API_KEY:
        logger.warning("Stripe API key not configured")
        return None
    return True


# ============ API Routes ============

# Health check
@api_router.get("/")
async def root():
    return {"message": "Novaxs E-commerce API", "status": "running"}

@api_router.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}
@api_router.get("/test-eprolo")
async def test_eprolo():
    """Temporary public endpoint to test Eprolo connection - shows raw response"""
    try:
        import time, hashlib, httpx
        
        api_key = EPROLO_API_KEY
        api_secret = EPROLO_API_SECRET
        timestamp = str(int(time.time()))
        sign_str = f"{api_key}{timestamp}{api_secret}"
        sign = hashlib.md5(sign_str.encode()).hexdigest()
        
        url = f"https://openapi.eprolo.com/eprolo_product_list.html?timestamp={timestamp}&sign={sign}&page_index=0&page_size=5&status=1"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                headers={"apiKey": api_key, "Content-Type": "application/json"}
            )
            data = response.json()
            
        return {
            "status": "ok",
            "http_status": response.status_code,
            "raw_eprolo_response": data,
            "timestamp_used": timestamp,
            "sign_used": sign,
            "api_key_set": bool(api_key),
            "api_secret_set": bool(api_secret)
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }

@api_router.post("/test-add-product")
async def test_add_product():
    """Temporary endpoint to test Eprolo Add Product (insert_product.html)"""
    try:
        import time, hashlib, httpx, json
        
        api_key = EPROLO_API_KEY
        api_secret = EPROLO_API_SECRET
        timestamp = str(int(time.time()))
        sign_str = f"{api_key}{timestamp}{api_secret}"
        sign = hashlib.md5(sign_str.encode()).hexdigest()
        
        url = f"https://openapi.eprolo.com/insert_product.html?timestamp={timestamp}&sign={sign}"
        
        payload = {
            "title": "NOVAXS Test Product",
            "body_html": "<p>This is a test product added via API for Novaxs store.</p>",
            "product_id": "novaxs-test-002",
            "optionList": [
                {"name": "color"},
                {"name": "size"}
            ],
            "variantsList": [
                {
                    "title": "Black-L",
                    "sku": "novaxs-test-black-l",
                    "option1": "Black",
                    "option2": "L",
                    "image_id": "1"
                }
            ],
            "imageList": [
                {
                    "src": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500",
                    "position": "1",
                    "images_id": "1"
                }
            ]
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                url,
                headers={
                    "apiKey": api_key,
                    "Content-Type": "application/json"
                },
                json=payload
            )
            data = response.json()
        
        return {
            "status": "ok",
            "http_status": response.status_code,
            "raw_eprolo_response": data,
            "timestamp_used": timestamp,
            "sign_used": sign
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }
# ============ Auth Routes ============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "name": user_data.name,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    
    token = create_token(user_id, user_data.email)
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user_id, email=user_data.email, name=user_data.name, created_at=user["created_at"])
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user["email"])
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user["id"], email=user["email"], name=user["name"], created_at=user["created_at"])
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user=Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return UserResponse(id=user["id"], email=user["email"], name=user["name"], created_at=user["created_at"])

# ============ Category Routes ============

@api_router.get("/categories", response_model=List[Category])
async def get_categories():
    categories = await db.categories.find({"is_active": True}, {"_id": 0}).sort("order", 1).to_list(100)
    if not categories:
        # Seed default categories
        default_categories = [
            {"id": str(uuid.uuid4()), "name": "Women's Fashion", "slug": "womens-fashion", "description": "Trendy women's clothing and accessories", "image": "https://images.unsplash.com/photo-1587987746776-302404b98970?w=500", "order": 1, "is_active": True},
            {"id": str(uuid.uuid4()), "name": "Men's Fashion", "slug": "mens-fashion", "description": "Stylish men's wear", "image": "https://images.unsplash.com/photo-1658860547138-1e28dfb90867?w=500", "order": 2, "is_active": True},
            {"id": str(uuid.uuid4()), "name": "Pet Supplies", "slug": "pet-supplies", "description": "Everything for your furry friends", "image": "https://images.unsplash.com/photo-1588218955664-d18f4e3056e5?w=500", "order": 3, "is_active": True},
            {"id": str(uuid.uuid4()), "name": "Electronics", "slug": "electronics", "description": "Latest consumer electronics", "image": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500", "order": 4, "is_active": True},
            {"id": str(uuid.uuid4()), "name": "Health & Beauty", "slug": "health-beauty", "description": "Health, beauty and personal care", "image": "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500", "order": 5, "is_active": True},
            {"id": str(uuid.uuid4()), "name": "Outdoor & Sports", "slug": "outdoor-sports", "description": "Outdoor gear and sports equipment", "image": "https://images.unsplash.com/photo-1551632811-561732d1e306?w=500", "order": 6, "is_active": True},
        ]
        await db.categories.insert_many(default_categories)
        categories = default_categories
    return categories

@api_router.get("/categories/{slug}")
async def get_category(slug: str):
    category = await db.categories.find_one({"slug": slug, "is_active": True}, {"_id": 0})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category

# ============ Product Routes ============

@api_router.get("/products")
async def get_products(
    category: Optional[str] = None,
    search: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort: str = "newest",
    page: int = 1,
    limit: int = 20
):
    query = {"is_active": True}
    
    if category:
        query["category"] = category
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"tags": {"$in": [search.lower()]}}
        ]
    if min_price is not None:
        query["price"] = {"$gte": min_price}
    if max_price is not None:
        query.setdefault("price", {})["$lte"] = max_price
    
    sort_field = {"newest": ("created_at", -1), "price_low": ("price", 1), "price_high": ("price", -1), "popular": ("reviews_count", -1)}.get(sort, ("created_at", -1))
    
    skip = (page - 1) * limit
    products = await db.products.find(query, {"_id": 0}).sort(sort_field[0], sort_field[1]).skip(skip).limit(limit).to_list(limit)
    total = await db.products.count_documents(query)
    
    # If no products, seed demo products
    if not products and page == 1 and not category and not search:
        products = await seed_demo_products()
        total = len(products)
    
    return {
        "products": products,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }

@api_router.get("/products/featured")
async def get_featured_products(limit: int = 8):
    products = await db.products.find({"is_active": True}, {"_id": 0}).sort("reviews_count", -1).limit(limit).to_list(limit)
    if not products:
        products = await seed_demo_products()
    return products[:limit]

@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

# ============ Cart Routes ============

async def batch_get_products(product_ids: list):
    """Batch fetch products by IDs - optimized to avoid N+1 queries"""
    if not product_ids:
        return {}
    products = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(len(product_ids))
    return {p["id"]: p for p in products}

async def calculate_cart_subtotal(cart_items: list, products_map: dict = None):
    """Calculate cart subtotal with optional pre-fetched products"""
    if not cart_items:
        return 0.0
    if products_map is None:
        product_ids = [item["product_id"] for item in cart_items]
        products_map = await batch_get_products(product_ids)
    subtotal = 0.0
    for item in cart_items:
        product = products_map.get(item["product_id"])
        if product:
            subtotal += product["price"] * item["quantity"]
    return subtotal

@api_router.get("/cart/{cart_id}")
async def get_cart(cart_id: str):
    cart = await db.carts.find_one({"id": cart_id}, {"_id": 0})
    if not cart:
        cart = {"id": cart_id, "items": [], "subtotal": 0.0, "created_at": datetime.now(timezone.utc).isoformat(), "updated_at": datetime.now(timezone.utc).isoformat()}
        await db.carts.insert_one(dict(cart))
    
    # Batch fetch all products at once (optimized)
    product_ids = [item["product_id"] for item in cart.get("items", [])]
    products_map = await batch_get_products(product_ids)
    
    # Populate product details
    for item in cart.get("items", []):
        item["product"] = products_map.get(item["product_id"])
    
    cart.pop("_id", None)
    return cart

@api_router.post("/cart/{cart_id}/items")
async def add_to_cart(cart_id: str, item: CartItem):
    cart = await db.carts.find_one({"id": cart_id})
    if not cart:
        cart = {"id": cart_id, "items": [], "subtotal": 0.0, "created_at": datetime.now(timezone.utc).isoformat(), "updated_at": datetime.now(timezone.utc).isoformat()}
    
    # Check if item already exists
    existing_index = None
    for i, existing in enumerate(cart.get("items", [])):
        if existing["product_id"] == item.product_id and existing.get("variant_id") == item.variant_id:
            existing_index = i
            break
    
    if existing_index is not None:
        cart["items"][existing_index]["quantity"] += item.quantity
    else:
        cart["items"].append({"product_id": item.product_id, "variant_id": item.variant_id, "quantity": item.quantity})
    
    # Recalculate subtotal (optimized batch query)
    cart["subtotal"] = await calculate_cart_subtotal(cart["items"])
    cart["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.carts.update_one({"id": cart_id}, {"$set": cart}, upsert=True)
    return await get_cart(cart_id)

@api_router.put("/cart/{cart_id}/items/{product_id}")
async def update_cart_item(cart_id: str, product_id: str, quantity: int = Query(..., ge=0)):
    cart = await db.carts.find_one({"id": cart_id})
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")
    
    if quantity == 0:
        cart["items"] = [item for item in cart["items"] if item["product_id"] != product_id]
    else:
        for item in cart["items"]:
            if item["product_id"] == product_id:
                item["quantity"] = quantity
                break
    
    # Recalculate subtotal (optimized batch query)
    cart["subtotal"] = await calculate_cart_subtotal(cart["items"])
    cart["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.carts.update_one({"id": cart_id}, {"$set": cart})
    return await get_cart(cart_id)

@api_router.delete("/cart/{cart_id}/items/{product_id}")
async def remove_from_cart(cart_id: str, product_id: str):
    return await update_cart_item(cart_id, product_id, quantity=0)

@api_router.delete("/cart/{cart_id}")
async def clear_cart(cart_id: str):
    await db.carts.update_one(
        {"id": cart_id},
        {"$set": {"items": [], "subtotal": 0.0, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Cart cleared"}

# ============ Order Routes ============

@api_router.post("/orders")
async def create_order(order_data: OrderCreate, background_tasks: BackgroundTasks, user=Depends(get_current_user)):
    cart = await db.carts.find_one({"id": order_data.cart_id}, {"_id": 0})
    if not cart or not cart.get("items"):
        raise HTTPException(status_code=400, detail="Cart is empty")
    
    # Batch fetch all products (optimized)
    product_ids = [item["product_id"] for item in cart["items"]]
    products_map = await batch_get_products(product_ids)
    
    # Build order items
    order_items = []
    subtotal = 0.0
    for cart_item in cart["items"]:
        product = products_map.get(cart_item["product_id"])
        if product:
            item_total = product["price"] * cart_item["quantity"]
            subtotal += item_total
            order_items.append(OrderItem(
                product_id=cart_item["product_id"],
                variant_id=cart_item.get("variant_id"),
                quantity=cart_item["quantity"],
                price=product["price"],
                name=product["name"],
                image=product.get("image")
            ))
    
    shipping_cost = 0.0 if subtotal >= 50 else 5.99
    tax = subtotal * 0.08
    total = subtotal + shipping_cost + tax
    
    order_id = str(uuid.uuid4())
    order_number = generate_order_number()
    
    order = {
        "id": order_id,
        "user_id": user["id"] if user else None,
        "order_number": order_number,
        "items": [item.model_dump() for item in order_items],
        "subtotal": round(subtotal, 2),
        "shipping_cost": round(shipping_cost, 2),
        "tax": round(tax, 2),
        "total": round(total, 2),
        "status": "pending",
        "payment_status": "pending",
        "shipping_address": order_data.shipping_address.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.orders.insert_one(order)
    
    # Clear cart
    await db.carts.update_one(
        {"id": order_data.cart_id},
        {"$set": {"items": [], "subtotal": 0.0, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Remove _id before returning
    order.pop("_id", None)
    
    return {"order": order}

# ============ Stripe Checkout Endpoints ============

class StripeCheckoutRequest(BaseModel):
    order_id: str
    origin_url: str

    
@api_router.post("/checkout/stripe")
async def create_stripe_checkout(req: StripeCheckoutRequest):
    """Create Stripe checkout session for an order"""
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    order = await db.orders.find_one({"id": req.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Order already paid")

    try:
        line_items = []
        for item in order.get("items", []):
            line_items.append({
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": item.get("name", "Product"),
                        "images": [item["image"]] if item.get("image") else [],
                    },
                    "unit_amount": int(float(item.get("price", 0)) * 100),
                },
                "quantity": item.get("quantity", 1),
            })

        shipping = float(order.get("shipping_cost", 0) or 0)
        tax = float(order.get("tax", 0) or 0)

        if shipping > 0:
            line_items.append({
                "price_data": {
                    "currency": "usd",
                    "product_data": {"name": "Shipping"},
                    "unit_amount": int(shipping * 100),
                },
                "quantity": 1,
            })

        if tax > 0:
            line_items.append({
                "price_data": {
                    "currency": "usd",
                    "product_data": {"name": "Tax"},
                    "unit_amount": int(tax * 100),
                },
                "quantity": 1,
            })

        success_url = req.origin_url + "order-confirmation/" + order["id"] + "?session_id={CHECKOUT_SESSION_ID}"
        cancel_url = req.origin_url + "checkout"

        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=line_items,
            mode="payment",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "order_id": order["id"],
                "order_number": order.get("order_number", "")
            },
        )

        await db.orders.update_one(
            {"id": order["id"]},
            {"$set": {"stripe_session_id": session.id}}
        )

        return {"checkout_url": session.url, "session_id": session.id}

    except Exception as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    
    status: CheckoutStatusResponse = await stripe.get_checkout_status(session_id)
    return status

# ============ Stripe Webhook ============

from fastapi import Request

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request, background_tasks: BackgroundTasks):
    """Handle Stripe webhooks - triggers CJ fulfillment on successful payment"""
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    
    stripe = get_stripe_checkout("")
    if not stripe:
        return {"status": "stripe not configured"}
    
    try:
        webhook_response = await stripe.handle_webhook(body, sig)
        logger.info(f"Stripe webhook: {webhook_response.event_type} - {webhook_response.payment_status}")
        
        if webhook_response.event_type == "checkout.session.completed" and webhook_response.payment_status == "paid":
            order_id = webhook_response.metadata.get("order_id")
            if order_id:
                # Update order status
                await db.orders.update_one(
                    {"id": order_id},
                    {"$set": {
                        "payment_status": "paid",
                        "status": "processing",
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                # Update payment transaction
                await db.payment_transactions.update_one(
                    {"session_id": webhook_response.session_id},
                    {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}}
                )
                
                # Trigger CJ fulfillment
                background_tasks.add_task(create_eprolo_order, order_id)
                
                # Send confirmation email
                order = await db.orders.find_one({"id": order_id}, {"_id": 0})
                if order:
                    background_tasks.add_task(send_order_confirmation, order)
                
                logger.info(f"Order {order_id} paid via Stripe - CJ fulfillment triggered")
        
        return {"status": "received"}
    except Exception as e:
        logger.error(f"Stripe webhook error: {e}")
        return {"status": "error", "message": str(e)}

async def create_eprolo_order(order_id: str):
    """Background task to create EPROLO order"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        return
    
    shipping = order.get("shipping_address", {})
    
    # Build EPROLO order items
    order_items = []
    for item in order.get("items", []):
        product = await db.products.find_one({"id": item["product_id"]}, {"_id": 0})
        if product and product.get("eprolo_pid"):
            variant_id = item.get("variant_id") or product.get("eprolo_variant_id") or ""
            if variant_id:
                order_items.append({
                    "variantsid": str(variant_id),
                    "quantity": item["quantity"]
                })
    
    if not order_items:
        logger.warning(f"No EPROLO products found for order {order_id}")
        return
    
    # Parse name into parts
    name_parts = shipping.get("name", "Customer").split()
    first_name = name_parts[0] if name_parts else "Customer"
    
    # EPROLO order format from documentation
    eprolo_order_data = {
        "note": f"Order from NOVAXS - {order['order_number']}",
        "shipping_country_code": shipping.get("country_code", "US"),
        "shipping_name": shipping.get("name", first_name),
        "shipping_phone": shipping.get("phone", ""),
        "shipping_company": "",
        "shipping_country": shipping.get("country", "United States"),
        "shipping_address": shipping.get("address", ""),
        "shipping_province": shipping.get("state", ""),
        "shipping_province_code": shipping.get("state", "")[:2].upper() if shipping.get("state") else "",
        "shipping_address2": shipping.get("address2", ""),
        "shipping_city": shipping.get("city", ""),
        "shipping_zip": shipping.get("zip_code", ""),
        "shipping_taxNumber": "",
        "order_id": order_id,
        "order_number": order["order_number"],
        "logistics_id": 10,
        "orderItemlist": order_items
    }
    
    eprolo_result = await eprolo_service.create_order(eprolo_order_data)
    
    if eprolo_result:
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {
                "eprolo_order_id": eprolo_result.get("order_id") or eprolo_result.get("id") or str(eprolo_result),
                "status": "processing",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        logger.info(f"EPROLO order created for order {order_id}")

@api_router.get("/orders")
async def get_orders(user=Depends(get_current_user), page: int = 1, limit: int = 10):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    skip = (page - 1) * limit
    orders = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.orders.count_documents({"user_id": user["id"]})
    
    return {"orders": orders, "total": total, "page": page, "limit": limit}

@api_router.get("/orders/{order_id}")
async def get_order(order_id: str, user=Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get EPROLO order status if available
    if order.get("eprolo_order_id"):
        eprolo_status = await eprolo_service.get_order_status(order["eprolo_order_id"])
        if eprolo_status:
            order["eprolo_status"] = eprolo_status.get("orderStatus") or eprolo_status.get("status")
            new_tracking = eprolo_status.get("trackingNumber") or eprolo_status.get("trackNumber")
            
            # If we got tracking, update the order
            if new_tracking and new_tracking != order.get("tracking_number"):
                order["tracking_number"] = new_tracking
                
                # Update tracking in DB
                await db.orders.update_one(
                    {"id": order_id},
                    {"$set": {
                        "tracking_number": new_tracking,
                        "status": "shipped",
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                logger.info(f"Tracking updated for order {order_id}: {new_tracking}")
                
                # Send shipping notification email
                asyncio.create_task(send_shipping_notification(order, new_tracking))
    
    return order

@api_router.get("/orders/track/{order_number}")
async def track_order(order_number: str):
    order = await db.orders.find_one({"order_number": order_number}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return {
        "order_number": order["order_number"],
        "status": order["status"],
        "payment_status": order["payment_status"],
        "tracking_number": order.get("tracking_number"),
        "created_at": order["created_at"],
        "items_count": len(order.get("items", []))
    }

# ============ EPROLO Integration Routes ============

@api_router.get("/eprolo/products")
async def get_eprolo_products(keyword: str = "", page: int = 1, size: int = 20):
    """Get products directly from EPROLO"""
    result = await eprolo_service.get_products(keyword, page, size)
    return result

@api_router.get("/eprolo/orders")
async def get_eprolo_orders(page: int = 1, size: int = 20):
    """Get orders from EPROLO"""
    result = await eprolo_service.get_orders(page, size)
    return result

@api_router.post("/eprolo/sync")
async def sync_eprolo_products(background_tasks: BackgroundTasks, keyword: str = "", limit: int = 50):
    """Sync products from EPROLO to local database"""
    background_tasks.add_task(sync_products_from_eprolo, keyword, limit)
    return {"message": "Product sync started", "keyword": keyword, "limit": limit}

async def sync_products_from_eprolo(keyword: str = "", limit: int = 50):
    """Background task to sync EPROLO products"""
    categories_map = {
        "women": "womens-fashion",
        "men": "mens-fashion", 
        "pet": "pet-supplies",
        "electronic": "electronics",
        "beauty": "health-beauty",
        "outdoor": "outdoor-sports",
        "sport": "outdoor-sports"
    }
    
    keywords = ["women dress", "men shirt", "pet toy", "headphones", "skincare", "camping"] if not keyword else [keyword]
    
    for kw in keywords:
        result = await eprolo_service.get_products(kw, 1, limit // len(keywords))
        
        for eprolo_product in result.get("products", []):
            if isinstance(eprolo_product, dict):
                product_list = eprolo_product.get("productList", []) if eprolo_product.get("productList") else [eprolo_product]
            else:
                product_list = [eprolo_product]
            
            for prod in product_list:
                category = "electronics"
                for key, cat in categories_map.items():
                    prod_name = prod.get("name", "") or prod.get("nameEn", "") or ""
                    if key in kw.lower() or key in prod_name.lower():
                        category = cat
                        break
                
                product_id = str(uuid.uuid4())
                
                # Extract all available images
                images = []
                main_img = prod.get("image") or prod.get("bigImage") or prod.get("mainImage", "")
                if main_img:
                    images.append(main_img)
                for img_field in ["images", "imageList", "productImages", "gallery", "imgList"]:
                    img_list = prod.get(img_field, [])
                    if isinstance(img_list, list):
                        images.extend([img for img in img_list if img and img not in images])
                if not images:
                    images = [""]
                
                product = {
                    "id": product_id,
                    "eprolo_pid": prod.get("id") or prod.get("productId"),
                    "name": prod.get("name") or prod.get("nameEn", "Product"),
                    "description": prod.get("description", "High quality product from trusted suppliers."),
                    "category": category,
                    "image": images[0],
                    "images": images,
                    "price": float(prod.get("price", 0) or prod.get("sellPrice", 0) or 9.99),
                    "compare_price": float(prod.get("comparePrice", 0)) if prod.get("comparePrice") else None,
                    "variants": [],
                    "inventory": prod.get("inventory", 100) or 100,
                    "rating": 4.5,
                    "reviews_count": prod.get("soldCount", 0) or 0,
                    "is_active": True,
                    "tags": [kw.lower()],
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                
                existing = await db.products.find_one({"eprolo_pid": prod.get("id") or prod.get("productId")})
                if not existing:
                    await db.products.insert_one(product)
    
    logger.info(f"EPROLO product sync completed for keywords: {keywords}")

# ============ Seed Demo Products ============

async def seed_demo_products():
    """Seed demo products for testing"""
    demo_products = [
        # Women's Fashion
        {"id": str(uuid.uuid4()), "name": "Elegant Floral Summer Dress", "description": "Beautiful floral print dress perfect for summer occasions. Made with lightweight breathable fabric.", "category": "womens-fashion", "image": "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=500", "images": ["https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=500"], "price": 29.99, "compare_price": 49.99, "variants": [], "inventory": 150, "rating": 4.7, "reviews_count": 234, "is_active": True, "tags": ["dress", "summer", "floral"]},
        {"id": str(uuid.uuid4()), "name": "Classic Denim Jacket", "description": "Timeless denim jacket with modern fit. Perfect for layering in any season.", "category": "womens-fashion", "image": "https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=500", "images": ["https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=500"], "price": 45.99, "compare_price": 69.99, "variants": [], "inventory": 80, "rating": 4.5, "reviews_count": 156, "is_active": True, "tags": ["jacket", "denim", "casual"]},
        {"id": str(uuid.uuid4()), "name": "Bohemian Maxi Skirt", "description": "Flowing bohemian style maxi skirt with beautiful patterns. Comfortable and stylish.", "category": "womens-fashion", "image": "https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=500", "images": ["https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=500"], "price": 34.99, "compare_price": None, "variants": [], "inventory": 120, "rating": 4.6, "reviews_count": 89, "is_active": True, "tags": ["skirt", "boho", "maxi"]},
        
        # Men's Fashion
        {"id": str(uuid.uuid4()), "name": "Premium Cotton Polo Shirt", "description": "High-quality cotton polo shirt with classic fit. Perfect for casual and semi-formal occasions.", "category": "mens-fashion", "image": "https://images.unsplash.com/photo-1625910513413-5fc42a0dcc11?w=500", "images": ["https://images.unsplash.com/photo-1625910513413-5fc42a0dcc11?w=500"], "price": 28.99, "compare_price": 45.00, "variants": [], "inventory": 200, "rating": 4.8, "reviews_count": 312, "is_active": True, "tags": ["polo", "shirt", "cotton"]},
        {"id": str(uuid.uuid4()), "name": "Slim Fit Chino Pants", "description": "Modern slim fit chino pants. Versatile and comfortable for everyday wear.", "category": "mens-fashion", "image": "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=500", "images": ["https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=500"], "price": 39.99, "compare_price": 59.99, "variants": [], "inventory": 150, "rating": 4.5, "reviews_count": 178, "is_active": True, "tags": ["pants", "chino", "slim"]},
        {"id": str(uuid.uuid4()), "name": "Casual Linen Blazer", "description": "Lightweight linen blazer perfect for summer events. Breathable and stylish.", "category": "mens-fashion", "image": "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=500", "images": ["https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=500"], "price": 79.99, "compare_price": 129.00, "variants": [], "inventory": 60, "rating": 4.7, "reviews_count": 95, "is_active": True, "tags": ["blazer", "linen", "formal"]},
        
        # Pet Supplies
        {"id": str(uuid.uuid4()), "name": "Interactive Dog Puzzle Toy", "description": "Keep your dog mentally stimulated with this interactive puzzle toy. Durable and fun!", "category": "pet-supplies", "image": "https://images.unsplash.com/photo-1535294435445-d7249524ef2e?w=500", "images": ["https://images.unsplash.com/photo-1535294435445-d7249524ef2e?w=500"], "price": 19.99, "compare_price": 29.99, "variants": [], "inventory": 300, "rating": 4.9, "reviews_count": 456, "is_active": True, "tags": ["dog", "toy", "puzzle"]},
        {"id": str(uuid.uuid4()), "name": "Cozy Cat Bed", "description": "Ultra-soft plush cat bed. Perfect for cats who love to curl up and nap.", "category": "pet-supplies", "image": "https://images.unsplash.com/photo-1545249390-6bdfa286032f?w=500", "images": ["https://images.unsplash.com/photo-1545249390-6bdfa286032f?w=500"], "price": 24.99, "compare_price": None, "variants": [], "inventory": 180, "rating": 4.6, "reviews_count": 234, "is_active": True, "tags": ["cat", "bed", "cozy"]},
        {"id": str(uuid.uuid4()), "name": "Automatic Pet Feeder", "description": "Programmable automatic pet feeder. Never miss a feeding time for your furry friend.", "category": "pet-supplies", "image": "https://images.unsplash.com/photo-1601758124096-1fd661873b95?w=500", "images": ["https://images.unsplash.com/photo-1601758124096-1fd661873b95?w=500"], "price": 49.99, "compare_price": 79.99, "variants": [], "inventory": 90, "rating": 4.4, "reviews_count": 167, "is_active": True, "tags": ["feeder", "automatic", "pet"]},
        
        # Electronics
        {"id": str(uuid.uuid4()), "name": "Wireless Bluetooth Earbuds", "description": "Premium wireless earbuds with noise cancellation. 24-hour battery life.", "category": "electronics", "image": "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500", "images": ["https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500"], "price": 39.99, "compare_price": 79.99, "variants": [], "inventory": 500, "rating": 4.7, "reviews_count": 892, "is_active": True, "tags": ["earbuds", "bluetooth", "wireless"]},
        {"id": str(uuid.uuid4()), "name": "Smart Watch Fitness Tracker", "description": "Track your fitness goals with this feature-packed smart watch. Heart rate, steps, sleep tracking.", "category": "electronics", "image": "https://images.unsplash.com/photo-1544117519-31a4b719223d?w=500", "images": ["https://images.unsplash.com/photo-1544117519-31a4b719223d?w=500"], "price": 59.99, "compare_price": 99.99, "variants": [], "inventory": 250, "rating": 4.5, "reviews_count": 567, "is_active": True, "tags": ["watch", "fitness", "smart"]},
        {"id": str(uuid.uuid4()), "name": "Portable Power Bank 20000mAh", "description": "High-capacity power bank with fast charging. Charge multiple devices on the go.", "category": "electronics", "image": "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=500", "images": ["https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=500"], "price": 29.99, "compare_price": 49.99, "variants": [], "inventory": 400, "rating": 4.8, "reviews_count": 723, "is_active": True, "tags": ["powerbank", "charging", "portable"]},
        
        # Health & Beauty
        {"id": str(uuid.uuid4()), "name": "Vitamin C Serum", "description": "Brightening vitamin C serum for radiant skin. Anti-aging formula with hyaluronic acid.", "category": "health-beauty", "image": "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=500", "images": ["https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=500"], "price": 24.99, "compare_price": 39.99, "variants": [], "inventory": 350, "rating": 4.8, "reviews_count": 445, "is_active": True, "tags": ["serum", "skincare", "vitamin"]},
        {"id": str(uuid.uuid4()), "name": "Electric Facial Massager", "description": "Rejuvenate your skin with this electric facial massager. Reduces puffiness and fine lines.", "category": "health-beauty", "image": "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500", "images": ["https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500"], "price": 34.99, "compare_price": 59.99, "variants": [], "inventory": 180, "rating": 4.6, "reviews_count": 234, "is_active": True, "tags": ["massager", "facial", "beauty"]},
        {"id": str(uuid.uuid4()), "name": "Organic Hair Growth Oil", "description": "Natural hair growth oil with essential nutrients. Promotes healthy, shiny hair.", "category": "health-beauty", "image": "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=500", "images": ["https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=500"], "price": 18.99, "compare_price": 29.99, "variants": [], "inventory": 280, "rating": 4.5, "reviews_count": 312, "is_active": True, "tags": ["hair", "oil", "organic"]},
        
        # Outdoor & Sports
        {"id": str(uuid.uuid4()), "name": "Ultralight Hiking Backpack", "description": "40L ultralight hiking backpack with waterproof coating. Perfect for outdoor adventures.", "category": "outdoor-sports", "image": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500", "images": ["https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500"], "price": 49.99, "compare_price": 89.99, "variants": [], "inventory": 120, "rating": 4.7, "reviews_count": 289, "is_active": True, "tags": ["backpack", "hiking", "outdoor"]},
        {"id": str(uuid.uuid4()), "name": "Yoga Mat Non-Slip", "description": "Extra thick non-slip yoga mat. Comfortable cushioning for all yoga practices.", "category": "outdoor-sports", "image": "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500", "images": ["https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500"], "price": 29.99, "compare_price": 45.00, "variants": [], "inventory": 200, "rating": 4.8, "reviews_count": 456, "is_active": True, "tags": ["yoga", "mat", "fitness"]},
        {"id": str(uuid.uuid4()), "name": "Resistance Bands Set", "description": "Complete resistance bands set with 5 levels. Perfect for home workouts.", "category": "outdoor-sports", "image": "https://images.unsplash.com/photo-1598289431512-b97b0917affc?w=500", "images": ["https://images.unsplash.com/photo-1598289431512-b97b0917affc?w=500"], "price": 19.99, "compare_price": 34.99, "variants": [], "inventory": 350, "rating": 4.6, "reviews_count": 567, "is_active": True, "tags": ["bands", "resistance", "workout"]},
    ]
    
    for product in demo_products:
        product["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.products.insert_many(demo_products)
    return demo_products

# ============ Email Service ============

async def send_email(to_email: str, subject: str, html_content: str):
    """Send email using Resend"""
    api_key = os.environ.get('RESEND_API_KEY', '')
    if not api_key:
        logger.warning("RESEND_API_KEY not configured, skipping email")
        return None
    
    resend.api_key = api_key
    
    try:
        params = {
            "from": os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev'),
            "to": [to_email],
            "subject": subject,
            "html": html_content
        }
        email = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent to {to_email}: {email.get('id')}")
        return email
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return None

async def send_order_confirmation(order: dict):
    """Send order confirmation email"""
    shipping = order.get("shipping_address", {})
    items_html = "".join([
        f"<tr><td style='padding:8px;border-bottom:1px solid #eee;'>{item['name']}</td><td style='padding:8px;border-bottom:1px solid #eee;'>x{item['quantity']}</td><td style='padding:8px;border-bottom:1px solid #eee;'>${item['price']:.2f}</td></tr>"
        for item in order.get("items", [])
    ])
    
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#F97316;color:white;padding:20px;text-align:center;">
            <h1 style="margin:0;">NOVAXS</h1>
        </div>
        <div style="padding:30px;background:#fff;">
            <h2 style="color:#0F172A;">Order Confirmed! 🎉</h2>
            <p>Thank you for your order, {shipping.get('name', 'Customer')}!</p>
            <p><strong>Order Number:</strong> {order.get('order_number')}</p>
            <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                <thead><tr style="background:#f8f8f8;"><th style="padding:10px;text-align:left;">Item</th><th style="padding:10px;">Qty</th><th style="padding:10px;">Price</th></tr></thead>
                <tbody>{items_html}</tbody>
            </table>
            <div style="background:#f8f8f8;padding:15px;border-radius:8px;">
                <p style="margin:5px 0;"><strong>Subtotal:</strong> ${order.get('subtotal', 0):.2f}</p>
                <p style="margin:5px 0;"><strong>Shipping:</strong> ${order.get('shipping_cost', 0):.2f}</p>
                <p style="margin:5px 0;"><strong>Tax:</strong> ${order.get('tax', 0):.2f}</p>
                <p style="margin:5px 0;font-size:18px;"><strong>Total:</strong> <span style="color:#F97316;">${order.get('total', 0):.2f}</span></p>
            </div>
            <div style="margin-top:20px;padding:15px;background:#f0f9ff;border-radius:8px;">
                <h3 style="margin:0 0 10px 0;">Shipping To:</h3>
                <p style="margin:0;">{shipping.get('name')}<br>{shipping.get('address')}<br>{shipping.get('city')}, {shipping.get('state')} {shipping.get('zip_code')}</p>
            </div>
        </div>
        <div style="background:#0F172A;color:#94A3B8;padding:20px;text-align:center;font-size:12px;">
            <p>© 2024 NOVAXS. All rights reserved.</p>
        </div>
    </div>
    """
    
    await send_email(shipping.get('email'), f"Order Confirmed - {order.get('order_number')}", html)
    # Also notify admin
    await send_email(ADMIN_EMAIL, f"New Order - {order.get('order_number')}", html)

async def send_shipping_notification(order: dict, tracking_number: str):
    """Send shipping notification email"""
    shipping = order.get("shipping_address", {})
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#F97316;color:white;padding:20px;text-align:center;">
            <h1 style="margin:0;">NOVAXS</h1>
        </div>
        <div style="padding:30px;background:#fff;">
            <h2 style="color:#0F172A;">Your Order Has Shipped! 📦</h2>
            <p>Great news, {shipping.get('name', 'Customer')}! Your order is on its way.</p>
            <div style="background:#f0f9ff;padding:20px;border-radius:8px;text-align:center;margin:20px 0;">
                <p style="margin:0;font-size:14px;color:#64748B;">Tracking Number</p>
                <p style="margin:10px 0;font-size:24px;font-weight:bold;color:#0F172A;">{tracking_number}</p>
            </div>
            <p><strong>Order Number:</strong> {order.get('order_number')}</p>
        </div>
        <div style="background:#0F172A;color:#94A3B8;padding:20px;text-align:center;font-size:12px;">
            <p>© 2024 NOVAXS. All rights reserved.</p>
        </div>
    </div>
    """
    await send_email(shipping.get('email'), f"Your Order Has Shipped - {order.get('order_number')}", html)

# ============ Admin Routes ============

class AdminLogin(BaseModel):
    email: EmailStr
    password: str

class ProductCreate(BaseModel):
    name: str
    description: str
    category: str
    image: str
    price: float
    compare_price: Optional[float] = None
    inventory: int = 100
    tags: List[str] = []

async def get_admin_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify admin token"""
    if not credentials:
        raise HTTPException(status_code=401, detail="Admin authentication required")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if not payload.get("is_admin"):
            raise HTTPException(status_code=403, detail="Admin access required")
        return payload
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid admin token")

@api_router.post("/admin/login")
async def admin_login(credentials: AdminLogin):
    """Admin login"""
    if credentials.email == ADMIN_EMAIL and credentials.password == ADMIN_PASSWORD:
        token = jwt.encode({
            "email": credentials.email,
            "is_admin": True,
            "exp": datetime.now(timezone.utc) + timedelta(days=7)
        }, JWT_SECRET, algorithm=JWT_ALGORITHM)
        return {"access_token": token, "token_type": "bearer"}
    raise HTTPException(status_code=401, detail="Invalid admin credentials")

@api_router.get("/admin/dashboard")
async def admin_dashboard(admin=Depends(get_admin_user)):
    """Admin dashboard stats"""
    total_orders = await db.orders.count_documents({})
    total_products = await db.products.count_documents({})
    total_users = await db.users.count_documents({})
    
    # Revenue calculation
    pipeline = [
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}}
    ]
    revenue_result = await db.orders.aggregate(pipeline).to_list(1)
    total_revenue = revenue_result[0]["total"] if revenue_result else 0
    
    # Recent orders
    recent_orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    
    # Orders by status
    status_pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    status_counts = await db.orders.aggregate(status_pipeline).to_list(10)
    orders_by_status = {item["_id"]: item["count"] for item in status_counts}
    
    return {
        "stats": {
            "total_orders": total_orders,
            "total_products": total_products,
            "total_users": total_users,
            "total_revenue": round(total_revenue, 2)
        },
        "orders_by_status": orders_by_status,
        "recent_orders": recent_orders
    }

@api_router.get("/admin/orders")
async def admin_get_orders(
    admin=Depends(get_admin_user),
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 20
):
    """Get all orders for admin"""
    query = {}
    if status:
        query["status"] = status
    
    skip = (page - 1) * limit
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.orders.count_documents(query)
    
    return {"orders": orders, "total": total, "page": page, "limit": limit}

@api_router.put("/admin/orders/{order_id}/status")
async def admin_update_order_status(order_id: str, status: str, tracking_number: Optional[str] = None, admin=Depends(get_admin_user)):
    """Update order status"""
    update = {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}
    if tracking_number:
        update["tracking_number"] = tracking_number
    
    result = await db.orders.update_one({"id": order_id}, {"$set": update})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Send shipping notification if shipped
    if status == "shipped" and tracking_number:
        order = await db.orders.find_one({"id": order_id}, {"_id": 0})
        if order:
            asyncio.create_task(send_shipping_notification(order, tracking_number))
    
    return {"message": "Order updated", "status": status}

@api_router.get("/admin/products")
async def admin_get_products(admin=Depends(get_admin_user), page: int = 1, limit: int = 50):
    """Get all products for admin"""
    skip = (page - 1) * limit
    products = await db.products.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.products.count_documents({})
    return {"products": products, "total": total, "page": page}

@api_router.post("/admin/products")
async def admin_create_product(product: ProductCreate, admin=Depends(get_admin_user)):
    """Create new product"""
    product_dict = product.model_dump()
    product_dict["id"] = str(uuid.uuid4())
    product_dict["images"] = [product.image]
    product_dict["variants"] = []
    product_dict["rating"] = 4.5
    product_dict["reviews_count"] = 0
    product_dict["is_active"] = True
    product_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.products.insert_one(product_dict)
    product_dict.pop("_id", None)
    return product_dict

@api_router.put("/admin/products/{product_id}")
async def admin_update_product(product_id: str, updates: dict, admin=Depends(get_admin_user)):
    """Update product"""
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    updates.pop("id", None)
    updates.pop("_id", None)
    
    result = await db.products.update_one({"id": product_id}, {"$set": updates})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product updated"}

@api_router.delete("/admin/products/{product_id}")
async def admin_delete_product(product_id: str, admin=Depends(get_admin_user)):
    """Delete product"""
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted"}

@api_router.post("/admin/sync-eprolo-products")
async def admin_sync_eprolo_products(keyword: str = "", limit: int = 50, admin=Depends(get_admin_user), background_tasks: BackgroundTasks = None):
    """Sync products from EPROLO"""
    if background_tasks:
        background_tasks.add_task(sync_products_from_eprolo, keyword, limit)
    return {"message": "Product sync started", "keyword": keyword, "limit": limit}

@api_router.post("/admin/send-test-email")
async def admin_send_test_email(admin=Depends(get_admin_user)):
    """Send test email to admin"""
    api_key = os.environ.get('RESEND_API_KEY', '')
    admin_email = os.environ.get('ADMIN_EMAIL', 'novaxs6969@gmail.com')
    
    if not api_key:
        return {"message": "Email not configured - add RESEND_API_KEY to .env", "api_key_found": False}
    
    html = """
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#F97316;color:white;padding:20px;text-align:center;">
            <h1 style="margin:0;">NOVAXS</h1>
        </div>
        <div style="padding:30px;background:#fff;text-align:center;">
            <h2>Email Configuration Successful! ✅</h2>
            <p>Your NOVAXS email notifications are working correctly.</p>
            <p style="color:#666;font-size:14px;margin-top:20px;">Note: In test mode, emails go to your Resend verified email. Verify a domain at resend.com/domains to send to customers.</p>
        </div>
    </div>
    """
    result = await send_email(admin_email, "NOVAXS - Email Test Successful", html)
    if result:
        return {"message": f"Test email sent to {admin_email}", "email_id": result.get("id")}
    return {"message": "Email in TEST MODE - verify domain at resend.com/domains to send to customers. Current emails go to your Resend account email only.", "api_key_found": True, "note": "Add a domain at resend.com to enable customer emails"}

# ============ Reviews Routes ============

@api_router.get("/products/{product_id}/reviews")
async def get_product_reviews(product_id: str, page: int = 1, limit: int = 10):
    """Get reviews for a product"""
    skip = (page - 1) * limit
    reviews = await db.reviews.find({"product_id": product_id}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.reviews.count_documents({"product_id": product_id})
    
    # Calculate rating distribution
    pipeline = [
        {"$match": {"product_id": product_id}},
        {"$group": {"_id": "$rating", "count": {"$sum": 1}}}
    ]
    rating_dist = await db.reviews.aggregate(pipeline).to_list(5)
    distribution = {i: 0 for i in range(1, 6)}
    for item in rating_dist:
        distribution[item["_id"]] = item["count"]
    
    return {"reviews": reviews, "total": total, "distribution": distribution}

@api_router.post("/products/{product_id}/reviews")
async def create_review(product_id: str, review: ReviewCreate, user=Depends(get_current_user)):
    """Create a review for a product"""
    # Check if product exists
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Check if user has purchased this product (verified purchase)
    verified = False
    if user:
        order = await db.orders.find_one({
            "user_id": user["id"],
            "items.product_id": product_id,
            "payment_status": "paid"
        })
        verified = order is not None
    
    review_doc = {
        "id": str(uuid.uuid4()),
        "product_id": product_id,
        "user_id": user["id"] if user else None,
        "user_name": user["name"] if user else "Anonymous",
        "rating": review.rating,
        "title": review.title,
        "comment": review.comment,
        "verified_purchase": verified,
        "helpful_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.reviews.insert_one(review_doc)
    
    # Update product rating
    pipeline = [
        {"$match": {"product_id": product_id}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}}
    ]
    result = await db.reviews.aggregate(pipeline).to_list(1)
    if result:
        await db.products.update_one(
            {"id": product_id},
            {"$set": {"rating": round(result[0]["avg"], 1), "reviews_count": result[0]["count"]}}
        )
    
    review_doc.pop("_id", None)
    return review_doc

@api_router.post("/reviews/{review_id}/helpful")
async def mark_review_helpful(review_id: str):
    """Mark a review as helpful"""
    result = await db.reviews.update_one({"id": review_id}, {"$inc": {"helpful_count": 1}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Review not found")
    return {"message": "Marked as helpful"}

# ============ Customer Service Routes ============

@api_router.post("/contact")
async def contact_support(request: ContactRequest):
    """Send customer service request"""
    # Determine if this is a product/shipping issue (CJ handles) or app issue (we handle)
    product_keywords = ["shipping", "delivery", "tracking", "damaged", "wrong item", "refund", "return", "quality"]
    is_product_issue = any(kw in request.message.lower() or kw in request.subject.lower() for kw in product_keywords)
    
    if is_product_issue:
        # Product issues - inform customer CJ handles this
        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:#F97316;color:white;padding:20px;text-align:center;">
                <h1 style="margin:0;">NOVAXS</h1>
            </div>
            <div style="padding:30px;background:#fff;">
                <h2>Customer Support Request Received</h2>
                <p>Thank you for contacting us, {request.name}!</p>
                <p>Your inquiry regarding <strong>{request.subject}</strong> has been received.</p>
                <p>Since this appears to be related to shipping, product quality, or returns, our fulfillment partner will handle your request directly. You should receive a response within 24-48 hours.</p>
                {f'<p><strong>Order #:</strong> {request.order_number}</p>' if request.order_number else ''}
                <div style="background:#f8f8f8;padding:15px;border-radius:8px;margin-top:20px;">
                    <p style="margin:0;"><strong>Your Message:</strong></p>
                    <p style="margin:10px 0 0 0;color:#666;">{request.message}</p>
                </div>
            </div>
        </div>
        """
    else:
        # App/general issues - we handle
        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:#F97316;color:white;padding:20px;text-align:center;">
                <h1 style="margin:0;">NOVAXS</h1>
            </div>
            <div style="padding:30px;background:#fff;">
                <h2>We've Received Your Message!</h2>
                <p>Hi {request.name},</p>
                <p>Thank you for reaching out. Our team will review your inquiry and get back to you within 24 hours.</p>
                <p><strong>Subject:</strong> {request.subject}</p>
                <div style="background:#f8f8f8;padding:15px;border-radius:8px;margin-top:20px;">
                    <p style="margin:0;"><strong>Your Message:</strong></p>
                    <p style="margin:10px 0 0 0;color:#666;">{request.message}</p>
                </div>
            </div>
        </div>
        """
    
    # Send confirmation to customer
    await send_email(request.email, f"Re: {request.subject} - Novaxs Support", html)
    
    # Send to admin
    admin_html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#0F172A;color:white;padding:20px;">
            <h2 style="margin:0;">New Support Request</h2>
        </div>
        <div style="padding:20px;background:#fff;">
            <p><strong>Type:</strong> {'Product/Shipping Issue (CJ)' if is_product_issue else 'App/General Issue'}</p>
            <p><strong>From:</strong> {request.name} ({request.email})</p>
            <p><strong>Subject:</strong> {request.subject}</p>
            {f'<p><strong>Order #:</strong> {request.order_number}</p>' if request.order_number else ''}
            <div style="background:#f8f8f8;padding:15px;border-radius:8px;">
                <p>{request.message}</p>
            </div>
        </div>
    </div>
    """
    await send_email(ADMIN_EMAIL, f"[Support] {request.subject}", admin_html)
    
    # Store in database
    ticket = {
        "id": str(uuid.uuid4()),
        "name": request.name,
        "email": request.email,
        "subject": request.subject,
        "message": request.message,
        "order_number": request.order_number,
        "type": "product" if is_product_issue else "general",
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.support_tickets.insert_one(ticket)
    
    return {"message": "Support request submitted", "ticket_id": ticket["id"], "type": ticket["type"]}

# ============ Security Middleware ============

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

class SecurityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Rate limiting (100 requests per minute per IP)
        client_ip = request.client.host
        current_time = datetime.now(timezone.utc)
        
        if client_ip in rate_limit_store:
            requests, first_request = rate_limit_store[client_ip]
            if (current_time - first_request).seconds < 60:
                if requests >= 100:
                    return JSONResponse(status_code=429, content={"detail": "Too many requests"})
                rate_limit_store[client_ip] = (requests + 1, first_request)
            else:
                rate_limit_store[client_ip] = (1, current_time)
        else:
            rate_limit_store[client_ip] = (1, current_time)
        
        response = await call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        return response

from starlette.responses import JSONResponse
app.add_middleware(SecurityMiddleware)

# ============ Auto Sync EPROLO Products ============

async def auto_sync_eprolo_products():
    """Background task to auto-sync EPROLO products every 6 hours"""
    while True:
        try:
            logger.info("Starting automatic EPROLO product sync...")
            await sync_products_from_eprolo("", 200)
            logger.info("EPROLO product sync completed")
        except Exception as e:
            logger.error(f"EPROLO sync error: {e}")
        await asyncio.sleep(6 * 60 * 60)  # 6 hours

async def auto_sync_tracking():
    """Background task to sync tracking from EPROLO every 30 mins"""
    while True:
        try:
            # Find orders that are processing but don't have tracking yet
            orders = await db.orders.find({
                "status": {"$in": ["processing", "paid"]},
                "eprolo_order_id": {"$exists": True, "$ne": None},
                "$or": [
                    {"tracking_number": {"$exists": False}},
                    {"tracking_number": None},
                    {"tracking_number": ""}
                ]
            }, {"_id": 0}).to_list(50)
            
            for order in orders:
                try:
                    eprolo_status = await eprolo_service.get_order_status(order["eprolo_order_id"])
                    if eprolo_status:
                        tracking = eprolo_status.get("trackingNumber") or eprolo_status.get("trackNumber")
                        if tracking:
                            # Update order with tracking
                            await db.orders.update_one(
                                {"id": order["id"]},
                                {"$set": {
                                    "tracking_number": tracking,
                                    "status": "shipped",
                                    "updated_at": datetime.now(timezone.utc).isoformat()
                                }}
                            )
                            
                            logger.info(f"Tracking synced: {order['order_number']} -> {tracking}")
                            
                            # Send shipping email
                            await send_shipping_notification(order, tracking)
                        
                except Exception as e:
                    logger.error(f"Error syncing tracking for order {order.get('id')}: {e}")
                
                await asyncio.sleep(1)  # Small delay between orders
                
        except Exception as e:
            logger.error(f"Tracking sync error: {e}")
        
        await asyncio.sleep(30 * 60)  # Every 30 minutes

@app.on_event("startup")
async def startup_event():
    # Start auto-sync tasks
    asyncio.create_task(auto_sync_eprolo_products())
    asyncio.create_task(auto_sync_tracking())
    logger.info("NOVAXS API started - Auto EPROLO sync & tracking enabled")

# Include the router
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
