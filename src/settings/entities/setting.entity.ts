import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class Setting {
  @PrimaryColumn({ type: 'varchar' })
  key!: string;

  @Column({ type: 'text', nullable: true })
  value!: string | null;

  @UpdateDateColumn()
  updatedAt!: Date;
}
