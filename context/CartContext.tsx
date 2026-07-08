import React, { createContext, useContext, useState } from "react";

// 1. CREATE THE CONTEXT (The empty brain)
// This creates the invisible cloud that will hold our data.
const CartContext = createContext<any>(null);

// 2. CREATE THE PROVIDER (The manager of the brain)
// We will wrap our whole app inside this Provider later.
export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  // This state holds the actual list of items in the shopping cart
  const [cart, setCart] = useState<any[]>([]);

  // FUNCTION: Add an item (and its add-ons) to the cart
  // FUNCTION: Add an item (and its add-ons) to the cart
  const addToCart = (
    menuItem: any,
    selectedAddOns: any[],
    quantity: number = 1,
  ) => {
    // Generate a unique ID for this specific cart entry based on the current time
    const cartItemId = Date.now().toString();

    // 1. Calculate the base cost (Base Price + Add-ons) * Quantity
    const unitTotal =
      menuItem.price +
      selectedAddOns.reduce((sum: number, addon: any) => sum + addon.price, 0);
    const baseItemTotal = unitTotal * quantity;

    // 2. Calculate the percentage discount (defaults to 0 if none provided)
    const discountPercent = menuItem.discountPercent || 0;
    const discountAmount = baseItemTotal * (discountPercent / 100);

    // 3. Final total after subtracting the discount
    const itemTotal = baseItemTotal - discountAmount;

    // Create the final object to save in the cart
    const newCartItem = {
      cartId: cartItemId, // Unique ID for the cart row
      ...menuItem, // Copy all details (name, price, stylists array, discount info)
      selectedAddOns, // Save the add-ons they chose
      itemTotal, // Save the freshly calculated discounted total
      quantity, // Save the quantity
    };

    // Update the cart state by keeping the old items (...cart) and adding the new one
    setCart([...cart, newCartItem]);
  };

  const overwriteCart = (savedCart: any[]) => {
    setCart(savedCart);
  };

  // remove from cart
  const removeFromCart = (cartIdToRemove: string) => {
    // use filters to remove the matching id
    setCart(cart.filter((item) => item.cartId !== cartIdToRemove));
  };

  // FUNCTION: Remove everything from the cart (used after checkout)
  const clearCart = () => {
    setCart([]);
  };

  // AUTOMATIC MATH: Calculate the grand total of everything in the cart
  // .reduce() is a JavaScript tool that loops through the array and adds up the 'itemTotal' values
  const cartTotal = cart.reduce((sum, item) => sum + item.itemTotal, 0);

  const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);

  // 3. SHARE THE DATA
  // We pass the cart array, the total math, and our functions down to the rest of the app
  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        clearCart,
        overwriteCart,
        cartTotal,
        totalItems,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

// 4. CREATE A CUSTOM HOOK (A shortcut to access the brain)
// Instead of writing long imports later, we just type `useCart()` in our screens!
export const useCart = () => useContext(CartContext);
