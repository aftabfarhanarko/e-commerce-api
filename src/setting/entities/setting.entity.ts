import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';

@Entity('tbl_settings')
export class Setting {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  companyName: string;

  @Column({ nullable: true })
  logo?: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  location?: string;

  @Column({ nullable: false })
  companyId: string;

  // SMTP settings (editable from frontend)
  @Column({ nullable: true })
  smtpHost?: string;

  @Column({ type: 'int', nullable: true })
  smtpPort?: number;

  @Column({ type: 'boolean', nullable: true })
  smtpSecure?: boolean;

  @Column({ nullable: true })
  smtpUser?: string;

  // Note: storing passwords in DB has risk; consider encrypting at rest.
  @Column({ nullable: true })
  smtpPass?: string;

  @Column({ nullable: true })
  smtpFrom?: string;

  @Column({ nullable: true })
  fraudCheckerApiKey?: string;


  // Order Payment Slip / App Sticker URL
  @Column({ nullable: true, length: 500 })
  orderReceiptUrl?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date;
}