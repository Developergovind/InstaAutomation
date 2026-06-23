import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class Analytics {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  mediaId!: string;

  @Column({ type: 'varchar', nullable: true })
  postId!: string | null;

  @Column({ type: 'varchar' })
  mediaType!: string;

  @Column({ type: 'text', nullable: true })
  permalink!: string | null;

  @Column({ type: 'text', nullable: true })
  caption!: string | null;

  @Column({ type: 'int', default: 0 })
  likes!: number;

  @Column({ type: 'int', default: 0 })
  comments!: number;

  @Column({ type: 'int', default: 0 })
  shares!: number;

  @Column({ type: 'int', default: 0 })
  saved!: number;

  @Column({ type: 'int', default: 0 })
  reach!: number;

  @Column({ type: 'int', default: 0 })
  impressions!: number;

  @Column({ type: 'float', default: 0 })
  engagementRate!: number;

  @Column({ type: 'datetime', nullable: true })
  postedAt!: Date | null;

  @CreateDateColumn()
  fetchedAt!: Date;
}
