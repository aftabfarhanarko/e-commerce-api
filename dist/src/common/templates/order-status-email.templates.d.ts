export declare function generateOrderPlacedEmail(customerName: string, orderId: number, totalAmount: number, productList: string, storeName: string): string;
export declare function generateOrderProcessingEmail(customerName: string, orderId: number, storeName: string, trackingUrl?: string, trackingId?: string): string;
export declare function generateOrderShippedEmail(customerName: string, orderId: number, trackingId?: string, provider?: string, storeName?: string, trackingUrl?: string): string;
export declare function generateOrderDeliveredEmail(customerName: string, orderId: number, storeName: string): string;
