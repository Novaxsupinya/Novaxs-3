# COPY everything below this line into server.py
# Paste it RIGHT ABOVE the line: @api_router.post("/admin/clear-demo-products")

@api_router.post("/admin/recategorize-products")
async def admin_recategorize_products(admin=Depends(get_admin_user)):
    rules = [
        (["women", "woman", "lady", "dress", "skirt", "blouse"], "womens-fashion"),
        (["men", "man", "male", "gentleman", "mens"], "mens-fashion"),
        (["pet", "dog", "cat", "puppy", "kitten"], "pet-supplies"),
        (["beauty", "skincare", "makeup", "cosmetic", "hair", "nail", "lotion", "cream"], "health-beauty"),
        (["outdoor", "sport", "camping", "hiking", "yoga", "fitness", "gym"], "outdoor-sports"),
        (["phone", "earbud", "headphone", "speaker", "charger", "cable", "laptop", "camera", "usb", "bluetooth", "watch"], "electronics"),
        (["hoodie", "sweater", "cardigan", "jacket", "coat", "t-shirt", "pants", "jeans", "knit", "pullover"], "womens-fashion"),
    ]
    products = await db.products.find({}, {"_id": 0, "id": 1, "name": 1, "category": 1}).to_list(5000)
    updated = 0
    for p in products:
        name = (p.get("name") or "").lower()
        new_cat = "womens-fashion"
        for keywords, cat in rules:
            if any(k in name for k in keywords):
                new_cat = cat
                break
        if p.get("category") != new_cat:
            await db.products.update_one({"id": p["id"]}, {"$set": {"category": new_cat}})
            updated += 1
    return {"message": "Recategorize complete", "updated": updated, "total_checked": len(products)}
