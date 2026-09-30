export interface DiscountDetails {
  mrp: number;
  price: number;
  discountAmount: number;
  discountPercentage: number;
  formattedDiscount: string;
  hasDiscount: boolean;
}

export interface QuantityPriceCalculation extends DiscountDetails {
  quantity: number;
  totalPrice: number;
  totalMrp: number;
  totalDiscount: number;
}

export const calculateDiscount = (
  price: number,
  mrp?: number | null,
): DiscountDetails => {
  const safePrice = Math.max(0, Number(price) || 0);
  const safeMrp =
    mrp !== undefined && mrp !== null
      ? Math.max(0, Number(mrp) || 0)
      : safePrice;

  const hasDiscount = safeMrp > safePrice;
  const discountAmount = hasDiscount
    ? Number((safeMrp - safePrice).toFixed(2))
    : 0;
  const discountPercentage =
    hasDiscount && safeMrp > 0
      ? Number((((safeMrp - safePrice) / safeMrp) * 100).toFixed(2))
      : 0;

  return {
    mrp: safeMrp,
    price: safePrice,
    discountAmount,
    discountPercentage,
    formattedDiscount:
      discountPercentage > 0
        ? `${Math.round(discountPercentage)}% OFF`
        : "0% OFF",
    hasDiscount,
  };
};

export const calculateQuantityPrice = (
  price: number,
  mrp: number | null | undefined,
  quantity: number = 1,
): QuantityPriceCalculation => {
  const safeQty = Math.max(1, Number(quantity) || 1);
  const singleItem = calculateDiscount(price, mrp);

  const totalPrice = Number((singleItem.price * safeQty).toFixed(2));
  const totalMrp = Number((singleItem.mrp * safeQty).toFixed(2));
  const totalDiscount = Number(
    (singleItem.discountAmount * safeQty).toFixed(2),
  );

  return {
    ...singleItem,
    quantity: safeQty,
    totalPrice,
    totalMrp,
    totalDiscount,
  };
};

export const formatPriceWithDiscount = (priceDoc: any) => {
  if (!priceDoc) return null;
  const doc = priceDoc.toObject ? priceDoc.toObject() : { ...priceDoc };

  const discount = calculateDiscount(doc.price, doc.mrp);

  return {
    ...doc,
    discountAmount: discount.discountAmount,
    discountPercentage: discount.discountPercentage,
    formattedDiscount: discount.formattedDiscount,
  };
};

export default {
  calculateDiscount,
  calculateQuantityPrice,
  formatPriceWithDiscount,
};
