import requests
import sys
import json
from datetime import datetime

class HandsFreeAPITester:
    def __init__(self, base_url="https://seamless-retail-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_id = None
        self.cart_id = f"test_cart_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, response.text
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:200]
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "error": str(e)
            })
            return False, {}

    def test_health_check(self):
        """Test basic health endpoints"""
        print("\n=== HEALTH CHECK TESTS ===")
        
        # Test root endpoint
        success, response = self.run_test("API Root", "GET", "", 200)
        if success:
            print(f"   Message: {response.get('message', 'N/A')}")
        
        # Test health endpoint
        success, response = self.run_test("Health Check", "GET", "health", 200)
        if success:
            print(f"   Status: {response.get('status', 'N/A')}")
        
        return success

    def test_categories(self):
        """Test categories API"""
        print("\n=== CATEGORIES TESTS ===")
        
        success, response = self.run_test("Get Categories", "GET", "categories", 200)
        if success:
            categories = response if isinstance(response, list) else []
            print(f"   Found {len(categories)} categories")
            if len(categories) >= 6:
                print("✅ Categories API returns 6+ categories as expected")
                for cat in categories[:3]:
                    print(f"   - {cat.get('name', 'Unknown')}: {cat.get('slug', 'no-slug')}")
                return True, categories
            else:
                print(f"❌ Expected 6+ categories, got {len(categories)}")
                self.failed_tests.append({
                    "test": "Categories Count",
                    "expected": "6+ categories",
                    "actual": f"{len(categories)} categories"
                })
        
        return False, []

    def test_products(self):
        """Test products API"""
        print("\n=== PRODUCTS TESTS ===")
        
        # Test get all products
        success, response = self.run_test("Get All Products", "GET", "products", 200)
        if success:
            products = response.get('products', [])
            total = response.get('total', 0)
            print(f"   Found {len(products)} products (total: {total})")
            
            if len(products) > 0:
                product = products[0]
                print(f"   Sample product: {product.get('name', 'Unknown')}")
                print(f"   Price: ${product.get('price', 0)}")
                print(f"   Rating: {product.get('rating', 0)}")
                
                # Verify product structure
                required_fields = ['id', 'name', 'price', 'rating', 'category', 'image']
                missing_fields = [field for field in required_fields if field not in product]
                if not missing_fields:
                    print("✅ Product structure is correct")
                else:
                    print(f"❌ Missing product fields: {missing_fields}")
                    self.failed_tests.append({
                        "test": "Product Structure",
                        "missing_fields": missing_fields
                    })
                
                return True, products
        
        return False, []

    def test_featured_products(self):
        """Test featured products API"""
        print("\n=== FEATURED PRODUCTS TESTS ===")
        
        success, response = self.run_test("Get Featured Products", "GET", "products/featured?limit=8", 200)
        if success:
            products = response if isinstance(response, list) else []
            print(f"   Found {len(products)} featured products")
            if len(products) > 0:
                print("✅ Featured products API working")
                return True, products
        
        return False, []

    def test_product_detail(self, product_id):
        """Test individual product detail"""
        print("\n=== PRODUCT DETAIL TESTS ===")
        
        success, response = self.run_test("Get Product Detail", "GET", f"products/{product_id}", 200)
        if success:
            print(f"   Product: {response.get('name', 'Unknown')}")
            print(f"   Description: {response.get('description', 'No description')[:50]}...")
            return True, response
        
        return False, {}

    def test_cart_operations(self, product_id):
        """Test cart functionality"""
        print("\n=== CART TESTS ===")
        
        # Get empty cart
        success, cart = self.run_test("Get Cart", "GET", f"cart/{self.cart_id}", 200)
        if success:
            print(f"   Cart ID: {self.cart_id}")
            print(f"   Items: {len(cart.get('items', []))}")
        
        # Add item to cart
        success, cart = self.run_test(
            "Add to Cart", 
            "POST", 
            f"cart/{self.cart_id}/items",
            200,
            data={"product_id": product_id, "quantity": 2}
        )
        if success:
            items = cart.get('items', [])
            print(f"   Items after add: {len(items)}")
            if len(items) > 0:
                print(f"   Item quantity: {items[0].get('quantity', 0)}")
                print("✅ Add to cart working")
            
            # Update cart item
            success, cart = self.run_test(
                "Update Cart Item",
                "PUT",
                f"cart/{self.cart_id}/items/{product_id}?quantity=3",
                200
            )
            if success:
                items = cart.get('items', [])
                if len(items) > 0 and items[0].get('quantity') == 3:
                    print("✅ Cart quantity update working")
                
                # Remove item from cart
                success, cart = self.run_test(
                    "Remove from Cart",
                    "DELETE",
                    f"cart/{self.cart_id}/items/{product_id}",
                    200
                )
                if success:
                    items = cart.get('items', [])
                    print(f"   Items after remove: {len(items)}")
                    print("✅ Remove from cart working")
                    return True
        
        return False

    def test_search_functionality(self):
        """Test search functionality"""
        print("\n=== SEARCH TESTS ===")
        
        success, response = self.run_test("Search Products", "GET", "products?search=dress", 200)
        if success:
            products = response.get('products', [])
            total = response.get('total', 0)
            print(f"   Search results: {len(products)} products (total: {total})")
            if len(products) > 0:
                print("✅ Search functionality working")
                return True
        
        return False

    def test_category_filtering(self):
        """Test category filtering"""
        print("\n=== CATEGORY FILTERING TESTS ===")
        
        success, response = self.run_test("Filter by Category", "GET", "products?category=womens-fashion", 200)
        if success:
            products = response.get('products', [])
            total = response.get('total', 0)
            print(f"   Category filter results: {len(products)} products (total: {total})")
            if len(products) > 0:
                # Check if products belong to the category
                sample_product = products[0]
                category = sample_product.get('category', '')
                print(f"   Sample product category: {category}")
                if 'womens-fashion' in category or 'women' in category.lower():
                    print("✅ Category filtering working")
                    return True
        
        return False

    def test_auth_system(self):
        """Test user registration and login"""
        print("\n=== AUTHENTICATION TESTS ===")
        
        # Test registration
        test_email = f"test_{datetime.now().strftime('%Y%m%d_%H%M%S')}@example.com"
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data={
                "name": "Test User",
                "email": test_email,
                "password": "TestPass123!"
            }
        )
        
        if success:
            self.token = response.get('access_token')
            user = response.get('user', {})
            self.user_id = user.get('id')
            print(f"   Registered user: {user.get('name')} ({user.get('email')})")
            print("✅ User registration working")
            
            # Test login
            success, response = self.run_test(
                "User Login",
                "POST",
                "auth/login",
                200,
                data={
                    "email": test_email,
                    "password": "TestPass123!"
                }
            )
            
            if success:
                print("✅ User login working")
                
                # Test get current user
                success, response = self.run_test("Get Current User", "GET", "auth/me", 200)
                if success:
                    print(f"   Current user: {response.get('name')}")
                    print("✅ Get current user working")
                    return True
        
        return False

    def test_order_creation(self, product_id):
        """Test order creation"""
        print("\n=== ORDER TESTS ===")
        
        # First add item to cart
        self.run_test(
            "Add to Cart for Order", 
            "POST", 
            f"cart/{self.cart_id}/items",
            200,
            data={"product_id": product_id, "quantity": 1}
        )
        
        # Create order
        success, response = self.run_test(
            "Create Order",
            "POST",
            "orders",
            200,
            data={
                "shipping_address": {
                    "name": "Test User",
                    "email": "test@example.com",
                    "phone": "1234567890",
                    "address": "123 Test St",
                    "city": "Test City",
                    "state": "TS",
                    "zip_code": "12345",
                    "country": "United States",
                    "country_code": "US"
                },
                "cart_id": self.cart_id
            }
        )
        
        if success:
            order = response.get('order', {})
            order_id = order.get('id')
            paypal_order_id = response.get('paypal_order_id')
            print(f"   Order ID: {order_id}")
            print(f"   Order Number: {order.get('order_number')}")
            print(f"   PayPal Order ID: {paypal_order_id}")
            print(f"   Total: ${order.get('total', 0)}")
            print("✅ Order creation working")
            
            if paypal_order_id:
                # Test payment capture (mock)
                success, response = self.run_test(
                    "Capture Payment",
                    "POST",
                    f"orders/{order_id}/capture?paypal_order_id={paypal_order_id}",
                    200
                )
                if success:
                    print("✅ Payment capture working (mock)")
                    return True, order_id
        
        return False, None

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting HandsFree E-commerce API Tests")
        print(f"Base URL: {self.base_url}")
        print("=" * 60)
        
        # Health check
        if not self.test_health_check():
            print("❌ Health check failed - stopping tests")
            return False
        
        # Categories
        success, categories = self.test_categories()
        if not success:
            print("⚠️  Categories test failed")
        
        # Products
        success, products = self.test_products()
        if not success:
            print("❌ Products test failed - stopping tests")
            return False
        
        # Featured products
        self.test_featured_products()
        
        # Product detail
        if products:
            product_id = products[0]['id']
            self.test_product_detail(product_id)
            
            # Cart operations
            self.test_cart_operations(product_id)
        
        # Search
        self.test_search_functionality()
        
        # Category filtering
        self.test_category_filtering()
        
        # Authentication
        auth_success = self.test_auth_system()
        
        # Order creation (requires auth)
        if auth_success and products:
            self.test_order_creation(products[0]['id'])
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Tests failed: {self.tests_run - self.tests_passed}")
        print(f"Success rate: {(self.tests_passed / self.tests_run * 100):.1f}%")
        
        if self.failed_tests:
            print("\n❌ FAILED TESTS:")
            for i, test in enumerate(self.failed_tests, 1):
                print(f"{i}. {test.get('test', 'Unknown')}")
                if 'error' in test:
                    print(f"   Error: {test['error']}")
                elif 'expected' in test and 'actual' in test:
                    print(f"   Expected: {test['expected']}, Got: {test['actual']}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = HandsFreeAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())