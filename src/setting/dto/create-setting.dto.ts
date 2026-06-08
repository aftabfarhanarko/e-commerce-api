import { IsString, IsOptional, IsEmail, MaxLength } from 'class-validator';

export class CreateSettingDto {
  @IsString()
  @MaxLength(150)
  companyName: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  logo?: string;

  @IsEmail()
  @MaxLength(150)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  // SMTP settings (editable from frontend)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  smtpUser?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  smtpPass?: string;


  @IsOptional()
  @IsString()
  @MaxLength(500)
  orderReceiptUrl?: string;
}