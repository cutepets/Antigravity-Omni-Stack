export type GroupedHotelEntry = {
  item: any;
  orderItem: { id: string; hotelStayId?: string | null };
  existingStayId?: string | null;
};

export function normalizeHotelLineType(value?: string | null): 'REGULAR' | 'HOLIDAY' {
  return value === 'HOLIDAY' ? 'HOLIDAY' : 'REGULAR';
}

export function buildGroupedHotelStayPlan(entries: GroupedHotelEntry[]) {
  const sortedGroupItems = [...entries].sort((left, right) => {
    const leftIndex = left.item.hotelDetails?.chargeLineIndex;
    const rightIndex = right.item.hotelDetails?.chargeLineIndex;
    return (leftIndex ?? 0) - (rightIndex ?? 0);
  });
  const first = sortedGroupItems[0];
  if (!first?.item.hotelDetails) {
    return null;
  }

  const firstDetails = first.item.hotelDetails;
  const checkInDate = new Date(firstDetails.checkInDate);
  const checkOutDate = new Date(firstDetails.checkOutDate);
  const totalPrice = sortedGroupItems.reduce(
    (sum, entry) => sum + entry.item.unitPrice * entry.item.quantity - (entry.item.discountItem ?? 0),
    0,
  );
  const totalDays = sortedGroupItems.reduce(
    (sum, entry) => sum + Number(entry.item.hotelDetails?.chargeQuantityDays ?? entry.item.quantity ?? 0),
    0,
  );
  const chargeLineTypes = sortedGroupItems.map((entry) =>
    normalizeHotelLineType(entry.item.hotelDetails?.chargeDayType ?? entry.item.hotelDetails?.lineType),
  );
  const displayLineType = chargeLineTypes.length > 0 && chargeLineTypes.every((lineType) => lineType === 'HOLIDAY')
    ? 'HOLIDAY'
    : 'REGULAR';
  const chargeLines = sortedGroupItems.map((entry, index) => {
    const details = entry.item.hotelDetails;
    const quantityDays = Number(details.chargeQuantityDays ?? entry.item.quantity ?? 0);
    const unitPrice = Number(details.chargeUnitPrice ?? entry.item.unitPrice ?? 0);
    const subtotal = Number(
      details.chargeSubtotal ?? entry.item.unitPrice * entry.item.quantity - (entry.item.discountItem ?? 0),
    );

    return {
      label: details.chargeLineLabel ?? entry.item.description,
      dayType: normalizeHotelLineType(details.chargeDayType ?? details.lineType),
      quantityDays,
      unitPrice,
      subtotal,
      sortOrder: details.chargeLineIndex ?? index,
      weightBandId: details.chargeWeightBandId || null,
      pricingSnapshot: {
        source: 'POS_HOTEL_CHARGE_LINE',
        bookingGroupKey: details.bookingGroupKey ?? null,
        weightBandLabel: details.chargeWeightBandLabel ?? null,
        orderItemId: entry.orderItem.id,
      },
    };
  });
  const pricingSnapshot = {
    source: 'POS_HOTEL_CHARGE_LINES',
    bookingGroupKey: firstDetails.bookingGroupKey ?? null,
    chargeLines: chargeLines.map((line) => ({
      label: line.label,
      dayType: line.dayType,
      quantityDays: line.quantityDays,
      unitPrice: line.unitPrice,
      subtotal: line.subtotal,
      weightBandId: line.weightBandId,
    })),
  };
  const breakdownSnapshot = {
    totalDays,
    totalPrice,
    chargeLines: pricingSnapshot.chargeLines,
  };

  return {
    sortedGroupItems,
    first,
    firstDetails,
    checkInDate,
    checkOutDate,
    totalPrice,
    totalDays,
    displayLineType,
    chargeLines,
    pricingSnapshot,
    breakdownSnapshot,
  };
}
