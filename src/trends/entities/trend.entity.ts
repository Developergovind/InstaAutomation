import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class Trend {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  keyword!: string;

  @Column({ type: 'varchar', default: 'google_trends' })
  source!: string;

  @Column({ type: 'boolean', default: false })
  processed!: boolean;

  @Column({ type: 'float', default: 0 })
  approxTraffic!: number;

  @Column({ type: 'int', default: 0 })
  articleCount!: number;

  @Column({ type: 'int', default: 0 })
  recencyScore!: number;

  @Column({ type: 'float', default: 0 })
  finalScore!: number;

  @Column('simple-json', { nullable: true })
  relatedNews!: { title: string; source: string; url?: string }[] | null;

  @Column({ type: 'varchar', default: 'general' })
  niche!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
