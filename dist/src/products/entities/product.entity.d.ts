import { CategoryEntity } from "../../category/entities/category.entity";
export declare class ProductEntity {
    id: number;
    name: string;
    sku: string;
    price: number;
    discountPrice?: number;
    description?: string;
    images?: {
        url: string;
        alt?: string;
        isPrimary?: boolean;
    }[];
    thumbnail?: string;
    isActive: boolean;
    status: 'draft' | 'published' | 'trashed' | 'pending';
    isFlashSell: boolean;
    flashSellStartTime?: Date;
    flashSellEndTime?: Date;
    flashSellPrice?: number;
    stock: number;
    newStock: number;
    sold: number;
    totalIncome: number;
    isLowStock: boolean;
    sizes?: (string | number)[];
    variants?: {
        name: string;
    }[];
    weight?: number;
    length?: number;
    breadth?: number;
    width?: number;
    unit?: string;
    companyId: string;
    resellerId?: number;
    category: CategoryEntity;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date | null;
}
