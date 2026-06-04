import { Injectable, NotFoundException, BadRequestException, Inject } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository, In, MoreThanOrEqual } from "typeorm";
import { ProductEntity } from "./entities/product.entity";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { FlashSellDto } from "./dto/flash-sell.dto";
import { CategoryEntity } from "../category/entities/category.entity";
import { Order } from "../orders/entities/order.entity";
import { ActivityLogService } from "../systemuser/activity-log.service";
import { ActivityAction, ActivityEntity } from "../systemuser/entities/activity-log.entity";
import { NotificationsService } from "../notifications/notifications.service";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";


@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(ProductEntity)
    private productRepository: Repository<ProductEntity>,
    @InjectRepository(CategoryEntity)
    private categoryRepository: Repository<CategoryEntity>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private readonly activityLogService: ActivityLogService,
    private readonly notificationsService: NotificationsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) { }

  private async clearCache(companyId: string) {
    try {
      const keys = await (this.cacheManager as any).store.keys(`products:company_${companyId}*`);
      if (keys.length > 0) {
        await (this.cacheManager as any).store.del(keys);
      }
    } catch (e) {
      console.error('Failed to clear product cache:', e);
    }
  }

  async create(
    createDto: CreateProductDto,
    companyId: string,
    performedByUserId?: number,
    resellerId?: number,
  ): Promise<ProductEntity> {
    if (!companyId) {
      throw new BadRequestException("CompanyId is required");
    }

    // Auto-generate SKU if not provided
    let sku = createDto.sku?.trim();
    if (!sku) {
      sku = `PROD-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    // Check if SKU already exists
    const existingProduct = await this.productRepository.findOne({
      where: { sku, companyId }
    });
    if (existingProduct) {
      throw new BadRequestException(`Product with SKU "${sku}" already exists`);
    }

    if (createDto.categoryId == null || createDto.categoryId === undefined) {
      throw new BadRequestException("Category is required");
    }
    const category = await this.categoryRepository.findOne({
      where: { id: createDto.categoryId, companyId }
    });
    if (!category) throw new NotFoundException("Category not found");

    try {
      const product = this.productRepository.create({
        name: createDto.name,
        sku,
        price: createDto.price,
        discountPrice: createDto.discountPrice,
        category,
        isActive: createDto.isActive ?? true,
        status: resellerId ? 'pending' : (createDto.status || 'published'),
        description: createDto.description,
        images: createDto.images,
        thumbnail: createDto.thumbnail,
        isFlashSell: createDto.isFlashSell ?? false,
        flashSellStartTime: createDto.flashSellStartTime ? new Date(createDto.flashSellStartTime) : undefined,
        flashSellEndTime: createDto.flashSellEndTime ? new Date(createDto.flashSellEndTime) : undefined,
        flashSellPrice: createDto.flashSellPrice,
        // Inventory fields
        stock: createDto.stock ?? 0,
        newStock: createDto.newStock ?? 0,
        sold: createDto.sold ?? 0,
        totalIncome: createDto.totalIncome ?? 0,
        isLowStock: createDto.isLowStock ?? false,
        // Variants & shipping
        sizes: createDto.sizes,
        variants: createDto.variants,
        types: createDto.types,
        weight: createDto.weight,
        length: createDto.length,
        breadth: createDto.breadth,
        width: createDto.width,
        unit: createDto.unit ?? 'Piece',
        companyId,
        resellerId,
      });

      const saved = await this.productRepository.save(product);
      if (performedByUserId) {
        try {
          await this.activityLogService.logActivity({
            companyId,
            action: ActivityAction.CREATE,
            entity: ActivityEntity.PRODUCT,
            entityId: saved.id,
            entityName: saved.name,
            description: `Created product: ${saved.name} (${saved.sku})`,
            newValues: { name: saved.name, sku: saved.sku, price: saved.price },
            performedByUserId,
          });
        } catch (e) {
          console.error('Failed to log activity:', e);
        }
      }
      // Notify store owner: new product added
      try {
        await this.notificationsService.saveProductAddedNotification(
          companyId,
          saved.name,
          saved.id,
          saved.sku,
        );
        const stock = saved.stock ?? 0;
        if (stock <= 0) {
          await this.notificationsService.saveOutOfStockNotification(
            companyId,
            saved.name,
            saved.id,
            saved.sku,
          );
        } else if (stock <= 5) {
          await this.notificationsService.saveLowStockNotification(
            companyId,
            saved.name,
            saved.id,
            stock,
            saved.sku,
          );
        }
      } catch (e) {
        console.error('Failed to save product notification:', e);
      }
      await this.clearCache(companyId);

      return saved;
    } catch (error) {
      if (error.code === '23505') { // PostgreSQL unique constraint violation
        throw new BadRequestException(`Product with SKU "${sku}" already exists`);
      }
      throw error;
    }
  }

  async findAll(
    companyId: string,
    options?: {
      relations?: string[];
      status?: 'draft' | 'published' | 'trashed' | 'pending';
      resellerId?: number;
    },
  ): Promise<any[]> {
    const cacheKey = `products:company_${companyId}:list:${JSON.stringify(options || {})}`;
    try {
      const cached = await this.cacheManager.get<any[]>(cacheKey);
      if (cached) return cached;
    } catch (e) {
      console.error('Cache get error:', e);
    }

    const statusFilter = options?.status || 'published';

    const qb = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoin('system_users', 'reseller', 'reseller.id = product.resellerId')
      .addSelect(['reseller.id', 'reseller.name', 'reseller.email', 'reseller.photo'])
      .where('product.companyId = :companyId', { companyId })
      .andWhere('product.status = :status', { status: statusFilter })
      .andWhere('product.deletedAt IS NULL')
      .orderBy('product.createdAt', 'DESC');

    if (options?.resellerId) {
      qb.andWhere('product.resellerId = :resellerId', { resellerId: options.resellerId });
    }

    const rows = await qb.getRawAndEntities();

    const result = rows.entities.map((product, i) => {
      const raw = rows.raw[i];
      return {
        ...product,
        reseller: raw.reseller_id
          ? {
            id: raw.reseller_id,
            name: raw.reseller_name,
            email: raw.reseller_email,
            photo: raw.reseller_photo,
          }
          : null,
      };
    });

    try {
      await this.cacheManager.set(cacheKey, result, 300 * 1000);
    } catch (e) {
      console.error('Cache set error:', e);
    }
    return result;
  }

  async findPublic(
    companyId: string,
    options?: {
      categorySlug?: string;
      limit?: number;
      offset?: number;
      search?: string;
    },
  ): Promise<ProductEntity[]> {
    const relations = ['category'];

    // Select only public fields (include createdAt for ORDER BY, categoryId for relation)
    const select: any = {
      id: true,
      name: true,
      sku: true,
      price: true,
      discountPrice: true,
      thumbnail: true,
      images: true,
      status: true,
      isFlashSell: true,
      flashSellPrice: true,
      flashSellStartTime: true,
      flashSellEndTime: true,
      stock: true, // Used to compute availability
      createdAt: true, // Required for order: { createdAt: 'DESC' } (PostgreSQL)
      categoryId: true, // Required when using relations + select
      category: {
        id: true,
        name: true,
        slug: true,
      },
    };

    const where: any = {
      companyId,
      status: 'published',
      deletedAt: IsNull(),
      isActive: true,
    };

    if (options?.categorySlug) {
      where.category = { slug: options.categorySlug };
    }

    // Basic search implementation if improved search is needed later
    /* if (options?.search) {
       where.name = ILike(`%${options.search}%`);
    } */

    return this.productRepository.find({
      select,
      where,
      relations,
      take: options?.limit || 20,
      skip: options?.offset || 0,
      order: { createdAt: 'DESC' },
    });
  }

  async findPublicByCategory(
    companyId: string,
    categoryName?: string | undefined,
    categoryId?: number | undefined,
    options?: { limit?: number; offset?: number },
  ): Promise<ProductEntity[]> {
    if (!companyId) return [];

    const relations = ['category'];
    const select: any = {
      id: true,
      name: true,
      sku: true,
      price: true,
      discountPrice: true,
      thumbnail: true,
      images: true,
      status: true,
      isFlashSell: true,
      flashSellPrice: true,
      flashSellStartTime: true,
      flashSellEndTime: true,
      stock: true,
      createdAt: true,
      category: {
        id: true,
        name: true,
        slug: true,
      },
    };

    let categoryIdToFilter: number | undefined;

    if (categoryId != null && Number.isFinite(categoryId)) {
      const category = await this.categoryRepository.findOne({
        where: { id: categoryId, companyId, deletedAt: IsNull() },
      });
      if (!category) return [];
      categoryIdToFilter = category.id;
    } else if (categoryName && String(categoryName).trim()) {
      const name = String(categoryName).trim();
      let category = await this.categoryRepository.findOne({
        where: { name, companyId, deletedAt: IsNull() },
      });
      if (!category) {
        const slug = name.toLowerCase().replace(/\s+/g, '-');
        category = await this.categoryRepository.findOne({
          where: { slug, companyId, deletedAt: IsNull() },
        });
      }
      if (!category) return [];
      categoryIdToFilter = category.id;
    } else {
      return [];
    }

    const take = Number.isFinite(options?.limit) && (options!.limit as number) > 0
      ? Math.min((options!.limit as number), 100)
      : 20;
    const skip = Number.isFinite(options?.offset) && (options!.offset as number) >= 0
      ? (options!.offset as number)
      : 0;

    const where: any = {
      companyId,
      status: 'published',
      deletedAt: IsNull(),
      isActive: true,
      category: {
        id: categoryIdToFilter,
      },
    };

    return this.productRepository.find({
      select,
      where,
      relations,
      take,
      skip,
      order: { createdAt: 'DESC' },
    });
  }

  async findPublicOne(companyId: string, identifier: string | number): Promise<ProductEntity> {
    const relations = ['category'];
    const select: any = {
      id: true,
      name: true,
      sku: true,
      price: true,
      discountPrice: true,
      thumbnail: true,
      images: true,
      description: true, // Only for detail view
      status: true,
      isFlashSell: true,
      flashSellPrice: true,
      flashSellStartTime: true,
      flashSellEndTime: true,
      stock: true,
      sizes: true, // Specific to detail
      variants: true, // Specific to detail
      weight: true,
      length: true,
      breadth: true,
      width: true,
      unit: true,
      companyId: true,
      category: {
        id: true,
        name: true,
        slug: true,
      },
    };

    const where: any = {
      companyId,
      status: 'published',
      deletedAt: IsNull(),
      isActive: true,
    };

    if (typeof identifier === 'number' || !isNaN(Number(identifier))) {
      where.id = Number(identifier);
    } else {
      where.sku = identifier; // Or slug if you have it
      // If we had slug: where.slug = identifier;
    }

    const product = await this.productRepository.findOne({
      select,
      where,
      relations,
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async findByCategory(
    companyId: string,
    categoryName?: string,
    categoryId?: number,
    options?: { relations?: string[] }
  ): Promise<ProductEntity[]> {
    const cacheKey = `products:company_${companyId}:category:${categoryId || 'null'}:${categoryName || 'null'}:${JSON.stringify(options || {})}`;
    try {
      const cached = await this.cacheManager.get<ProductEntity[]>(cacheKey);
      if (cached) return cached;
    } catch (e) {
      console.error('Cache get error:', e);
    }

    let categoryIdToFilter: number | undefined;

    // Filter by category ID (takes precedence if both are provided)
    if (categoryId) {
      const category = await this.categoryRepository.findOne({
        where: { id: categoryId, companyId, deletedAt: IsNull() }
      });
      if (!category) {
        return [];
      }
      categoryIdToFilter = category.id;
    }
    // Filter by category name if provided and categoryId not set
    else if (categoryName) {
      const category = await this.categoryRepository.findOne({
        where: { name: categoryName, companyId, deletedAt: IsNull() }
      });
      if (!category) {
        return [];
      }
      categoryIdToFilter = category.id;
    } else {
      // If neither categoryName nor categoryId is provided, return empty array
      return [];
    }

    const relations = options?.relations || ["category"];
    const finalRelations = relations.includes("category") ? relations : [...relations, "category"];

    const result = await this.productRepository.find({
      where: {
        deletedAt: IsNull(),
        companyId,
        category: { id: categoryIdToFilter }
      },
      relations: finalRelations,
    });

    try {
      await this.cacheManager.set(cacheKey, result, 300 * 1000); // 5 minutes TTL
    } catch (e) {
      console.error('Cache set error:', e);
    }
    return result;
  }

  async findOne(id: number, companyId: string, options?: { relations?: string[], includeTrashed?: boolean }): Promise<ProductEntity> {
    const where: any = { id, companyId };
    if (!options?.includeTrashed) {
      where.deletedAt = IsNull();
    }
    const product = await this.productRepository.findOne({
      where,
      relations: options?.relations || ["category"],
    });
    if (!product) throw new NotFoundException("Product not found");
    return product;
  }

  async update(id: number, updateDto: UpdateProductDto, companyId: string, performedByUserId?: number): Promise<ProductEntity> {
    const product = await this.findOne(id, companyId);
    const previousStock = product.stock ?? 0;
    const oldValues = {
      name: product.name,
      sku: product.sku,
      price: product.price,
      status: product.status,
      stock: previousStock,
    };

    if (updateDto.name) product.name = updateDto.name;
    if (updateDto.sku) {
      // Check if SKU already exists for another product
      const existingProduct = await this.productRepository.findOne({
        where: { sku: updateDto.sku, companyId }
      });
      if (existingProduct && existingProduct.id !== id) {
        throw new BadRequestException(`Product with SKU "${updateDto.sku}" already exists`);
      }
      product.sku = updateDto.sku;
    }
    if (updateDto.price !== undefined) product.price = updateDto.price;
    if (updateDto.discountPrice !== undefined) product.discountPrice = updateDto.discountPrice;
    if (updateDto.isActive !== undefined) product.isActive = updateDto.isActive;
    if (updateDto.status !== undefined) product.status = updateDto.status;

    if (updateDto.description !== undefined) product.description = updateDto.description;
    if (updateDto.images !== undefined) product.images = updateDto.images;
    if (updateDto.thumbnail !== undefined) product.thumbnail = updateDto.thumbnail;

    if (updateDto.isFlashSell !== undefined) product.isFlashSell = updateDto.isFlashSell;
    if (updateDto.flashSellStartTime !== undefined) {
      product.flashSellStartTime = updateDto.flashSellStartTime ? new Date(updateDto.flashSellStartTime) : undefined;
    }
    if (updateDto.flashSellEndTime !== undefined) {
      product.flashSellEndTime = updateDto.flashSellEndTime ? new Date(updateDto.flashSellEndTime) : undefined;
    }
    if (updateDto.flashSellPrice !== undefined) product.flashSellPrice = updateDto.flashSellPrice;

    // Inventory fields
    if (updateDto.stock !== undefined) {
      product.stock = updateDto.stock;
      // Auto-update isLowStock based on stock level (threshold: 5)
      product.isLowStock = updateDto.stock <= 5;
    }
    if (updateDto.newStock !== undefined) {
      // If newStock is provided, add it to current stock
      product.stock = (product.stock || 0) + updateDto.newStock;
      product.newStock = updateDto.newStock;
      // Auto-update isLowStock
      product.isLowStock = product.stock <= 5;
    }
    if (updateDto.sold !== undefined) product.sold = updateDto.sold;
    if (updateDto.totalIncome !== undefined) product.totalIncome = updateDto.totalIncome;
    if (updateDto.isLowStock !== undefined) product.isLowStock = updateDto.isLowStock;

    if (updateDto.categoryId) {
      const category = await this.categoryRepository.findOne({
        where: { id: updateDto.categoryId, companyId }
      });
      if (!category) throw new NotFoundException("Category not found");
      product.category = category;
    }

    // Variants & shipping
    if (updateDto.sizes !== undefined) product.sizes = updateDto.sizes;
    if (updateDto.variants !== undefined) product.variants = updateDto.variants;
    if (updateDto.types !== undefined) product.types = updateDto.types;
    if (updateDto.weight !== undefined) product.weight = updateDto.weight;
    if (updateDto.length !== undefined) product.length = updateDto.length;
    if (updateDto.breadth !== undefined) product.breadth = updateDto.breadth;
    if (updateDto.width !== undefined) product.width = updateDto.width;
    if (updateDto.unit !== undefined) product.unit = updateDto.unit;

    try {
      const saved = await this.productRepository.save(product);
      if (performedByUserId) {
        try {
          const stockChanged = updateDto.stock !== undefined || updateDto.newStock !== undefined;
          const finalStock = saved.stock ?? previousStock;
          const adjustment =
            updateDto.adjustment !== undefined
              ? updateDto.adjustment
              : stockChanged
                ? finalStock - previousStock
                : undefined;

          await this.activityLogService.logActivity({
            companyId,
            action: ActivityAction.UPDATE,
            entity: ActivityEntity.PRODUCT,
            entityId: saved.id,
            entityName: saved.name,
            description: `Updated product: ${saved.name} (${saved.sku})`,
            oldValues,
            newValues: {
              name: saved.name,
              sku: saved.sku,
              price: saved.price,
              status: saved.status,
              stock: finalStock,
              adjustment,
              reason: updateDto.reason,
            },
            performedByUserId,
          });
        } catch (e) {
          console.error('Failed to log activity:', e);
        }
      }
      // Notify store owner: product updated
      try {
        await this.notificationsService.saveProductUpdatedNotification(
          companyId,
          saved.name,
          saved.id,
          saved.sku,
        );
        // Stock alerts only when stock was changed in this update
        const stockChanged = updateDto.stock !== undefined || updateDto.newStock !== undefined;
        if (stockChanged) {
          const stock = saved.stock ?? 0;
          if (stock <= 0) {
            await this.notificationsService.saveOutOfStockNotification(
              companyId,
              saved.name,
              saved.id,
              saved.sku,
            );
          } else if (stock <= 5) {
            await this.notificationsService.saveLowStockNotification(
              companyId,
              saved.name,
              saved.id,
              stock,
              saved.sku,
            );
          }
        }
      } catch (e) {
        console.error('Failed to save product notification:', e);
      }
      await this.clearCache(companyId);
      return saved;
    } catch (error) {
      if (error.code === '23505') { // PostgreSQL unique constraint violation
        throw new BadRequestException(`Product with SKU "${updateDto.sku || product.sku}" already exists`);
      }
      throw error;
    }
  }

  async softDelete(id: number, companyId: string, performedByUserId?: number): Promise<void> {
    const product = await this.productRepository.findOne({
      where: { id, companyId, deletedAt: IsNull() },
    });
    if (!product) throw new NotFoundException("Product not found");

    // Move to trash instead of hard delete
    product.status = 'trashed';
    product.deletedAt = new Date(); // Track when it was trashed for auto-delete
    await this.productRepository.save(product);
    if (performedByUserId) {
      try {
        await this.activityLogService.logActivity({
          companyId,
          action: ActivityAction.DELETE,
          entity: ActivityEntity.PRODUCT,
          entityId: product.id,
          entityName: product.name,
          description: `Moved product to trash: ${product.name} (${product.sku})`,
          performedByUserId,
        });
      } catch (e) {
        console.error('Failed to log activity:', e);
      }
    }
    await this.clearCache(companyId);
  }

  async getTrashedProducts(companyId: string, resellerId?: number): Promise<ProductEntity[]> {
    return this.productRepository.find({
      where: {
        status: 'trashed',
        companyId,
        ...(resellerId ? { resellerId } : {}),
      },
      relations: ["category"],
      withDeleted: true, // Include soft-deleted (trashed) records
    });
  }

  async getDraftProducts(companyId: string, resellerId?: number): Promise<any[]> {
    // For resellers: show both 'draft' and 'pending' (awaiting approval) products
    if (resellerId) {
      const rows = await this.productRepository
        .createQueryBuilder('product')
        .leftJoinAndSelect('product.category', 'category')
        .where('product.companyId = :companyId', { companyId })
        .andWhere('product.status IN (:...statuses)', { statuses: ['draft', 'pending'] })
        .andWhere('product.resellerId = :resellerId', { resellerId })
        .andWhere('product.deletedAt IS NULL')
        .orderBy('product.createdAt', 'DESC')
        .getMany();
      return rows;
    }

    // For admin: show only drafts
    return this.productRepository.find({
      where: {
        status: 'draft',
        deletedAt: IsNull(),
        companyId,
      },
      relations: ['category'],
    });
  }

  async recoverFromTrash(id: number, companyId: string): Promise<ProductEntity> {
    const product = await this.productRepository.findOne({
      where: { id, companyId },
      relations: ["category"],
      withDeleted: true, // Include soft-deleted (trashed) records
    });
    if (!product) throw new NotFoundException("Product not found");

    if (product.status !== 'trashed') {
      throw new BadRequestException("Product is not in trash");
    }

    // Use QueryBuilder to set deletedAt to null (update() has TS issues with null)
    await this.productRepository
      .createQueryBuilder()
      .update(ProductEntity)
      .set({ status: 'published', deletedAt: null })
      .where('id = :id', { id })
      .andWhere('companyId = :companyId', { companyId })
      .execute();
    // Re-fetch with relations to return complete product data
    const recovered = await this.productRepository.findOne({
      where: { id, companyId },
      relations: ["category"],
    });
    if (!recovered) throw new NotFoundException("Product not found after recovery");

    await this.clearCache(companyId);
    return recovered;
  }

  async permanentDelete(id: number, companyId: string, performedByUserId?: number): Promise<void> {
    const product = await this.productRepository.findOne({
      where: { id, companyId, status: 'trashed' },
      withDeleted: true, // Include soft-deleted (trashed) records
    });
    if (!product) throw new NotFoundException("Product not found in trash");

    if (performedByUserId) {
      try {
        await this.activityLogService.logActivity({
          companyId,
          action: ActivityAction.DELETE,
          entity: ActivityEntity.PRODUCT,
          entityId: product.id,
          entityName: product.name,
          description: `Permanently deleted product: ${product.name} (${product.sku})`,
          performedByUserId,
        });
      } catch (e) {
        console.error('Failed to log activity:', e);
      }
    }

    // Hard delete - permanently remove from database
    await this.productRepository.remove(product);
    await this.clearCache(companyId);
  }

  async autoDeleteOldTrash(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Find all trashed products that were deleted more than 30 days ago
    const productsToDelete = await this.productRepository
      .createQueryBuilder('product')
      .where('product.status = :status', { status: 'trashed' })
      .andWhere('product.deletedAt < :date', { date: thirtyDaysAgo })
      .getMany();

    if (productsToDelete.length > 0) {
      const companyIds = new Set(productsToDelete.map(p => p.companyId));
      await this.productRepository.remove(productsToDelete);
      for (const companyId of companyIds) {
        await this.clearCache(companyId);
      }
    }

    return productsToDelete.length;
  }

  async publishDraft(id: number, companyId: string): Promise<ProductEntity> {
    const product = await this.productRepository.findOne({
      where: { id, companyId, deletedAt: IsNull() },
    });
    if (!product) throw new NotFoundException("Product not found");

    if (product.status !== 'draft' && product.status !== 'pending') {
      throw new BadRequestException("Product is not a draft or pending approval");
    }

    product.status = 'published';
    const saved = await this.productRepository.save(product);
    await this.clearCache(companyId);
    return saved;
  }

  async rejectProduct(id: number, companyId: string, reason?: string): Promise<ProductEntity> {
    const product = await this.productRepository.findOne({
      where: { id, companyId, deletedAt: IsNull() },
    });
    if (!product) throw new NotFoundException("Product not found");
    if (product.status !== 'draft' && product.status !== 'pending') {
      throw new BadRequestException("Only draft or pending products can be rejected");
    }

    product.status = 'trashed';
    product.deletedAt = new Date();
    const saved = await this.productRepository.save(product);
    await this.clearCache(companyId);
    return saved;
  }

  /** Returns only reseller-submitted drafts (pending admin approval), with reseller info. */
  async getPendingApprovalProducts(companyId: string): Promise<any[]> {
    const rows = await this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoin('system_users', 'reseller', 'reseller.id = product.resellerId')
      .addSelect(['reseller.id', 'reseller.name', 'reseller.email', 'reseller.phone', 'reseller.photo'])
      .where('product.companyId = :companyId', { companyId })
      .andWhere('product.status = :status', { status: 'pending' })
      .andWhere('product.resellerId IS NOT NULL')
      .andWhere('product.deletedAt IS NULL')
      .orderBy('product.createdAt', 'DESC')
      .getRawAndEntities();

    // Merge raw reseller fields into entity results
    return rows.entities.map((product, i) => {
      const raw = rows.raw[i];
      return {
        ...product,
        reseller: raw.reseller_name
          ? {
            id: raw.reseller_id,
            name: raw.reseller_name,
            email: raw.reseller_email,
            phone: raw.reseller_phone,
            photo: raw.reseller_photo,
          }
          : null,
      };
    });
  }

  async toggleActive(id: number, active: boolean, companyId: string): Promise<ProductEntity> {
    const product = await this.findOne(id, companyId);
    product.isActive = active;
    const saved = await this.productRepository.save(product);
    // Invalidate cache
    await this.clearCache(companyId);
    return saved;
  }

  async findTrending(companyId: string, days: number = 30, limit: number = 10): Promise<ProductEntity[]> {
    try {
      // Calculate the date threshold (e.g., 30 days ago)
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - days);

      // Get orders from recent period
      const recentOrders = await this.orderRepository.find({
        where: {
          companyId,
          deletedAt: IsNull(),
          createdAt: MoreThanOrEqual(dateThreshold)
        }
      });

      // Extract items from orders and aggregate by product
      const productSales = new Map<number, number>();
      recentOrders.forEach(order => {
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach(item => {
            if (item.productId) {
              const currentSales = productSales.get(item.productId) || 0;
              productSales.set(item.productId, currentSales + item.quantity);
            }
          });
        }
      });

      // Sort by sales and get top products
      const sortedProducts = Array.from(productSales.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([productId]) => productId);

      // Extract product IDs
      const productIds = sortedProducts.filter(Boolean);

      if (productIds.length === 0) {
        return [];
      }

      // Fetch full product details with category
      const products = await this.productRepository.find({
        where: { id: In(productIds), deletedAt: IsNull(), companyId, isActive: true },
        relations: ['category'],
      });

      // Sort products by the order from trendingProducts query
      const productMap = new Map(products.map((p) => [p.id, p]));
      return productIds.map((id) => productMap.get(id)).filter(Boolean) as ProductEntity[];
    } catch (error) {
      console.error('Error in findTrending:', error);
      // Return empty array on error instead of throwing
      return [];
    }
  }

  async setFlashSell(
    productIds: number[],
    flashSellStartTime: Date,
    flashSellEndTime: Date,
    flashSellPrice: number | undefined,
    companyId: string
  ): Promise<ProductEntity[]> {
    // Validate that all products exist and belong to the company
    const products = await this.productRepository.find({
      where: { id: In(productIds), deletedAt: IsNull(), companyId },
    });

    if (products.length !== productIds.length) {
      throw new NotFoundException("One or more products not found");
    }

    // Validate time range
    if (flashSellEndTime <= flashSellStartTime) {
      throw new Error("Flash sell end time must be after start time");
    }

    // Update all products with flash sell information
    products.forEach((product) => {
      product.isFlashSell = true;
      product.flashSellStartTime = flashSellStartTime;
      product.flashSellEndTime = flashSellEndTime;
      if (flashSellPrice !== undefined) {
        product.flashSellPrice = flashSellPrice;
      }
    });

    return this.productRepository.save(products);
  }

  async removeFlashSell(productIds: number[], companyId: string): Promise<ProductEntity[]> {
    const products = await this.productRepository.find({
      where: { id: In(productIds), deletedAt: IsNull(), companyId },
    });

    if (products.length !== productIds.length) {
      throw new NotFoundException("One or more products not found");
    }

    products.forEach((product) => {
      product.isFlashSell = false;
      product.flashSellStartTime = undefined;
      product.flashSellEndTime = undefined;
      product.flashSellPrice = undefined;
    });

    return this.productRepository.save(products);
  }

  async getActiveFlashSellProducts(companyId: string): Promise<ProductEntity[]> {
    const now = new Date();
    return this.productRepository.find({
      where: {
        isFlashSell: true,
        deletedAt: IsNull(),
        companyId,
        // Consider any non‑expired flash sell as "active" set:
        // (includes both currently running and upcoming if startTime is in the future)
        flashSellEndTime: MoreThanOrEqual(now),
      },
      relations: ["category"],
    });
  }

  /**
   * Get stock adjustment history for a product based on activity logs.
   * This reads PRODUCT/UPDATE logs where stock changed.
   */
  async getStockHistory(
    productId: number,
    companyId: string,
    limit: number = 50,
  ): Promise<
    Array<{
      id: number;
      createdAt: Date;
      type: 'IN' | 'OUT';
      quantity: number;
      previousStock: number | null;
      newStock: number | null;
      user?: { id: number; name: string; email: string };
      reason?: string | null;
    }>
  > {
    const { logs } = await this.activityLogService.getActivityLogs(companyId, {
      entity: ActivityEntity.PRODUCT,
      action: ActivityAction.UPDATE,
      limit,
    });

    const relevantLogs = logs.filter((log) => {
      if (log.entityId !== productId) return false;
      const oldStock = (log.oldValues as any)?.stock;
      const newStock = (log.newValues as any)?.stock;
      return typeof oldStock === 'number' || typeof newStock === 'number';
    });

    return relevantLogs.map((log) => {
      const oldStock = (log.oldValues as any)?.stock ?? null;
      const newStock = (log.newValues as any)?.stock ?? null;
      let quantity = 0;
      if (typeof oldStock === 'number' && typeof newStock === 'number') {
        quantity = newStock - oldStock;
      } else {
        const adj = (log.newValues as any)?.adjustment;
        if (typeof adj === 'number') {
          quantity = adj;
        }
      }
      const type: 'IN' | 'OUT' = quantity >= 0 ? 'IN' : 'OUT';

      return {
        id: log.id,
        createdAt: log.createdAt,
        type,
        quantity,
        previousStock: oldStock,
        newStock,
        user: log.performedBy
          ? {
            id: log.performedBy.id,
            name: log.performedBy.name,
            email: log.performedBy.email,
          }
          : undefined,
        reason: (log.newValues as any)?.reason ?? null,
      };
    });
  }

  async bulkCreate(
    products: Array<{
      name: string;
      sku: string;
      price: number;
      discountPrice?: number;
      categoryId: number;
      isActive?: boolean;
      description?: string;
      thumbnail?: string;
      images?: string;
      stock?: number;
    }>,
    companyId: string
  ): Promise<{
    success: ProductEntity[];
    failed: Array<{ row: number; data: any; error: string }>;
  }> {
    if (!companyId) {
      throw new BadRequestException("CompanyId is required");
    }

    const success: ProductEntity[] = [];
    const failed: Array<{ row: number; data: any; error: string }> = [];

    // Get all categories for this company once
    const categories = await this.categoryRepository.find({
      where: { companyId, deletedAt: IsNull() },
    });
    const categoryMap = new Map(categories.map(cat => [cat.id, cat]));

    // Check for duplicate SKUs in the input
    const skuSet = new Set<string>();
    const existingProducts = await this.productRepository.find({
      where: { companyId, deletedAt: IsNull() },
      select: ['sku'],
    });
    const existingSkus = new Set(existingProducts.map(p => p.sku));

    for (let i = 0; i < products.length; i++) {
      const productData = products[i];
      const rowNumber = i + 2; // +2 because row 1 is header, and arrays are 0-indexed

      try {
        // Validate required fields
        if (!productData.name || !productData.sku || !productData.price || !productData.categoryId) {
          failed.push({
            row: rowNumber,
            data: productData,
            error: "Missing required fields: name, sku, price, or categoryId",
          });
          continue;
        }

        // Check for duplicate SKU in current batch
        if (skuSet.has(productData.sku)) {
          failed.push({
            row: rowNumber,
            data: productData,
            error: `Duplicate SKU in upload: ${productData.sku}`,
          });
          continue;
        }

        // Check for existing SKU in database
        if (existingSkus.has(productData.sku)) {
          failed.push({
            row: rowNumber,
            data: productData,
            error: `SKU already exists: ${productData.sku}`,
          });
          continue;
        }

        // Validate category exists
        const category = categoryMap.get(productData.categoryId);
        if (!category) {
          failed.push({
            row: rowNumber,
            data: productData,
            error: `Category not found: ${productData.categoryId}`,
          });
          continue;
        }

        // Parse images if provided
        let images: { url: string; alt: string; isPrimary: boolean }[] | undefined = undefined;
        if (productData.images) {
          const imageUrls = productData.images.split(',').map(url => url.trim()).filter(url => url);
          if (imageUrls.length > 0) {
            images = imageUrls.map((url, index) => ({
              url,
              alt: `${productData.name} image ${index + 1}`,
              isPrimary: index === 0,
            }));
          }
        }

        // Create product
        const product = this.productRepository.create({
          name: productData.name,
          sku: productData.sku,
          price: productData.price,
          discountPrice: productData.discountPrice,
          category,
          isActive: productData.isActive ?? true,
          status: 'published',
          description: productData.description,
          images,
          thumbnail: productData.thumbnail,
          // Inventory fields
          stock: productData.stock ?? 0,
          newStock: 0,
          sold: 0,
          totalIncome: 0,
          isLowStock: false,
          companyId,
        });

        const savedProduct = await this.productRepository.save(product);
        success.push(savedProduct);
        skuSet.add(productData.sku);
        existingSkus.add(productData.sku); // Add to existing set to prevent duplicates in same batch
      } catch (error) {
        failed.push({
          row: rowNumber,
          data: productData,
          error: error.message || "Unknown error occurred",
        });
      }
    }

    return { success, failed };
  }
}
