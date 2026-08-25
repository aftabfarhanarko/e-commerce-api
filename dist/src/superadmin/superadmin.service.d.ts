import { Repository } from 'typeorm';
import { SuperAdmin } from './entities/superadmin.entity';
import { CreateSuperadminDto } from './dto/create-superadmin.dto';
import { SuperadminLoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { Transporter } from 'nodemailer';
export declare class SuperadminService {
    private readonly superadminRepo;
    private readonly jwtService;
    private readonly mailer;
    constructor(superadminRepo: Repository<SuperAdmin>, jwtService: JwtService, mailer: Transporter);
    private hashPassword;
    create(dto: CreateSuperadminDto): Promise<any>;
    findByEmail(email: string): Promise<SuperAdmin>;
    findAll(): Promise<{
        id: number;
        name: string;
        email: string;
        designation: string;
        photo: string;
        permissions: string[];
        role: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        deletedAt?: Date;
    }[]>;
    findOne(id: number): Promise<any>;
    update(id: number, dto: Partial<CreateSuperadminDto>): Promise<any>;
    remove(id: number): Promise<{
        success: boolean;
    }>;
    login(dto: SuperadminLoginDto): Promise<{
        accessToken: string;
        refreshToken: string;
        user: any;
    }>;
}
