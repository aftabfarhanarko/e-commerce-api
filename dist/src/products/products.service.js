"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const product_entity_1 = require("./entities/product.entity");
const category_entity_1 = require("../category/entities/category.entity");
const order_entity_1 = require("../orders/entities/order.entity");
const activity_log_service_1 = require("../systemuser/activity-log.service");
const activity_log_entity_1 = require("../systemuser/entities/activity-log.entity");
const notifications_service_1 = require("../notifications/notifications.service");
const cache_manager_1 = require("@nestjs/cache-manager");
let ProductService = class ProductService {
    constructor(productRepository, categoryRepository, orderRepository, activityLogService, notificationsService, cacheManager) {
        this.productRepository = productRepository;
        this.categoryRepository = categoryRepository;
        this.orderRepository = orderRepository;
        this.activityLogService = activityLogService;
        this.notificationsService = notificationsService;
        this.cacheManager = cacheManager;
    }
    async clearCache(companyId) {
        try {
            const keys = await this.cacheManager.store.keys(`products:company_${companyId}*`);
            if (keys.length > 0) {
                await this.cacheManager.store.del(keys);
            }
        }
        catch (e) {
            console.error('Failed to clear product cache:', e);
        }
    }
    async create(createDto, companyId, performedByUserId, resellerId) {
        if (!companyId) {
            throw new common_1.BadRequestException("CompanyId is required");
        }
        let sku = createDto.sku?.trim();
        if (!sku) {
            sku = `PROD-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        }
        const existingProduct = await this.productRepository.findOne({
            where: { sku, companyId }
        });
        if (existingProduct) {
            throw new common_1.BadRequestException(`Product with SKU "${sku}" already exists`);
        }
        if (createDto.categoryId == null || createDto.categoryId === undefined) {
            throw new common_1.BadRequestException("Category is required");
        }
        const category = await this.categoryRepository.findOne({
            where: { id: createDto.categoryId, companyId }
        });
        if (!category)
            throw new common_1.NotFoundException("Category not found");
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
                stock: createDto.stock ?? 0,
                newStock: createDto.newStock ?? 0,
                sold: createDto.sold ?? 0,
                totalIncome: createDto.totalIncome ?? 0,
                isLowStock: createDto.isLowStock ?? false,
                sizes: createDto.sizes,
                variants: createDto.variants,
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
                        action: activity_log_entity_1.ActivityAction.CREATE,
                        entity: activity_log_entity_1.ActivityEntity.PRODUCT,
                        entityId: saved.id,
                        entityName: saved.name,
                        description: `Created product: ${saved.name} (${saved.sku})`,
                        newValues: { name: saved.name, sku: saved.sku, price: saved.price },
                        performedByUserId,
                    });
                }
                catch (e) {
                    console.error('Failed to log activity:', e);
                }
            }
            try {
                await this.notificationsService.saveProductAddedNotification(companyId, saved.name, saved.id, saved.sku);
                const stock = saved.stock ?? 0;
                if (stock <= 0) {
                    await this.notificationsService.saveOutOfStockNotification(companyId, saved.name, saved.id, saved.sku);
                }
                else if (stock <= 5) {
                    await this.notificationsService.saveLowStockNotification(companyId, saved.name, saved.id, stock, saved.sku);
                }
            }
            catch (e) {
                console.error('Failed to save product notification:', e);
            }
            await this.clearCache(companyId);
            return saved;
        }
        catch (error) {
            if (error.code === '23505') {
                throw new common_1.BadRequestException(`Product with SKU "${sku}" already exists`);
            }
            throw error;
        }
    }
    async findAll(companyId, options) {
        const cacheKey = `products:company_${companyId}:list:${JSON.stringify(options || {})}`;
        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached)
                return cached;
        }
        catch (e) {
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
        }
        catch (e) {
            console.error('Cache set error:', e);
        }
        return result;
    }
    async findPublic(companyId, options) {
        const relations = ['category'];
        const select = {
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
            categoryId: true,
            category: {
                id: true,
                name: true,
                slug: true,
            },
        };
        const where = {
            companyId,
            status: 'published',
            deletedAt: (0, typeorm_2.IsNull)(),
            isActive: true,
        };
        if (options?.categorySlug) {
            where.category = { slug: options.categorySlug };
        }
        return this.productRepository.find({
            select,
            where,
            relations,
            take: options?.limit || 20,
            skip: options?.offset || 0,
            order: { createdAt: 'DESC' },
        });
    }
    async findPublicByCategory(companyId, categoryName, categoryId, options) {
        if (!companyId)
            return [];
        const relations = ['category'];
        const select = {
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
        let categoryIdToFilter;
        if (categoryId != null && Number.isFinite(categoryId)) {
            const category = await this.categoryRepository.findOne({
                where: { id: categoryId, companyId, deletedAt: (0, typeorm_2.IsNull)() },
            });
            if (!category)
                return [];
            categoryIdToFilter = category.id;
        }
        else if (categoryName && String(categoryName).trim()) {
            const name = String(categoryName).trim();
            let category = await this.categoryRepository.findOne({
                where: { name, companyId, deletedAt: (0, typeorm_2.IsNull)() },
            });
            if (!category) {
                const slug = name.toLowerCase().replace(/\s+/g, '-');
                category = await this.categoryRepository.findOne({
                    where: { slug, companyId, deletedAt: (0, typeorm_2.IsNull)() },
                });
            }
            if (!category)
                return [];
            categoryIdToFilter = category.id;
        }
        else {
            return [];
        }
        const take = Number.isFinite(options?.limit) && options.limit > 0
            ? Math.min(options.limit, 100)
            : 20;
        const skip = Number.isFinite(options?.offset) && options.offset >= 0
            ? options.offset
            : 0;
        const where = {
            companyId,
            status: 'published',
            deletedAt: (0, typeorm_2.IsNull)(),
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
    async findPublicOne(companyId, identifier) {
        const relations = ['category'];
        const select = {
            id: true,
            name: true,
            sku: true,
            price: true,
            discountPrice: true,
            thumbnail: true,
            images: true,
            description: true,
            status: true,
            isFlashSell: true,
            flashSellPrice: true,
            flashSellStartTime: true,
            flashSellEndTime: true,
            stock: true,
            sizes: true,
            variants: true,
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
        const where = {
            companyId,
            status: 'published',
            deletedAt: (0, typeorm_2.IsNull)(),
            isActive: true,
        };
        if (typeof identifier === 'number' || !isNaN(Number(identifier))) {
            where.id = Number(identifier);
        }
        else {
            where.sku = identifier;
        }
        const product = await this.productRepository.findOne({
            select,
            where,
            relations,
        });
        if (!product) {
            throw new common_1.NotFoundException('Product not found');
        }
        return product;
    }
    async findByCategory(companyId, categoryName, categoryId, options) {
        const cacheKey = `products:company_${companyId}:category:${categoryId || 'null'}:${categoryName || 'null'}:${JSON.stringify(options || {})}`;
        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached)
                return cached;
        }
        catch (e) {
            console.error('Cache get error:', e);
        }
        let categoryIdToFilter;
        if (categoryId) {
            const category = await this.categoryRepository.findOne({
                where: { id: categoryId, companyId, deletedAt: (0, typeorm_2.IsNull)() }
            });
            if (!category) {
                return [];
            }
            categoryIdToFilter = category.id;
        }
        else if (categoryName) {
            const category = await this.categoryRepository.findOne({
                where: { name: categoryName, companyId, deletedAt: (0, typeorm_2.IsNull)() }
            });
            if (!category) {
                return [];
            }
            categoryIdToFilter = category.id;
        }
        else {
            return [];
        }
        const relations = options?.relations || ["category"];
        const finalRelations = relations.includes("category") ? relations : [...relations, "category"];
        const result = await this.productRepository.find({
            where: {
                deletedAt: (0, typeorm_2.IsNull)(),
                companyId,
                category: { id: categoryIdToFilter }
            },
            relations: finalRelations,
        });
        try {
            await this.cacheManager.set(cacheKey, result, 300 * 1000);
        }
        catch (e) {
            console.error('Cache set error:', e);
        }
        return result;
    }
    async findOne(id, companyId, options) {
        const where = { id, companyId };
        if (!options?.includeTrashed) {
            where.deletedAt = (0, typeorm_2.IsNull)();
        }
        const product = await this.productRepository.findOne({
            where,
            relations: options?.relations || ["category"],
        });
        if (!product)
            throw new common_1.NotFoundException("Product not found");
        return product;
    }
    async update(id, updateDto, companyId, performedByUserId) {
        const product = await this.findOne(id, companyId);
        const previousStock = product.stock ?? 0;
        const oldValues = {
            name: product.name,
            sku: product.sku,
            price: product.price,
            status: product.status,
            stock: previousStock,
        };
        if (updateDto.name)
            product.name = updateDto.name;
        if (updateDto.sku) {
            const existingProduct = await this.productRepository.findOne({
                where: { sku: updateDto.sku, companyId }
            });
            if (existingProduct && existingProduct.id !== id) {
                throw new common_1.BadRequestException(`Product with SKU "${updateDto.sku}" already exists`);
            }
            product.sku = updateDto.sku;
        }
        if (updateDto.price !== undefined)
            product.price = updateDto.price;
        if (updateDto.discountPrice !== undefined)
            product.discountPrice = updateDto.discountPrice;
        if (updateDto.isActive !== undefined)
            product.isActive = updateDto.isActive;
        if (updateDto.status !== undefined)
            product.status = updateDto.status;
        if (updateDto.description !== undefined)
            product.description = updateDto.description;
        if (updateDto.images !== undefined)
            product.images = updateDto.images;
        if (updateDto.thumbnail !== undefined)
            product.thumbnail = updateDto.thumbnail;
        if (updateDto.isFlashSell !== undefined)
            product.isFlashSell = updateDto.isFlashSell;
        if (updateDto.flashSellStartTime !== undefined) {
            product.flashSellStartTime = updateDto.flashSellStartTime ? new Date(updateDto.flashSellStartTime) : undefined;
        }
        if (updateDto.flashSellEndTime !== undefined) {
            product.flashSellEndTime = updateDto.flashSellEndTime ? new Date(updateDto.flashSellEndTime) : undefined;
        }
        if (updateDto.flashSellPrice !== undefined)
            product.flashSellPrice = updateDto.flashSellPrice;
        if (updateDto.stock !== undefined) {
            product.stock = updateDto.stock;
            product.isLowStock = updateDto.stock <= 5;
        }
        if (updateDto.newStock !== undefined) {
            product.stock = (product.stock || 0) + updateDto.newStock;
            product.newStock = updateDto.newStock;
            product.isLowStock = product.stock <= 5;
        }
        if (updateDto.sold !== undefined)
            product.sold = updateDto.sold;
        if (updateDto.totalIncome !== undefined)
            product.totalIncome = updateDto.totalIncome;
        if (updateDto.isLowStock !== undefined)
            product.isLowStock = updateDto.isLowStock;
        if (updateDto.categoryId) {
            const category = await this.categoryRepository.findOne({
                where: { id: updateDto.categoryId, companyId }
            });
            if (!category)
                throw new common_1.NotFoundException("Category not found");
            product.category = category;
        }
        if (updateDto.sizes !== undefined)
            product.sizes = updateDto.sizes;
        if (updateDto.variants !== undefined)
            product.variants = updateDto.variants;
        if (updateDto.weight !== undefined)
            product.weight = updateDto.weight;
        if (updateDto.length !== undefined)
            product.length = updateDto.length;
        if (updateDto.breadth !== undefined)
            product.breadth = updateDto.breadth;
        if (updateDto.width !== undefined)
            product.width = updateDto.width;
        if (updateDto.unit !== undefined)
            product.unit = updateDto.unit;
        try {
            const saved = await this.productRepository.save(product);
            if (performedByUserId) {
                try {
                    const stockChanged = updateDto.stock !== undefined || updateDto.newStock !== undefined;
                    const finalStock = saved.stock ?? previousStock;
                    const adjustment = updateDto.adjustment !== undefined
                        ? updateDto.adjustment
                        : stockChanged
                            ? finalStock - previousStock
                            : undefined;
                    await this.activityLogService.logActivity({
                        companyId,
                        action: activity_log_entity_1.ActivityAction.UPDATE,
                        entity: activity_log_entity_1.ActivityEntity.PRODUCT,
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
                }
                catch (e) {
                    console.error('Failed to log activity:', e);
                }
            }
            try {
                await this.notificationsService.saveProductUpdatedNotification(companyId, saved.name, saved.id, saved.sku);
                const stockChanged = updateDto.stock !== undefined || updateDto.newStock !== undefined;
                if (stockChanged) {
                    const stock = saved.stock ?? 0;
                    if (stock <= 0) {
                        await this.notificationsService.saveOutOfStockNotification(companyId, saved.name, saved.id, saved.sku);
                    }
                    else if (stock <= 5) {
                        await this.notificationsService.saveLowStockNotification(companyId, saved.name, saved.id, stock, saved.sku);
                    }
                }
            }
            catch (e) {
                console.error('Failed to save product notification:', e);
            }
            await this.clearCache(companyId);
            return saved;
        }
        catch (error) {
            if (error.code === '23505') {
                throw new common_1.BadRequestException(`Product with SKU "${updateDto.sku || product.sku}" already exists`);
            }
            throw error;
        }
    }
    async softDelete(id, companyId, performedByUserId) {
        const product = await this.productRepository.findOne({
            where: { id, companyId, deletedAt: (0, typeorm_2.IsNull)() },
        });
        if (!product)
            throw new common_1.NotFoundException("Product not found");
        product.status = 'trashed';
        product.deletedAt = new Date();
        await this.productRepository.save(product);
        if (performedByUserId) {
            try {
                await this.activityLogService.logActivity({
                    companyId,
                    action: activity_log_entity_1.ActivityAction.DELETE,
                    entity: activity_log_entity_1.ActivityEntity.PRODUCT,
                    entityId: product.id,
                    entityName: product.name,
                    description: `Moved product to trash: ${product.name} (${product.sku})`,
                    performedByUserId,
                });
            }
            catch (e) {
                console.error('Failed to log activity:', e);
            }
        }
        await this.clearCache(companyId);
    }
    async getTrashedProducts(companyId, resellerId) {
        return this.productRepository.find({
            where: {
                status: 'trashed',
                companyId,
                ...(resellerId ? { resellerId } : {}),
            },
            relations: ["category"],
            withDeleted: true,
        });
    }
    async getDraftProducts(companyId, resellerId) {
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
        return this.productRepository.find({
            where: {
                status: 'draft',
                deletedAt: (0, typeorm_2.IsNull)(),
                companyId,
            },
            relations: ['category'],
        });
    }
    async recoverFromTrash(id, companyId) {
        const product = await this.productRepository.findOne({
            where: { id, companyId },
            relations: ["category"],
            withDeleted: true,
        });
        if (!product)
            throw new common_1.NotFoundException("Product not found");
        if (product.status !== 'trashed') {
            throw new common_1.BadRequestException("Product is not in trash");
        }
        await this.productRepository
            .createQueryBuilder()
            .update(product_entity_1.ProductEntity)
            .set({ status: 'published', deletedAt: null })
            .where('id = :id', { id })
            .andWhere('companyId = :companyId', { companyId })
            .execute();
        const recovered = await this.productRepository.findOne({
            where: { id, companyId },
            relations: ["category"],
        });
        if (!recovered)
            throw new common_1.NotFoundException("Product not found after recovery");
        await this.clearCache(companyId);
        return recovered;
    }
    async permanentDelete(id, companyId, performedByUserId) {
        const product = await this.productRepository.findOne({
            where: { id, companyId, status: 'trashed' },
            withDeleted: true,
        });
        if (!product)
            throw new common_1.NotFoundException("Product not found in trash");
        if (performedByUserId) {
            try {
                await this.activityLogService.logActivity({
                    companyId,
                    action: activity_log_entity_1.ActivityAction.DELETE,
                    entity: activity_log_entity_1.ActivityEntity.PRODUCT,
                    entityId: product.id,
                    entityName: product.name,
                    description: `Permanently deleted product: ${product.name} (${product.sku})`,
                    performedByUserId,
                });
            }
            catch (e) {
                console.error('Failed to log activity:', e);
            }
        }
        await this.productRepository.remove(product);
        await this.clearCache(companyId);
    }
    async autoDeleteOldTrash() {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
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
    async publishDraft(id, companyId) {
        const product = await this.productRepository.findOne({
            where: { id, companyId, deletedAt: (0, typeorm_2.IsNull)() },
        });
        if (!product)
            throw new common_1.NotFoundException("Product not found");
        if (product.status !== 'draft' && product.status !== 'pending') {
            throw new common_1.BadRequestException("Product is not a draft or pending approval");
        }
        product.status = 'published';
        const saved = await this.productRepository.save(product);
        await this.clearCache(companyId);
        return saved;
    }
    async rejectProduct(id, companyId, reason) {
        const product = await this.productRepository.findOne({
            where: { id, companyId, deletedAt: (0, typeorm_2.IsNull)() },
        });
        if (!product)
            throw new common_1.NotFoundException("Product not found");
        if (product.status !== 'draft' && product.status !== 'pending') {
            throw new common_1.BadRequestException("Only draft or pending products can be rejected");
        }
        product.status = 'trashed';
        product.deletedAt = new Date();
        const saved = await this.productRepository.save(product);
        await this.clearCache(companyId);
        return saved;
    }
    async getPendingApprovalProducts(companyId) {
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
    async toggleActive(id, active, companyId) {
        const product = await this.findOne(id, companyId);
        product.isActive = active;
        const saved = await this.productRepository.save(product);
        await this.clearCache(companyId);
        return saved;
    }
    async findTrending(companyId, days = 30, limit = 10) {
        try {
            const dateThreshold = new Date();
            dateThreshold.setDate(dateThreshold.getDate() - days);
            const recentOrders = await this.orderRepository.find({
                where: {
                    companyId,
                    deletedAt: (0, typeorm_2.IsNull)(),
                    createdAt: (0, typeorm_2.MoreThanOrEqual)(dateThreshold)
                }
            });
            const productSales = new Map();
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
            const sortedProducts = Array.from(productSales.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, limit)
                .map(([productId]) => productId);
            const productIds = sortedProducts.filter(Boolean);
            if (productIds.length === 0) {
                return [];
            }
            const products = await this.productRepository.find({
                where: { id: (0, typeorm_2.In)(productIds), deletedAt: (0, typeorm_2.IsNull)(), companyId, isActive: true },
                relations: ['category'],
            });
            const productMap = new Map(products.map((p) => [p.id, p]));
            return productIds.map((id) => productMap.get(id)).filter(Boolean);
        }
        catch (error) {
            console.error('Error in findTrending:', error);
            return [];
        }
    }
    async setFlashSell(productIds, flashSellStartTime, flashSellEndTime, flashSellPrice, companyId) {
        const products = await this.productRepository.find({
            where: { id: (0, typeorm_2.In)(productIds), deletedAt: (0, typeorm_2.IsNull)(), companyId },
        });
        if (products.length !== productIds.length) {
            throw new common_1.NotFoundException("One or more products not found");
        }
        if (flashSellEndTime <= flashSellStartTime) {
            throw new Error("Flash sell end time must be after start time");
        }
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
    async removeFlashSell(productIds, companyId) {
        const products = await this.productRepository.find({
            where: { id: (0, typeorm_2.In)(productIds), deletedAt: (0, typeorm_2.IsNull)(), companyId },
        });
        if (products.length !== productIds.length) {
            throw new common_1.NotFoundException("One or more products not found");
        }
        products.forEach((product) => {
            product.isFlashSell = false;
            product.flashSellStartTime = undefined;
            product.flashSellEndTime = undefined;
            product.flashSellPrice = undefined;
        });
        return this.productRepository.save(products);
    }
    async getActiveFlashSellProducts(companyId) {
        const now = new Date();
        return this.productRepository.find({
            where: {
                isFlashSell: true,
                deletedAt: (0, typeorm_2.IsNull)(),
                companyId,
                flashSellEndTime: (0, typeorm_2.MoreThanOrEqual)(now),
            },
            relations: ["category"],
        });
    }
    async getStockHistory(productId, companyId, limit = 50) {
        const { logs } = await this.activityLogService.getActivityLogs(companyId, {
            entity: activity_log_entity_1.ActivityEntity.PRODUCT,
            action: activity_log_entity_1.ActivityAction.UPDATE,
            limit,
        });
        const relevantLogs = logs.filter((log) => {
            if (log.entityId !== productId)
                return false;
            const oldStock = log.oldValues?.stock;
            const newStock = log.newValues?.stock;
            return typeof oldStock === 'number' || typeof newStock === 'number';
        });
        return relevantLogs.map((log) => {
            const oldStock = log.oldValues?.stock ?? null;
            const newStock = log.newValues?.stock ?? null;
            let quantity = 0;
            if (typeof oldStock === 'number' && typeof newStock === 'number') {
                quantity = newStock - oldStock;
            }
            else {
                const adj = log.newValues?.adjustment;
                if (typeof adj === 'number') {
                    quantity = adj;
                }
            }
            const type = quantity >= 0 ? 'IN' : 'OUT';
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
                reason: log.newValues?.reason ?? null,
            };
        });
    }
    async bulkCreate(products, companyId) {
        if (!companyId) {
            throw new common_1.BadRequestException("CompanyId is required");
        }
        const success = [];
        const failed = [];
        const categories = await this.categoryRepository.find({
            where: { companyId, deletedAt: (0, typeorm_2.IsNull)() },
        });
        const categoryMap = new Map(categories.map(cat => [cat.id, cat]));
        const skuSet = new Set();
        const existingProducts = await this.productRepository.find({
            where: { companyId, deletedAt: (0, typeorm_2.IsNull)() },
            select: ['sku'],
        });
        const existingSkus = new Set(existingProducts.map(p => p.sku));
        for (let i = 0; i < products.length; i++) {
            const productData = products[i];
            const rowNumber = i + 2;
            try {
                if (!productData.name || !productData.sku || !productData.price || !productData.categoryId) {
                    failed.push({
                        row: rowNumber,
                        data: productData,
                        error: "Missing required fields: name, sku, price, or categoryId",
                    });
                    continue;
                }
                if (skuSet.has(productData.sku)) {
                    failed.push({
                        row: rowNumber,
                        data: productData,
                        error: `Duplicate SKU in upload: ${productData.sku}`,
                    });
                    continue;
                }
                if (existingSkus.has(productData.sku)) {
                    failed.push({
                        row: rowNumber,
                        data: productData,
                        error: `SKU already exists: ${productData.sku}`,
                    });
                    continue;
                }
                const category = categoryMap.get(productData.categoryId);
                if (!category) {
                    failed.push({
                        row: rowNumber,
                        data: productData,
                        error: `Category not found: ${productData.categoryId}`,
                    });
                    continue;
                }
                let images = undefined;
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
                existingSkus.add(productData.sku);
            }
            catch (error) {
                failed.push({
                    row: rowNumber,
                    data: productData,
                    error: error.message || "Unknown error occurred",
                });
            }
        }
        return { success, failed };
    }
};
exports.ProductService = ProductService;
exports.ProductService = ProductService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(product_entity_1.ProductEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(category_entity_1.CategoryEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(order_entity_1.Order)),
    __param(5, (0, common_1.Inject)(cache_manager_1.CACHE_MANAGER)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        activity_log_service_1.ActivityLogService,
        notifications_service_1.NotificationsService, Object])
], ProductService);
//# sourceMappingURL=products.service.js.map