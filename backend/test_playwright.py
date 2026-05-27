"""
test_playwright.py  —  Playwright browser E2E test for the ARViz store platform
"""

import time
from playwright.sync_api import sync_playwright

def run_test():
  print("\n=== ARViz Playwright E2E Browser Tests ===\n")
  
  with sync_playwright() as p:
    print("  Launching headless Chromium browser...")
    browser = p.chromium.launch(headless=True)
    
    # Create browser context
    context = browser.new_context(viewport={"width": 1280, "height": 720})
    page = context.new_page()
    
    # 1. Navigate to landing page
    url = "http://localhost:5000/"
    print(f"  Navigating to {url}...")
    page.goto(url)
    
    # Verify page title
    title = page.title()
    print(f"  [PASS] Page Title: '{title}'")
    assert "ARViz" in title
    
    # 2. Open Auth Modal
    print("  Clicking 'Sign In' button...")
    page.click("#btn-nav-login")
    
    # Verify modal open
    page.wait_for_selector("#auth-modal.open")
    print("  [PASS] Sign In modal opened successfully.")
    
    # 3. Perform Login
    print("  Entering demo user credentials...")
    page.fill("#auth-email", "demo@arviz.com")
    page.fill("#auth-password", "demo1234")
    
    print("  Submitting Auth Form...")
    page.click("#btn-auth-submit")
    
    # Wait for modal to close and user badge to show up
    page.wait_for_selector("#nav-user-pill")
    time.sleep(0.5)
    username = page.locator("#nav-username").inner_text()
    print(f"  [PASS] Login successful! Navbar displays User: '{username}'")
    assert username == "Demo User"
    
    # 4. Toggle Wishlist Heart
    print("  Toggling Wishlist Heart on the first product ('Modern Sofa')...")
    # Click the first heart icon on the grid
    page.locator(".card-wishlist-toggle").first.click()
    time.sleep(0.5)
    
    # Check if wishlist button has 'active' class
    heart_btn = page.locator(".card-wishlist-toggle").first
    is_active = "active" in heart_btn.get_attribute("class")
    print(f"  [PASS] Wishlist heart toggled! Active class: {is_active}")
    assert is_active
    
    # 5. Add Sofa to Cart
    print("  Adding the first product ('Modern Sofa') to Shopping Cart...")
    page.locator("button[title='Add to Cart']").first.click()
    
    # Wait for toast confirmation
    page.wait_for_selector("#app-toast.show")
    toast_text = page.locator("#app-toast").inner_text()
    print(f"  [PASS] Toast Notification: '{toast_text}'")
    assert "Added" in toast_text
    
    # 6. Open Cart Drawer
    print("  Opening Shopping Cart Drawer...")
    page.click("#btn-nav-cart")
    page.wait_for_selector("#cart-overlay.open")
    
    # Verify item is in cart
    time.sleep(0.5)
    cart_count = page.locator("#cart-count-badge").inner_text()
    cart_subtotal = page.locator("#cart-subtotal-val").inner_text()
    print(f"  [PASS] Cart drawer open! Items: {cart_count}, Subtotal: {cart_subtotal}")
    assert int(cart_count) > 0
    
    # 7. Checkout Flow (Order Placement)
    print("  Clicking 'Place Order'...")
    # Mock prompt() dialog to automatically supply the delivery address
    page.evaluate("window.prompt = () => '1600 Amphitheatre Parkway, Mountain View, CA';")
    page.click("#btn-cart-checkout")
    
    # Wait for Order Success modal
    page.wait_for_selector("#order-success-modal.open")
    order_receipt = page.locator("#order-success-id").inner_text()
    print(f"  [PASS] Order successfully placed! {order_receipt}")
    assert "Order ID" in order_receipt
    
    # Close modal
    print("  Closing receipt modal...")
    page.click("#btn-order-ok")
    page.wait_for_selector("#order-success-modal:not(.open)")
    print("  [PASS] Order Success Modal closed successfully.")
    
    browser.close()
    print("\n=== All Playwright E2E browser tests PASSED! ===\n")

if __name__ == "__main__":
  run_test()
