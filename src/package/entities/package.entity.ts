import { SystemUser } from "../../systemuser/entities/systemuser.entity";
import { Theme } from "../../theme/entities/theme.entity";
import { FeaturePermission } from "../../systemuser/feature-permission.enum";
import { Column, DeleteDateColumn, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity('packages')
export class Package {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column('text')
  description: string;

  // XXGFSDG

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  discountPrice?: number;

  @Column({ default: false })
  isFeatured: boolean;

  @Column({ type: 'json', nullable: true })
  features: FeaturePermission[];

  @Column({ nullable: true })
  themeId: number;

  @ManyToOne(() => Theme, { nullable: true })
  @JoinColumn({ name: 'themeId' })
  theme: Theme;

  @OneToMany(() => SystemUser, (systemUser) => systemUser.package)
  systemUsers: SystemUser[] | any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date;
}
