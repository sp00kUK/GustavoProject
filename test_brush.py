from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
        page.on("pageerror", lambda err: print(f"ERROR: {err}"))
        
        print("Navigating...")
        page.goto("http://localhost:5173")
        time.sleep(3)
        
        print("Clicking brush tool...")
        page.click("button:has-text('Brush')")
        time.sleep(1)
        
        print("Dragging on canvas...")
        canvas = page.locator("canvas").first
        box = canvas.bounding_box()
        page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        page.mouse.down()
        page.mouse.move(box["x"] + box["width"] / 2 + 50, box["y"] + box["height"] / 2 + 50, steps=10)
        page.mouse.up()
        time.sleep(1)
        
        browser.close()

run()
