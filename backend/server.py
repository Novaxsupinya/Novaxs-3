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
app = FastAPI(title="Novaxs E-commerce API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer(auto_error=False)
JWT_SECRET = os.environ.get('JWT_SECRET', 'handsfree-ecommerce-secret-key-2024')
JWT_ALGORITHM = "HS256"
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'novaxs6969@gmail.com')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'NovaxsAdmin2024!')

# CJ Dropshipping Configuration
CJ_API_BASE = "https://developers.cjdropshipping.com/api2.0/v1"
CJ_API_KEY = os.environ.get('CJ_API_KEY', '')

# PayPal Configuration
PAYPAL_CLIENT_ID = os.environ.get('PAYPAL_CLIENT_ID', '')
PAYPAL_SECRET = os.environ.get('PAYPAL_SECRET', '')
PAYPAL_BASE_URL = os.environ.get('PAYPAL_BASE_URL', 'https://api-m.sandbox.paypal.com')

# Resend Email Configuration
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

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
    cj_pid: Optional[str] = None
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
    paypal_order_id: Optional[str] = None
    cj_order_id: Optional[str] = None
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
    except:
        return None

def generate_order_number():
    return f"NVX{datetime.now().strftime('%Y%m%d')}{str(uuid.uuid4())[:8].upper()}"

# ============ CJ Dropshipping Service ============

class CJDropshippingService:
    def __init__(self):
        self.base_url = CJ_API_BASE
        self.api_key = CJ_API_KEY
        self.access_token = None
        self.token_expiry = None
    
    async def get_access_token(self):
        """Get CJ access token"""
        if not self.api_key:
            logger.warning("CJ API Key not configured")
            return None
        
        if self.access_token and self.token_expiry and datetime.now(timezone.utc) < self.token_expiry:
            return self.access_token
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/authentication/getAccessToken",
                    json={"apiKey": self.api_key},
                    headers={"Content-Type": "application/json"}
                )
                data = response.json()
                if data.get("code") == 200:
                    self.access_token = data["data"]["accessToken"]
                    self.token_expiry = datetime.now(timezone.utc) + timedelta(days=14)
                    return self.access_token
        except Exception as e:
            logger.error(f"Error getting CJ access token: {e}")
        return None
    
    async def get_products(self, keyword: str = "", category_id: str = "", page: int = 1, size: int = 20):
        """Get products from CJ"""
        token = await self.get_access_token()
        if not token:
            return {"products": [], "total": 0}
        
        try:
            params = {"page": page, "size": size}
            if keyword:
                params["keyWord"] = keyword
            if category_id:
                params["categoryId"] = category_id
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/product/listV2",
                    params=params,
                    headers={"CJ-Access-Token": token}
                )
                data = response.json()
                if data.get("code") == 200:
                    return {
                        "products": data["data"].get("content", []),
                        "total": data["data"].get("totalRecords", 0)
                    }
        except Exception as e:
            logger.error(f"Error getting CJ products: {e}")
        return {"products": [], "total": 0}
    
    async def get_product_details(self, pid: str):
        """Get product details from CJ"""
        token = await self.get_access_token()
        if not token:
            return None
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/product/query",
                    params={"pid": pid},
                    headers={"CJ-Access-Token": token}
                )
                data = response.json()
                if data.get("code") == 200:
                    return data["data"]
        except Exception as e:
            logger.error(f"Error getting CJ product details: {e}")
        return None
    
    async def get_categories(self):
        """Get categories from CJ"""
        token = await self.get_access_token()
        if not token:
            return []
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/product/getCategory",
                    headers={"CJ-Access-Token": token}
                )
                data = response.json()
                if data.get("code") == 200:
                    return data["data"]
        except Exception as e:
            logger.error(f"Error getting CJ categories: {e}")
        return []
    
    async def create_order(self, order_data: Dict[str, Any]):
        """Create order in CJ"""
        token = await self.get_access_token()
        if not token:
            return None
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/shopping/order/createOrderV2",
                    json=order_data,
                    headers={
                        "CJ-Access-Token": token,
                        "Content-Type": "application/json"
                    }
                )
                data = response.json()
                if data.get("code") == 200:
                    return data["data"]
        except Exception as e:
            logger.error(f"Error creating CJ order: {e}")
        return None
    
    async def get_order_status(self, order_id: str):
        """Get order status from CJ"""
        token = await self.get_access_token()
        if not token:
            return None
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/shopping/order/getOrderDetail",
                    params={"orderId": order_id},
                    headers={"CJ-Access-Token": token}
                )
                data = response.json()
                if data.get("code") == 200:
                    return data["data"]
        except Exception as e:
            logger.error(f"Error getting CJ order status: {e}")
        return None
    
    async def get_inventory(self, vid: str):
        """Get inventory for a variant"""
        token = await self.get_access_token()
        if not token:
            return 0
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/product/stock/queryByVid",
                    params={"vid": vid},
                    headers={"CJ-Access-Token": token}
                )
                data = response.json()
                if data.get("code") == 200 and data["data"]:
                    total = sum(item.get("totalInventoryNum", 0) for item in data["data"])
                    return total
        except Exception as e:
            logger.error(f"Error getting CJ inventory: {e}")
        return 0

cj_service = CJDropshippingService()

# ============ PayPal Service ============

class PayPalService:
    def __init__(self):
        self.client_id = PAYPAL_CLIENT_ID
        self.secret = PAYPAL_SECRET
        self.base_url = PAYPAL_BASE_URL
        self.access_token = None
        self.token_expiry = None
    
    async def get_access_token(self):
        """Get PayPal access token"""
        if not self.client_id or not self.secret:
            logger.warning("PayPal credentials not configured")
            return None
        
        if self.access_token and self.token_expiry and datetime.now(timezone.utc) < self.token_expiry:
            return self.access_token
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/v1/oauth2/token",
                    data={"grant_type": "client_credentials"},
                    auth=(self.client_id, self.secret),
                    headers={"Content-Type": "application/x-www-form-urlencoded"}
                )
                data = response.json()
                if "access_token" in data:
                    self.access_token = data["access_token"]
                    self.token_expiry = datetime.now(timezone.utc) + timedelta(seconds=data.get("expires_in", 3600) - 300)
                    return self.access_token
        except Exception as e:
            logger.error(f"Error getting PayPal access token: {e}")
        return None
    
    async def create_order(self, amount: float, currency: str = "USD", order_id: str = ""):
        """Create PayPal order"""
        token = await self.get_access_token()
        if not token:
            # Return mock order for demo
            return {
                "id": f"MOCK-{uuid.uuid4().hex[:12].upper()}",
                "status": "CREATED",
                "links": [{"rel": "approve", "href": "#"}]
            }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/v2/checkout/orders",
                    json={
                        "intent": "CAPTURE",
                        "purchase_units": [{
                            "reference_id": order_id,
                            "amount": {
                                "currency_code": currency,
                                "value": f"{amount:.2f}"
                            }
                        }]
                    },
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json"
                    }
                )
                return response.json()
        except Exception as e:
            logger.error(f"Error creating PayPal order: {e}")
        return None
    
    async def capture_order(self, paypal_order_id: str):
        """Capture PayPal order"""
        token = await self.get_access_token()
        if not token:
            # Return mock capture for demo
            return {
                "id": paypal_order_id,
                "status": "COMPLETED"
            }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/v2/checkout/orders/{paypal_order_id}/capture",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json"
                    }
                )
                return response.json()
        except Exception as e:
            logger.error(f"Error capturing PayPal order: {e}")
        return None

paypal_service = PayPalService()

# ============ API Routes ============

# Health check
@api_router.get("/")
async def root():
    return {"message": "Novaxs E-commerce API", "status": "running"}

@api_router.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

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

@api_router.get("/cart/{cart_id}")
async def get_cart(cart_id: str):
    cart = await db.carts.find_one({"id": cart_id}, {"_id": 0})
    if not cart:
        cart = {"id": cart_id, "items": [], "subtotal": 0.0, "created_at": datetime.now(timezone.utc).isoformat(), "updated_at": datetime.now(timezone.utc).isoformat()}
        await db.carts.insert_one(dict(cart))  # Insert a copy to avoid _id mutation
    
    # Populate product details
    for item in cart.get("items", []):
        product = await db.products.find_one({"id": item["product_id"]}, {"_id": 0})
        if product:
            item["product"] = product
    
    # Remove _id if present
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
    
    # Recalculate subtotal
    subtotal = 0.0
    for cart_item in cart["items"]:
        product = await db.products.find_one({"id": cart_item["product_id"]}, {"_id": 0})
        if product:
            subtotal += product["price"] * cart_item["quantity"]
    
    cart["subtotal"] = subtotal
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
    
    # Recalculate subtotal
    subtotal = 0.0
    for cart_item in cart["items"]:
        product = await db.products.find_one({"id": cart_item["product_id"]}, {"_id": 0})
        if product:
            subtotal += product["price"] * cart_item["quantity"]
    
    cart["subtotal"] = subtotal
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
    
    # Build order items
    order_items = []
    subtotal = 0.0
    for cart_item in cart["items"]:
        product = await db.products.find_one({"id": cart_item["product_id"]}, {"_id": 0})
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
    
    # Create PayPal order
    paypal_order = await paypal_service.create_order(total, "USD", order_number)
    if paypal_order:
        order["paypal_order_id"] = paypal_order.get("id")
    
    await db.orders.insert_one(order)
    
    # Clear cart
    await db.carts.update_one(
        {"id": order_data.cart_id},
        {"$set": {"items": [], "subtotal": 0.0, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Remove _id before returning
    order.pop("_id", None)
    
    return {
        "order": order,
        "paypal_order_id": paypal_order.get("id") if paypal_order else None,
        "paypal_approve_url": next((link["href"] for link in paypal_order.get("links", []) if link["rel"] == "approve"), None) if paypal_order else None
    }

@api_router.post("/orders/{order_id}/capture")
async def capture_payment(order_id: str, paypal_order_id: str, background_tasks: BackgroundTasks):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Capture PayPal payment
    capture_result = await paypal_service.capture_order(paypal_order_id)
    
    if capture_result and capture_result.get("status") == "COMPLETED":
        # Update order status
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {
                "payment_status": "paid",
                "status": "processing",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Trigger CJ order creation in background
        background_tasks.add_task(create_cj_order, order_id)
        
        order["payment_status"] = "paid"
        order["status"] = "processing"
        
        return {"success": True, "order": order, "message": "Payment captured successfully"}
    
    return {"success": False, "message": "Payment capture failed"}

async def create_cj_order(order_id: str):
    """Background task to create CJ Dropshipping order"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        return
    
    shipping = order.get("shipping_address", {})
    
    # Build CJ order products
    products = []
    for item in order.get("items", []):
        product = await db.products.find_one({"id": item["product_id"]}, {"_id": 0})
        if product and product.get("cj_pid"):
            variant_id = item.get("variant_id") or (product.get("variants", [{}])[0].get("vid") if product.get("variants") else None)
            if variant_id:
                products.append({
                    "vid": variant_id,
                    "quantity": item["quantity"]
                })
    
    if not products:
        logger.warning(f"No CJ products found for order {order_id}")
        return
    
    cj_order_data = {
        "orderNumber": order["order_number"],
        "shippingZip": shipping.get("zip_code", ""),
        "shippingCountryCode": shipping.get("country_code", "US"),
        "shippingCountry": shipping.get("country", "United States"),
        "shippingProvince": shipping.get("state", ""),
        "shippingCity": shipping.get("city", ""),
        "shippingPhone": shipping.get("phone", ""),
        "shippingCustomerName": shipping.get("name", ""),
        "shippingAddress": shipping.get("address", ""),
        "shippingAddress2": shipping.get("address2", ""),
        "email": shipping.get("email", ""),
        "payType": 2,
        "logisticName": "CJPacket Ordinary",
        "fromCountryCode": "CN",
        "products": products
    }
    
    cj_result = await cj_service.create_order(cj_order_data)
    
    if cj_result:
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {
                "cj_order_id": cj_result.get("orderId"),
                "status": "processing",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        logger.info(f"CJ order created: {cj_result.get('orderId')} for order {order_id}")

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
    
    # Get CJ order status if available
    if order.get("cj_order_id"):
        cj_status = await cj_service.get_order_status(order["cj_order_id"])
        if cj_status:
            order["cj_status"] = cj_status.get("orderStatus")
            order["tracking_number"] = cj_status.get("trackNumber")
            
            # Update tracking in DB
            if cj_status.get("trackNumber"):
                await db.orders.update_one(
                    {"id": order_id},
                    {"$set": {"tracking_number": cj_status.get("trackNumber")}}
                )
    
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

# ============ CJ Integration Routes ============

@api_router.get("/cj/products")
async def get_cj_products(keyword: str = "", category_id: str = "", page: int = 1, size: int = 20):
    """Get products directly from CJ Dropshipping"""
    result = await cj_service.get_products(keyword, category_id, page, size)
    return result

@api_router.get("/cj/categories")
async def get_cj_categories():
    """Get categories from CJ Dropshipping"""
    return await cj_service.get_categories()

@api_router.post("/cj/sync")
async def sync_cj_products(background_tasks: BackgroundTasks, keyword: str = "", limit: int = 50):
    """Sync products from CJ to local database"""
    background_tasks.add_task(sync_products_from_cj, keyword, limit)
    return {"message": "Product sync started", "keyword": keyword, "limit": limit}

async def sync_products_from_cj(keyword: str = "", limit: int = 50):
    """Background task to sync CJ products"""
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
        result = await cj_service.get_products(kw, "", 1, limit // len(keywords))
        
        for cj_product in result.get("products", []):
            if isinstance(cj_product, dict):
                product_list = cj_product.get("productList", [])
            else:
                product_list = [cj_product]
            
            for prod in product_list:
                category = "electronics"
                for key, cat in categories_map.items():
                    if key in kw.lower() or key in prod.get("nameEn", "").lower():
                        category = cat
                        break
                
                product_id = str(uuid.uuid4())
                product = {
                    "id": product_id,
                    "cj_pid": prod.get("id"),
                    "name": prod.get("nameEn", "Product"),
                    "description": prod.get("description", "High quality product from trusted suppliers."),
                    "category": category,
                    "image": prod.get("bigImage", ""),
                    "images": [prod.get("bigImage", "")],
                    "price": float(prod.get("sellPrice", 0) or prod.get("nowPrice", 0) or 9.99),
                    "compare_price": float(prod.get("sellPrice", 0)) if prod.get("nowPrice") else None,
                    "variants": [],
                    "inventory": prod.get("warehouseInventoryNum", 100),
                    "rating": 4.5,
                    "reviews_count": prod.get("listedNum", 0),
                    "is_active": True,
                    "tags": [kw.lower()],
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                
                existing = await db.products.find_one({"cj_pid": prod.get("id")})
                if not existing:
                    await db.products.insert_one(product)
    
    logger.info(f"Product sync completed for keywords: {keywords}")

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

# ============ PayPal Webhook ============

@api_router.post("/webhooks/paypal")
async def paypal_webhook(request: dict, background_tasks: BackgroundTasks):
    """Handle PayPal webhooks for payment status updates"""
    event_type = request.get("event_type", "")
    resource = request.get("resource", {})
    
    logger.info(f"PayPal webhook received: {event_type}")
    
    if event_type == "PAYMENT.CAPTURE.COMPLETED":
        order_id = resource.get("custom_id") or resource.get("invoice_id")
        if order_id:
            await db.orders.update_one(
                {"order_number": order_id},
                {"$set": {
                    "payment_status": "paid",
                    "status": "processing",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            order = await db.orders.find_one({"order_number": order_id}, {"_id": 0})
            if order:
                background_tasks.add_task(create_cj_order, order["id"])
    
    return {"status": "received"}

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
