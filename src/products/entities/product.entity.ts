import { CategoryEntity } from "../../category/entities/category.entity";
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from "typeorm";


@Entity("tbl_products")
export class ProductEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  sku: string;

  @Column("decimal", { precision: 10, scale: 2 })
  price: number;

  @Column("decimal", { precision: 10, scale: 2, nullable: true })
  discountPrice?: number;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'simple-json', nullable: true })
  images?: { url: string; alt?: string; isPrimary?: boolean }[];

  @Column({ nullable: true })
  thumbnail?: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'enum', enum: ['draft', 'published', 'trashed', 'pending'], default: 'published' })
  status: 'draft' | 'published' | 'trashed' | 'pending';

  @Column({ default: false })
  isFlashSell: boolean;

  @Column({ type: 'timestamp', nullable: true })
  flashSellStartTime?: Date;

  @Column({ type: 'timestamp', nullable: true })
  flashSellEndTime?: Date;

  @Column("decimal", { precision: 10, scale: 2, nullable: true })
  flashSellPrice?: number;

  // Inventory fields
  @Column("int", { default: 0 })
  stock: number;

  @Column("int", { default: 0 })
  newStock: number;

  @Column("int", { default: 0 })
  sold: number;

  @Column("decimal", { precision: 12, scale: 2, default: 0 })
  totalIncome: number;

  @Column({ default: false })
  isLowStock: boolean;

  // Size variants (e.g. ["S", "M", "L"] or [1, 2, 3, 4])
  @Column({ type: 'simple-json', nullable: true })
  sizes?: (string | number)[];

  // Product variants (e.g. [{ name: "Red" }, { name: "Blue" }])
  @Column({ type: 'simple-json', nullable: true })
  variants?: { name: string }[];


  // Shipping dimensions
  @Column("decimal", { precision: 10, scale: 2, nullable: true })
  weight?: number; // kg

  @Column("decimal", { precision: 10, scale: 2, nullable: true })
  length?: number; // inches

  @Column("decimal", { precision: 10, scale: 2, nullable: true })
  breadth?: number; // inches

  @Column("decimal", { precision: 10, scale: 2, nullable: true })
  width?: number; // inches

  @Column({ default: 'Piece', nullable: true })
  unit?: string;

  @Column({ nullable: false })
  companyId: string;

  @Column({ nullable: true })
  resellerId?: number;

  @Column({ type: 'simple-json', nullable: true })
  variantId?: [];
  



  @ManyToOne(() => CategoryEntity, { nullable: false })
  category: CategoryEntity;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date | null; // soft delete
}
