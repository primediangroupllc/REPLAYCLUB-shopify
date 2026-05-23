import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import {
  createCart,
  addToCart,
  updateCartLines,
  removeCartLines,
  getCart,
} from '@/lib/cart';
import type { Cart } from '@/lib/shopify-types';

const CART_STORAGE_KEY = 'shopify_cart_id';

interface CartContextValue {
  cart: Cart | null;
  loading: boolean;
  initializing: boolean;
  error: string | null;
  addItem: (merchandiseId: string, quantity?: number) => Promise<void>;
  updateItem: (lineId: string, quantity: number) => Promise<void>;
  removeItem: (lineId: string) => Promise<void>;
  goToCheckout: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedId = localStorage.getItem(CART_STORAGE_KEY);
    if (!storedId) {
      setInitializing(false);
      return;
    }
    getCart(storedId)
      .then((restored) => {
        if (restored) {
          setCart(restored);
        } else {
          localStorage.removeItem(CART_STORAGE_KEY);
        }
      })
      .catch(() => {
        localStorage.removeItem(CART_STORAGE_KEY);
      })
      .finally(() => setInitializing(false));
  }, []);

  const addItem = useCallback(
    async (merchandiseId: string, quantity = 1) => {
      setLoading(true);
      setError(null);
      try {
        const lines = [{ merchandiseId, quantity }];
        let updated: Cart;
        if (cart) {
          updated = await addToCart(cart.id, lines);
        } else {
          updated = await createCart(lines);
          localStorage.setItem(CART_STORAGE_KEY, updated.id);
        }
        setCart(updated);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to add item');
      } finally {
        setLoading(false);
      }
    },
    [cart],
  );

  const updateItem = useCallback(
    async (lineId: string, quantity: number) => {
      if (!cart) return;
      setLoading(true);
      setError(null);
      try {
        const updated =
          quantity <= 0
            ? await removeCartLines(cart.id, [lineId])
            : await updateCartLines(cart.id, [{ id: lineId, quantity }]);
        setCart(updated);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update item');
      } finally {
        setLoading(false);
      }
    },
    [cart],
  );

  const removeItem = useCallback(
    async (lineId: string) => {
      if (!cart) return;
      setLoading(true);
      setError(null);
      try {
        const updated = await removeCartLines(cart.id, [lineId]);
        setCart(updated);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to remove item');
      } finally {
        setLoading(false);
      }
    },
    [cart],
  );

  const goToCheckout = useCallback(() => {
    if (cart?.checkoutUrl) {
      window.location.href = cart.checkoutUrl;
    }
  }, [cart]);

  return (
    <CartContext.Provider
      value={{ cart, loading, initializing, error, addItem, updateItem, removeItem, goToCheckout }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return ctx;
}
